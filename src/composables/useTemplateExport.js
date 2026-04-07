import { drawTemplate } from './useTemplateRenderer.js';
import { BLOB_REVOKE_DELAY } from './templateConstants.js';

/**
 * Handles exporting template formats as PNG (image) or WebM (video),
 * including batch ZIP export.
 *
 * @param {Object} store      - The templateBuilder Pinia store
 * @param {Object} deps       - Reactive dependencies:
 *   drawState:   ComputedRef<Object>  — full draw state for rendering
 *   croppedEls:  Reactive<Object>     — per-format cropped image elements
 *   sourceEl:    Ref<Element>         — current source element
 *   logoEl:      Ref<HTMLImageElement> — current logo element
 *   sourceType:  Ref<string>          — 'image' or 'video'
 *   sourceReady: Ref<boolean>         — whether source is loaded
 *   canvasRefs:  Ref<Object>          — map of format id → TemplateCanvas instances
 */
export function useTemplateExport(store, deps) {
  const { drawState, croppedEls, logoEl, sourceType, sourceReady, canvasRefs } = deps;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), BLOB_REVOKE_DELAY);
  }

  /** Render a format at full resolution (format.w × format.h) */
  function renderFullRes(fmt, { includeLogo = true } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = fmt.w;
    canvas.height = fmt.h;
    const usesCrop = !!croppedEls[fmt.id];
    const ds = {
      ...drawState.value,
      el: croppedEls[fmt.id] || drawState.value.el,
      logo: includeLogo ? logoEl.value : null,
      focalX: usesCrop ? 0.5 : drawState.value.focalX ?? 0.5,
      focalY: usesCrop ? 0.5 : drawState.value.focalY ?? 0.5,
    };
    drawTemplate(canvas.getContext('2d'), fmt.w, fmt.h, fmt, ds);
    return canvas;
  }

  // ── Image export ──────────────────────────────────────────────────────────────

  async function exportImageFormat(fmt) {
    // Try with logo; if tainted canvas, retry without
    try {
      const canvas = renderFullRes(fmt, { includeLogo: true });
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('tainted');
      triggerDownload(blob, `${fmt.id}-${fmt.w}x${fmt.h}.png`);
    } catch {
      try {
        const canvas = renderFullRes(fmt, { includeLogo: false });
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        if (!blob) throw new Error('Export failed \u2014 check CORS on the source image URL');
        triggerDownload(blob, `${fmt.id}-${fmt.w}x${fmt.h}.png`);
        store.setStatus('Downloaded \u2014 logo omitted (logo URL doesn\u2019t support cross-origin)', 'ok');
      } catch (e) {
        throw new Error('Export failed \u2014 check CORS on the source image URL');
      }
    }
  }

  // ── Video export ──────────────────────────────────────────────────────────────

  async function exportVideoFormat(fmt) {
    const comp = canvasRefs.value[fmt.id];
    const displayCanvas = comp?.canvasRef;
    if (!displayCanvas) throw new Error('Canvas not found');

    const video = deps.sourceEl.value;
    const duration = Math.min((video.duration || 10) * 1000, 30_000);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : null;
    if (!mimeType) throw new Error('WebM recording not supported in this browser \u2014 use Chrome or Edge.');

    video.currentTime = 0;
    await new Promise(r => { video.onseeked = () => { video.onseeked = null; r(); }; setTimeout(r, 600); });

    const stream = displayCanvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

    recorder.start(100);

    await new Promise((resolve, reject) => {
      setTimeout(() => { recorder.stop(); resolve(); }, duration);
      recorder.onerror = e => reject(e.error || new Error('Recorder error'));
    });

    await new Promise(r => { recorder.onstop = r; if (recorder.state === 'inactive') r(); });
    if (!chunks.length) throw new Error('No video data captured.');

    const blob = new Blob(chunks, { type: 'video/webm' });
    triggerDownload(blob, `${fmt.id}-${fmt.w}x${fmt.h}.webm`);
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  /** Export a single format by id */
  async function exportFormat(id) {
    const fmt = store.formats.find(f => f.id === id);
    if (!fmt || !sourceReady.value) return;

    try {
      if (sourceType.value === 'video') {
        await exportVideoFormat(fmt);
      } else {
        await exportImageFormat(fmt);
      }
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  }

  /** Export all formats as a ZIP (images only) */
  async function exportAll() {
    if (!sourceReady.value || sourceType.value === 'video') return;

    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      let logoOmitted = false;

      for (const fmt of store.formats) {
        try {
          const canvas = renderFullRes(fmt, { includeLogo: true });
          const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
          if (!blob) throw new Error('tainted');
          zip.file(`${fmt.id}-${fmt.w}x${fmt.h}.png`, blob);
        } catch {
          try {
            const canvas = renderFullRes(fmt, { includeLogo: false });
            const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            if (blob) zip.file(`${fmt.id}-${fmt.w}x${fmt.h}.png`, blob);
            logoOmitted = true;
          } catch (_) {}
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerDownload(zipBlob, 'brand-banners.zip');
      if (logoOmitted) store.setStatus('Downloaded \u2014 logo omitted (logo URL doesn\u2019t support cross-origin)', 'ok');
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  }

  return {
    exportFormat,
    exportAll,
    renderFullRes,
  };
}
