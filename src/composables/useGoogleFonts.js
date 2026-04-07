// ── Google Fonts loader for canvas rendering ──────────────────────────────────
// Curated list of popular display/marketing fonts.
// Loads fonts on demand via Google Fonts CSS API.

/**
 * Font weight catalogue — maps each font to its available weights.
 * Used to disable unavailable weight buttons and auto-fallback on font switch.
 */
export const FONT_WEIGHTS = {
  'Inter':             [300, 400, 500, 600, 700, 900],
  'Roboto':            [300, 400, 500, 600, 700, 900],
  'Open Sans':         [300, 400, 500, 600, 700],
  'Lato':              [300, 400, 700, 900],
  'Montserrat':        [300, 400, 500, 600, 700, 900],
  'Poppins':           [300, 400, 500, 600, 700, 900],
  'Raleway':           [300, 400, 500, 600, 700, 900],
  'Oswald':            [300, 400, 500, 600, 700],
  'Playfair Display':  [400, 500, 600, 700, 900],
  'Merriweather':      [300, 400, 500, 600, 700, 900],
  'Source Sans 3':     [300, 400, 500, 600, 700, 900],
  'Nunito':            [300, 400, 500, 600, 700, 900],
  'Rubik':             [300, 400, 500, 600, 700, 900],
  'Work Sans':         [300, 400, 500, 600, 700, 900],
  'DM Sans':           [300, 400, 500, 600, 700, 900],
  'Outfit':            [300, 400, 500, 600, 700, 900],
  'Manrope':           [300, 400, 500, 600, 700],
  'Space Grotesk':     [300, 400, 500, 600, 700],
  'Plus Jakarta Sans': [300, 400, 500, 600, 700],
  'Sora':              [300, 400, 500, 600, 700],
  'Barlow':            [300, 400, 500, 600, 700, 900],
  'Bebas Neue':        [400],
  'Archivo':           [300, 400, 500, 600, 700, 900],
  'Libre Franklin':    [300, 400, 500, 600, 700, 900],
  'Fira Sans':         [300, 400, 500, 600, 700, 900],
  'Crimson Text':      [400, 600, 700],
  'PT Sans':           [400, 700],
  'IBM Plex Sans':     [300, 400, 500, 600, 700],
  'Bitter':            [300, 400, 500, 600, 700, 900],
  'Josefin Sans':      [300, 400, 500, 600, 700],
  'Noto Sans':         [300, 400, 500, 600, 700, 900],
  'Kanit':             [300, 400, 500, 600, 700, 900],
  'Quicksand':         [300, 400, 500, 600, 700],
  'Mulish':            [300, 400, 500, 600, 700, 900],
  'Lexend':            [300, 400, 500, 600, 700, 900],
};

export const FONT_LIST = Object.keys(FONT_WEIGHTS);

/**
 * Get the nearest available weight for a font family.
 * Returns the closest supported weight (preferring heavier if equidistant).
 */
export function nearestWeight(family, targetWeight) {
  const weights = FONT_WEIGHTS[family];
  if (!weights) return targetWeight;
  const tw = parseInt(targetWeight);
  if (weights.includes(tw)) return String(tw);
  // Find closest
  let best = weights[0];
  let bestDist = Math.abs(tw - best);
  for (const w of weights) {
    const d = Math.abs(tw - w);
    if (d < bestDist || (d === bestDist && w > best)) {
      best = w;
      bestDist = d;
    }
  }
  return String(best);
}

/**
 * Check if a specific weight is available for a font family.
 */
export function hasWeight(family, weight) {
  const weights = FONT_WEIGHTS[family];
  if (!weights) return true; // unknown font — allow all
  return weights.includes(parseInt(weight));
}

// Track which font families are fully loaded and ready for canvas
const readyFamilies = new Set();
// Track pending loads per family
const pendingLoads = new Map();

/**
 * Load a Google Font family (all common weights at once).
 * Resolves when the font is ready to use on canvas.
 * Weight param accepted for API compat but ignored — all weights loaded together.
 */
export function loadFont(family, _weight = '400') {
  // Inter is already loaded via index.html
  if (family === 'Inter') return Promise.resolve();

  // Already fully loaded
  if (readyFamilies.has(family)) return Promise.resolve();

  // Already in-flight — return same promise
  if (pendingLoads.has(family)) return pendingLoads.get(family);

  const promise = new Promise((resolve) => {
    const weights = FONT_WEIGHTS[family] || [400];
    const wgts = weights.join(';');
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${wgts}&display=swap`;

    // Step 1: Inject the stylesheet and wait for it to load
    let link = document.querySelector(`link[href="${url}"]`);
    const needsInject = !link;

    if (needsInject) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
    }

    function onStylesheetReady() {
      // Step 2: Stylesheet CSS is loaded. Now wait for the browser to
      // parse the @font-face rules and actually fetch the font files.
      const check = `400 16px "${family}"`;

      // Poll until the font is genuinely available
      const tryResolve = (attempts = 0) => {
        if (document.fonts.check(check)) {
          readyFamilies.add(family);
          pendingLoads.delete(family);
          resolve();
        } else if (attempts > 80) {
          // Safety timeout (~5s) — resolve anyway so we don't block forever
          readyFamilies.add(family);
          pendingLoads.delete(family);
          resolve();
        } else {
          setTimeout(() => tryResolve(attempts + 1), 60);
        }
      };

      // Kick off font file download via fonts.load, then poll to confirm
      document.fonts.load(check).then(() => {
        // fonts.load resolved — but double-check with .check()
        if (document.fonts.check(check)) {
          readyFamilies.add(family);
          pendingLoads.delete(family);
          resolve();
        } else {
          tryResolve();
        }
      }).catch(() => {
        tryResolve();
      });
    }

    if (needsInject) {
      link.onload = onStylesheetReady;
      link.onerror = () => {
        // Stylesheet failed — resolve anyway so UI isn't stuck
        readyFamilies.add(family);
        pendingLoads.delete(family);
        resolve();
      };
      document.head.appendChild(link);
    } else {
      // Stylesheet already in DOM — it may or may not be loaded
      // Try immediately; the CSS might already be cached
      onStylesheetReady();
    }
  });

  pendingLoads.set(family, promise);
  return promise;
}

/**
 * Ensure a specific weight's font file is downloaded and ready.
 * The stylesheet must already be injected (via loadFont).
 * Uses document.fonts.load() to trigger the browser to fetch that weight.
 */
export async function ensureWeight(family, weight = '400') {
  if (family === 'Inter') return;
  // Make sure the stylesheet is loaded first
  await loadFont(family);
  const check = `${weight} 16px "${family}"`;
  if (document.fonts.check(check)) return;
  try {
    await document.fonts.load(check);
  } catch {
    // Ignore — weight may not exist, browser uses nearest
  }
  // Small wait for the font to settle into the document
  await document.fonts.ready;
}

/**
 * Ensure all three template fonts + their active weights are loaded.
 */
export async function loadTemplateFonts(headlineFont, textFont, ctaFont, hw, tw, cw) {
  const loads = [];
  if (headlineFont) loads.push(loadFont(headlineFont));
  if (textFont) loads.push(loadFont(textFont));
  if (ctaFont) loads.push(loadFont(ctaFont));
  await Promise.all(loads);
  // Now ensure the specific weight font files are downloaded
  const weightLoads = [];
  if (headlineFont && hw) weightLoads.push(ensureWeight(headlineFont, hw));
  if (textFont && tw) weightLoads.push(ensureWeight(textFont, tw));
  if (ctaFont && cw) weightLoads.push(ensureWeight(ctaFont, cw));
  await Promise.all(weightLoads);
}

/**
 * Check if a font family is ready for canvas use.
 */
export function isFontReady(family, _weight = '400') {
  if (family === 'Inter') return true;
  return readyFamilies.has(family);
}
