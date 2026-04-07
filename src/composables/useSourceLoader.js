import { ref, reactive } from 'vue';
import { buildSmartCropUrl } from './useTemplateRenderer.js';
import { VIDEO_LOAD_TIMEOUT } from './templateConstants.js';

/**
 * Manages source asset loading (image or video), smart crop elements,
 * and the video render loop.
 *
 * @param {Object} store - The templateBuilder Pinia store
 * @returns Reactive refs and functions for source management
 */
export function useSourceLoader(store) {
  const sourceType    = ref('image');
  const sourceEl      = ref(null);
  const sourceReady   = ref(false);
  const sourceLoading = ref(false);
  const hiddenVideoRef = ref(null);  // template ref for <video>

  /** Per-format smart-cropped image elements */
  const croppedEls = reactive({});

  // Video render loop handle
  let _animFrame = null;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function isVideoUrl(url) {
    return /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url) || url.includes('/video/');
  }

  function clearCroppedEls() {
    Object.keys(croppedEls).forEach(k => delete croppedEls[k]);
  }

  // ── Source loading ────────────────────────────────────────────────────────────

  /**
   * Load a source image or video from the store's sourceUrl.
   * @param {Object} callbacks - Optional hooks:
   *   onImageLoaded(img, url)  — called after image loads successfully
   *   onVideoReady()           — called after video can play
   */
  function loadSource(callbacks = {}) {
    const url = store.sourceUrl.trim();
    if (!url) return;

    stopVideoLoop();
    sourceReady.value = false;
    sourceLoading.value = true;

    const type = isVideoUrl(url) ? 'video' : 'image';
    sourceType.value = type;
    clearCroppedEls();
    store.setStatus('Loading...', 'load');

    if (type === 'image') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        sourceEl.value = img;
        sourceReady.value = true;
        sourceLoading.value = false;
        store.setStatus(`\u2713 Image loaded (${img.naturalWidth}\u00D7${img.naturalHeight})`, 'ok');
        callbacks.onImageLoaded?.(img, url);
      };
      img.onerror = () => {
        sourceLoading.value = false;
        store.setStatus('Could not load image \u2014 check URL', 'err');
      };
      img.src = url;
    } else {
      const video = hiddenVideoRef.value;
      if (!video) return;
      video.src = url;
      video.crossOrigin = 'anonymous';
      video.load();

      const onReady = () => {
        video.oncanplay = null;
        sourceEl.value = video;
        sourceReady.value = true;
        sourceLoading.value = false;
        store.setStatus('\u25B6 Video playing', 'ok');
        video.play().catch(() => {});
        callbacks.onVideoReady?.();
      };
      video.oncanplay = onReady;
      video.onerror = () => {
        sourceLoading.value = false;
        store.setStatus('Could not load video \u2014 check URL', 'err');
      };

      setTimeout(() => {
        if (!sourceReady.value && sourceLoading.value) {
          sourceLoading.value = false;
          store.setStatus('Timeout loading video', 'err');
        }
      }, VIDEO_LOAD_TIMEOUT);
    }
  }

  // ── Smart crops ───────────────────────────────────────────────────────────────

  /** Load smart-cropped variants for all formats */
  function loadSmartCrops(baseUrl) {
    clearCroppedEls();
    if (!store.useSmartCrop) return;
    for (const fmt of store.formats) {
      loadSmartCropForFormat(baseUrl, fmt.id, fmt.w, fmt.h);
    }
  }

  /** Load a single smart-cropped image for one format */
  function loadSmartCropForFormat(baseUrl, formatId, w, h, onLoaded) {
    const cropUrl = buildSmartCropUrl(baseUrl, w, h);
    if (!cropUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      croppedEls[formatId] = img;
      onLoaded?.();
    };
    img.src = cropUrl;
  }

  /** Reload a single format's smart crop (e.g. after resize) */
  function reloadSmartCrop(formatId, w, h, onLoaded) {
    if (!sourceReady.value || !store.useSmartCrop || sourceType.value !== 'image') return;
    const baseUrl = store.sourceUrl.trim();
    if (!baseUrl) return;
    loadSmartCropForFormat(baseUrl, formatId, w, h, onLoaded);
  }

  // ── Video loop ────────────────────────────────────────────────────────────────

  /**
   * Start a requestAnimationFrame loop that calls renderFn every frame.
   * @param {Function} renderFn — called once per frame
   */
  function startVideoLoop(renderFn) {
    stopVideoLoop();
    function loop() {
      renderFn();
      _animFrame = requestAnimationFrame(loop);
    }
    _animFrame = requestAnimationFrame(loop);
  }

  function stopVideoLoop() {
    if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  /** Full reset — clears all loaded state (used on project switch) */
  function reset() {
    stopVideoLoop();
    sourceEl.value = null;
    sourceReady.value = false;
    sourceLoading.value = false;
    sourceType.value = 'image';
    clearCroppedEls();
  }

  function destroy() {
    stopVideoLoop();
  }

  return {
    // Refs
    sourceType,
    sourceEl,
    sourceReady,
    sourceLoading,
    hiddenVideoRef,
    croppedEls,

    // Methods
    isVideoUrl,
    loadSource,
    loadSmartCrops,
    loadSmartCropForFormat,
    reloadSmartCrop,
    startVideoLoop,
    stopVideoLoop,
    clearCroppedEls,
    reset,
    destroy,
  };
}
