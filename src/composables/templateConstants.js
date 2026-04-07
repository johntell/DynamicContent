// ── Shared constants for the Template Builder feature ────────────────────────

/** Infinite canvas — zoom limits and defaults */
export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 4.0;
export const DEFAULT_ZOOM = 1.0;        // 100% — actual size
export const ZOOM_STEP = 1.08;          // multiplier per wheel tick
export const CARD_GAP = 80;             // px gap between auto-laid-out cards

/** Video loading timeout (ms) */
export const VIDEO_LOAD_TIMEOUT = 12_000;

/** Blob URL revocation delay (ms) */
export const BLOB_REVOKE_DELAY = 30_000;

/** Logo URL debounce delay (ms) */
export const LOGO_DEBOUNCE_MS = 500;

/** Default per-format properties (for reset-to-default) */
export const DEFAULT_FORMAT_PROPS = {
  anchor: 'bl',
  layerAnchors: {},
  logoAnchor: '',
  logoSize: 0.08,
  contentScale: 1,
  contentWidth: 60,
  ctaScale: 1,
  padding: 0,  // 0 = auto (7% of shortest side), 1-20 = manual percentage
};
