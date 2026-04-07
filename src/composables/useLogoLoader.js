import { ref, watch } from 'vue';
import { LOGO_DEBOUNCE_MS } from './templateConstants.js';

/**
 * Manages logo image loading with multi-strategy CORS fallback.
 *
 * Strategies (in order):
 *   1. Direct CORS <img>
 *   2. fetch() → blob → object URL
 *   3. Non-CORS fallback (display only, no export)
 *
 * @param {Object} store - The templateBuilder Pinia store
 * @returns Reactive refs and functions for logo management
 */
export function useLogoLoader(store) {
  const logoEl = ref(null);
  let _debounceTimer = null;

  function loadLogoImg(url) {
    // Strategy 1: CORS <img> directly
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { logoEl.value = img; };
    img.onerror = () => {
      // Strategy 2: fetch as blob → object URL
      fetch(url)
        .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const img2 = new Image();
          img2.crossOrigin = 'anonymous';
          img2.onload = () => { logoEl.value = img2; };
          img2.onerror = () => { logoEl.value = null; };
          img2.src = blobUrl;
        })
        .catch(() => {
          // Strategy 3: non-CORS fallback (display only)
          const img3 = new Image();
          img3.onload = function() { this._corsUnsafe = true; logoEl.value = this; };
          img3.onerror = () => { logoEl.value = null; };
          img3.src = url;
        });
    };
    img.src = url;
  }

  function scheduleLogoLoad() {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      const url = store.logoUrl.trim();
      if (!url) { logoEl.value = null; return; }
      loadLogoImg(url);
    }, LOGO_DEBOUNCE_MS);
  }

  function clearLogo() {
    store.logoUrl = '';
    logoEl.value = null;
  }

  /** Returns true if the loaded logo can't be exported (CORS-unsafe) */
  function logoIsTainted() {
    return !!(logoEl.value && logoEl.value._corsUnsafe);
  }

  // Auto-reload when logo URL changes
  watch(() => store.logoUrl, () => { scheduleLogoLoad(); });

  function destroy() {
    if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
  }

  return {
    logoEl,
    loadLogoImg,
    scheduleLogoLoad,
    clearLogo,
    logoIsTainted,
    destroy,
  };
}
