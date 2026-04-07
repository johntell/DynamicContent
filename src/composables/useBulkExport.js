import { drawTemplate } from './useTemplateRenderer.js';

/**
 * Bulk export: iterates rows x formats, renders each to PNG,
 * packages everything into a ZIP organized by row.
 *
 * @param {Object} store     - templateBuilder store
 * @param {Object} bulkStore - bulkData store
 * @param {Object} deps      - { drawState, croppedEls, logoEl, sourceEl }
 */
export function useBulkExport(store, bulkStore, deps) {
  const { drawState, croppedEls, logoEl } = deps;

  /** Load an image from URL, returns HTMLImageElement or null */
  function loadImage(url) {
    return new Promise(resolve => {
      if (!url) { resolve(null); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  /** Sanitize a string for use as a filename/folder name */
  function sanitize(s) {
    return String(s).replace(/[<>:"/\\|?*]/g, '_').trim().slice(0, 80) || 'row';
  }

  /**
   * Export all rows x all formats as a ZIP.
   * @returns {Promise<void>}
   */
  async function exportAllRows() {
    if (!bulkStore.rows.length || !store.formats.length) return;

    bulkStore.isExporting = true;
    bulkStore.exportProgress = 0;

    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const total = bulkStore.rows.length * store.formats.length;
      let done = 0;

      // Image cache for per-row source overrides
      const imgCache = new Map();

      for (let i = 0; i < bulkStore.rows.length; i++) {
        const baseDS = drawState.value;
        const rowDS = bulkStore.buildRowDrawState(i, baseDS);

        // Determine row folder name — use first mapped value or index
        const firstCol = bulkStore.columns[0];
        const rowLabel = sanitize(bulkStore.rows[i][firstCol] || `row-${i + 1}`);
        const rowFolder = zip.folder(`${String(i + 1).padStart(3, '0')}-${rowLabel}`);

        // Resolve per-row source image override
        let rowSourceEl = baseDS.el;
        if (rowDS._sourceUrlOverride) {
          if (!imgCache.has(rowDS._sourceUrlOverride)) {
            imgCache.set(rowDS._sourceUrlOverride, await loadImage(rowDS._sourceUrlOverride));
          }
          rowSourceEl = imgCache.get(rowDS._sourceUrlOverride) || baseDS.el;
        }

        // Resolve per-row logo override
        let rowLogoEl = logoEl.value;
        if (rowDS._logoUrlOverride) {
          if (!imgCache.has(rowDS._logoUrlOverride)) {
            imgCache.set(rowDS._logoUrlOverride, await loadImage(rowDS._logoUrlOverride));
          }
          rowLogoEl = imgCache.get(rowDS._logoUrlOverride) || logoEl.value;
        }

        for (const fmt of store.formats) {
          const usesCrop = !!croppedEls[fmt.id];
          const baseDSForFmt = {
            ...rowDS,
            el: croppedEls[fmt.id] || rowSourceEl,
            focalX: usesCrop ? 0.5 : rowDS.focalX ?? 0.5,
            focalY: usesCrop ? 0.5 : rowDS.focalY ?? 0.5,
          };
          const fmtName = fmt.label || `${fmt.w}x${fmt.h}`;
          const fileName = `${sanitize(fmtName)}-${fmt.w}x${fmt.h}.png`;

          // Try with logo first; if canvas is tainted, retry without
          let blob = null;
          for (const tryLogo of [rowLogoEl, null]) {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = fmt.w;
              canvas.height = fmt.h;
              drawTemplate(canvas.getContext('2d'), fmt.w, fmt.h, fmt, { ...baseDSForFmt, logo: tryLogo });
              blob = await new Promise((resolve, reject) => {
                canvas.toBlob(b => { if (b) resolve(b); else reject(new Error('null blob')); }, 'image/png');
              });
              break; // success
            } catch {
              // If we already tried without logo, give up
              if (!tryLogo) break;
              // Otherwise retry without logo
            }
          }
          if (blob) rowFolder.file(fileName, blob);

          done++;
          bulkStore.exportProgress = done / total;

          // Yield to event loop every 4 renders to keep UI responsive
          if (done % 4 === 0) await new Promise(r => setTimeout(r, 0));
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `bulk-export-${bulkStore.rows.length}rows.zip`,
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);

      store.setStatus(`Exported ${done} images (${bulkStore.rows.length} rows x ${store.formats.length} formats)`, 'ok');
    } catch (e) {
      store.setStatus('Bulk export failed: ' + e.message, 'err');
    } finally {
      bulkStore.isExporting = false;
    }
  }

  return { exportAllRows };
}
