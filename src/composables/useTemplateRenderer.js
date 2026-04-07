// ── Template Renderer — Pure canvas drawing functions ─────────────────────────
// No Vue reactivity, no DOM queries. All functions are stateless and side-effect free
// (except for drawing to the provided canvas context).

/**
 * Resolve content padding for a format.
 * @param {number} minDim - Math.min(width, height) of the canvas
 * @param {object} fmt - format object (may have fmt.padding)
 * @returns {number} padding in pixels
 */
export function resolvePadding(minDim, fmt) {
  const p = fmt?.padding;
  if (p && p > 0) return Math.max(4, minDim * (p / 100));
  return Math.max(8, minDim * 0.07); // auto: 7% of shortest side
}

export function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

export function buildSmartCropUrl(base, w, h) {
  if (!base) return base;
  const d = gcd(Math.round(w), Math.round(h));
  const ratio = `${w / d}:${h / d}`;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}width=${w}&crop=${ratio},smart&format=webp`;
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Draw a background fill behind the image. Modes: color, linear gradient,
 * radial gradient. Gradient centres are based on the focal point position
 * mapped onto the canvas via computeFocalFit.
 *
 * @param fit  The result of computeFocalFit (provides ox, oy, dw, dh for
 *             mapping the focal point onto the canvas).
 */
export function drawBackground(ctx, w, h, ds, fit) {
  const mode = ds.bgMode;
  if (!mode || mode === 'none') return;

  const c1 = ds.bgColor1 || '#0f172a';
  const c2 = ds.bgColor2 || '#1e293b';
  const dist = (ds.bgDistance ?? 100) / 100;  // normalise 0-2
  const focalX = ds.focalX ?? 0.5;
  const focalY = ds.focalY ?? 0.5;

  // Focal point position on the canvas (in pixels)
  const cx = fit.ox + focalX * fit.dw;
  const cy = fit.oy + focalY * fit.dh;

  if (mode === 'color') {
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, w, h);
  } else if (mode === 'linear') {
    const angle = (ds.bgAngle ?? 180) * Math.PI / 180;
    const len = Math.max(w, h) * dist;
    const x0 = cx - Math.sin(angle) * len / 2;
    const y0 = cy - Math.cos(angle) * len / 2;
    const x1 = cx + Math.sin(angle) * len / 2;
    const y1 = cy + Math.cos(angle) * len / 2;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (mode === 'radial') {
    const radius = Math.max(w, h) * dist * 0.6;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

/**
 * Draw source image with cover-fit, placing the subject (focalX/Y) at the
 * target canvas position (targetX/Y). This lets the anchor-aware system
 * place the subject in the "safe zone" away from overlays.
 *
 * @param focalX  0-1  Where the subject is in the source (0 = left, 1 = right)
 * @param focalY  0-1  Where the subject is in the source (0 = top, 1 = bottom)
 * @param targetX 0-1  Where the subject should appear on the canvas (0.5 = center)
 * @param targetY 0-1  Where the subject should appear on the canvas (0.5 = center)
 */
export function drawSource(ctx, w, h, el, focalX = 0.5, focalY = 0.5, targetX = 0.5, targetY = 0.5) {
  const sw = el.videoWidth || el.naturalWidth || el.width || 1;
  const sh = el.videoHeight || el.naturalHeight || el.height || 1;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale, dh = sh * scale;

  // Place the subject (in drawn-image space) at the target canvas position
  let ox = -(focalX * dw - targetX * w);
  let oy = -(focalY * dh - targetY * h);

  // Clamp so no empty space is shown beyond image edges
  if (dw > w) ox = Math.max(-(dw - w), Math.min(0, ox));
  else ox = (w - dw) / 2;
  if (dh > h) oy = Math.max(-(dh - h), Math.min(0, oy));
  else oy = (h - dh) / 2;

  ctx.drawImage(el, ox, oy, dw, dh);
}

/**
 * Compute image scale and offset for cover-fit that keeps as much of the
 * focal area visible as possible.
 *
 * Hard constraint:  canvas is always fully covered (no empty borders).
 * Soft constraint:  the focal area rectangle is fully visible when the
 *                   aspect ratio allows it; otherwise the image is centred
 *                   on the focal area within the available cover-fit range.
 *
 * Returns { scale, ox, oy, dw, dh }.
 */
export function computeFocalFit(w, h, sw, sh, focalX, focalY, focalW, focalH, targetX = 0.5, targetY = 0.5, fitMode = 'cover') {
  // Cover-fit: fills entire canvas (preferred — no gaps)
  const sCover = Math.max(w / sw, h / sh);
  // Focal-fit: shows the entire focal rectangle (may leave small gaps)
  const sFocal = Math.min(w / (focalW * sw), h / (focalH * sh));

  // 'cover': always fill canvas, focal area is best-effort (for photography)
  // 'safe':  zoom out if needed to guarantee full focal area visibility (for PNGs/product shots)
  const scale = fitMode === 'safe'
    ? Math.min(sCover, sFocal)   // may zoom out below cover to show focal area
    : sCover;                     // always cover, focal area is best-effort
  const dw = sw * scale, dh = sh * scale;

  // Focal area edges in drawn-image space
  const fl = (focalX - focalW / 2) * dw;
  const fr = (focalX + focalW / 2) * dw;
  const ft = (focalY - focalH / 2) * dh;
  const fb = (focalY + focalH / 2) * dh;

  // Cover bounds (when image is large enough, no empty space)
  const oxMinCover = dw >= w ? -(dw - w) : (w - dw) / 2;
  const oxMaxCover = dw >= w ? 0 : (w - dw) / 2;
  const oyMinCover = dh >= h ? -(dh - h) : (h - dh) / 2;
  const oyMaxCover = dh >= h ? 0 : (h - dh) / 2;

  // Focal visibility bounds — ensure the entire focal rect stays on screen
  const oxMinFocal = -fl;
  const oxMaxFocal = w - fr;
  const oyMinFocal = -ft;
  const oyMaxFocal = h - fb;

  // Intersect cover + focal constraints
  const oxMin = Math.max(oxMinCover, oxMinFocal);
  const oxMax = Math.min(oxMaxCover, oxMaxFocal);
  const oyMin = Math.max(oyMinCover, oyMinFocal);
  const oyMax = Math.min(oyMaxCover, oyMaxFocal);

  // Ideal offset: place focal centre at target canvas position
  let ox = -(focalX * dw - targetX * w);
  let oy = -(focalY * dh - targetY * h);

  // Clamp: prefer focal visibility, fall back to cover bounds
  if (oxMin <= oxMax) {
    ox = Math.max(oxMin, Math.min(oxMax, ox));
  } else {
    // Focal area wider than view — centre it within cover bounds
    ox = w / 2 - (fl + fr) / 2;
    ox = Math.max(oxMinCover, Math.min(oxMaxCover, ox));
  }

  if (oyMin <= oyMax) {
    oy = Math.max(oyMin, Math.min(oyMax, oy));
  } else {
    // Focal area taller than view — centre it within cover bounds
    oy = h / 2 - (ft + fb) / 2;
    oy = Math.max(oyMinCover, Math.min(oyMaxCover, oy));
  }

  return { scale, ox, oy, dw, dh };
}

export function wrapText(ctx, text, x, y, maxW, lineH, fontSize, maxLines) {
  if (!text) return y;
  maxLines = maxLines || 5;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  for (const l of lines) { ctx.fillText(l, x, y); y += lineH; }
  // Remove trailing line-height space after the last line so curY
  // sits at the visual bottom of the text, not the next-line start.
  if (lines.length > 0) y -= (lineH - (fontSize || lineH));
  return y;
}

export function countLines(ctx, text, font, maxW, maxLines) {
  ctx.font = font;
  const words = text.split(/\s+/).filter(Boolean);
  let lines = 1, line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines++; line = word;
      if (lines >= maxLines) break;
    } else line = test;
  }
  return Math.min(lines, maxLines);
}

export function applyTextShadow(ctx, color, size) {
  // ctx.scale(dpr) also scales shadowBlur — compensate so shadows stay
  // the same visual size regardless of the context transform.
  const t = ctx.getTransform();
  const s = Math.max(t.a, t.d) || 1;
  ctx.shadowColor = color === '#ffffff' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.25)';
  ctx.shadowBlur  = size / s;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1 / s;
}

export function clearShadow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fontStr(weight, size, family) {
  return `${weight} ${size}px "${family}", sans-serif`;
}

export function drawCTA(ctx, cx, cy, text, ds, { fontSize: overrideFontSize, padH: overridePadH, padV: overridePadV } = {}) {
  if (!text) return;
  const padH = overridePadH ?? Math.max(4, ds.ctaPadH);
  const padV = overridePadV ?? Math.max(2, ds.ctaPadV);
  const fontSize = overrideFontSize || Math.max(8, ds.ctaFontSize || 11);
  const font = ds.ctaFont || 'Inter';
  const weight = ds.ctaFontWeight || '600';

  ctx.font = fontStr(weight, fontSize, font);
  const textW = ctx.measureText(text).width;
  const btnW = textW + padH * 2;
  const actualBtnH = fontSize + padV * 2;
  const r = 2 + (ds.ctaRadius / 100) * (actualBtnH * 0.5 - 2);
  const [ar, ag, ab] = hexToRgb(ds.accentColor);
  ctx.fillStyle = `rgb(${ar},${ag},${ab})`;
  roundRect(ctx, cx - btnW / 2, cy - actualBtnH / 2, btnW, actualBtnH, r);
  ctx.fill();
  ctx.fillStyle = ds.ctaTextColor || '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
  return actualBtnH;
}

export function buildOverlayGradient(ctx, w, h, anchor, r, g, b, opa) {
  const ancV = anchor[0], ancH = anchor[1];
  let grad;
  if (ancH === 'l') {
    grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, `rgba(${r},${g},${b},${opa})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${opa * 0.65})`);
    grad.addColorStop(0.85, `rgba(${r},${g},${b},${opa * 0.15})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0.04)`);
  } else if (ancH === 'r') {
    grad = ctx.createLinearGradient(w, 0, 0, 0);
    grad.addColorStop(0, `rgba(${r},${g},${b},${opa})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${opa * 0.65})`);
    grad.addColorStop(0.85, `rgba(${r},${g},${b},${opa * 0.15})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0.04)`);
  } else if (ancV === 't') {
    grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${r},${g},${b},${opa})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${opa * 0.6})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0.04)`);
  } else if (ancV === 'b') {
    grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, `rgba(${r},${g},${b},${opa})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${opa * 0.6})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0.04)`);
  } else {
    grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${r},${g},${b},${opa * 0.35})`);
    grad.addColorStop(0.35, `rgba(${r},${g},${b},${opa * 0.75})`);
    grad.addColorStop(0.65, `rgba(${r},${g},${b},${opa * 0.75})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},${opa * 0.45})`);
  }
  return grad;
}

/**
 * Draw the logo at the specified position.
 * @param {string} position - Direct position code (e.g. 'tr' = top-right).
 *                            The logo is drawn AT this position, no mirroring.
 */
export function drawLogoAnchored(ctx, w, h, logoEl, sizeRatio, position, fmt) {
  if (!logoEl) return;
  const natW = logoEl.naturalWidth || 200;
  const natH = logoEl.naturalHeight || 100;
  const aspect = natW / natH;

  // Logo height as a percentage of the shorter side
  const ref = Math.min(w, h);
  let lh = Math.max(18, ref * sizeRatio);
  let lw = lh * aspect;

  // Clamp so logo never exceeds 35% of canvas width
  if (lw > w * 0.35) {
    lw = w * 0.35;
    lh = lw / aspect;
  }

  const minDim = Math.min(w, h);
  const pad = resolvePadding(minDim, fmt);
  const padH = pad;
  const padV = pad;
  const posV = position[0], posH = position[1];
  // Place at the actual position — no mirroring
  const lx = posH === 'l' ? padH : posH === 'r' ? w - lw - padH : (w - lw) / 2;
  const ly = posV === 't' ? padV : posV === 'b' ? h - lh - padV : (h - lh) / 2;

  // High-quality downscaling for crisp logos at small sizes
  const prevSmoothing = ctx.imageSmoothingQuality;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(logoEl, lx, ly, lw, lh);
  ctx.imageSmoothingQuality = prevSmoothing;
}

// ── Content–subject interference detection ──────────────────────────────────

/**
 * Estimate the content block height as a normalised fraction of the canvas.
 * Approximates text wrapping without requiring a canvas context by assuming
 * an average character width of ~0.55× the font size.
 *
 * @param fmtW           Format width in px
 * @param fmtH           Format height in px
 * @param contentWidth   Content width percentage (20-100)
 * @param contentInfo    { layers, styles, contentScale, ctaScale } — optional
 * @returns              Normalised height (0-1) of the content block
 */
export function estimateContentHeight(fmtW, fmtH, contentWidth, info) {
  if (!info) return 0.45; // conservative fallback

  const { layers, styles, contentScale = 1, ctaScale = 1 } = info;
  if (!layers || !layers.length || !styles) return 0.45;

  const minDim = Math.min(fmtW, fmtH);
  const pad = resolvePadding(minDim, info.fmt);
  const padH = pad;
  const padV = pad;
  const maxW = Math.min(fmtW * (contentWidth / 100), fmtW - padH * 2);

  // Approximate chars per line: avgCharWidth ≈ 0.55 × fontSize
  function approxLines(text, fontSize, maxLines) {
    if (!text) return 0;
    const avgCharW = fontSize * 0.55;
    const charsPerLine = Math.max(1, Math.floor(maxW / avgCharW));
    const rawLines = Math.ceil(text.length / charsPerLine);
    return Math.min(rawLines, maxLines || 3);
  }

  let blockH = 0;
  const active = layers.filter(l => l.value);

  for (let i = 0; i < active.length; i++) {
    const layer = active[i];
    if (layer.type === 'headline') {
      const sz = Math.max(8, Math.round((styles.headlineFontSize || 24) * contentScale));
      const lineH = sz * 1.3;
      const nLines = approxLines(layer.value, sz, 3);
      blockH += lineH * nLines - (lineH - sz);
    } else if (layer.type === 'text') {
      const sz = Math.max(6, Math.round((styles.textFontSize || 14) * contentScale));
      const lineH = sz * 1.5;
      const nLines = approxLines(layer.value, sz, 3);
      blockH += lineH * nLines - (lineH - sz);
    } else if (layer.type === 'cta') {
      const ctaSz = Math.max(6, Math.round((styles.ctaFontSize || 11) * ctaScale));
      const padVCta = Math.max(2, Math.round((styles.ctaPadV || 10) * ctaScale));
      blockH += ctaSz + padVCta * 2;
    }
    if (i < active.length - 1) {
      blockH += Math.max(0, layer.gapAfter ?? 12);
    }
  }

  // Total content extent including padding
  const totalH = blockH + padV * 2;
  return Math.min(totalH / fmtH, 0.95); // cap at 95% — content can't exceed canvas
}

/**
 * Compute the content overlay bounding box on the canvas (normalised 0-1).
 * Uses the actual contentWidth and estimated content height so that
 * narrow/short content doesn't falsely trigger overlap warnings.
 *
 * @param anchor        Two-char anchor string, e.g. 'bl', 'tr', 'cc'
 * @param contentWidth  Content width as percentage (20-100), default 60
 * @param contentH      Normalised content block height (0-1), default 0.45
 */
function contentRect(anchor, contentWidth = 60, contentH = 0.45) {
  const ancV = anchor[0], ancH = anchor[1];
  const pad = 0.07; // matches padH ≈ 7% of canvas
  const cw = Math.min(contentWidth / 100, 1 - pad * 2); // normalised content width

  // Horizontal extent based on anchor + contentWidth
  let x1 = 0, x2 = 1;
  if (ancH === 'l') { x1 = 0; x2 = pad + cw; }
  else if (ancH === 'r') { x1 = 1 - pad - cw; x2 = 1; }
  else { /* center */ x1 = 0.5 - cw / 2; x2 = 0.5 + cw / 2; }

  // Vertical extent based on anchor + estimated content height
  const ch = Math.max(contentH, 0.10); // minimum 10%
  let y1 = 0, y2 = 1;
  if (ancV === 't') { y1 = 0; y2 = ch; }
  else if (ancV === 'b') { y1 = 1 - ch; y2 = 1; }
  else { /* center */ y1 = 0.5 - ch / 2; y2 = 0.5 + ch / 2; }

  return { x1, y1, x2, y2 };
}

/**
 * Compute where the focal area box ends up on the canvas after cover-fit positioning.
 * Returns normalised {x1, y1, x2, y2} on the canvas.
 */
export function focalAreaOnCanvas(canvasW, canvasH, sw, sh, focalX, focalY, focalW, focalH, anchor, contentAware, contentWidth = 60, contentH = 0.45, fitMode = 'cover') {
  const { tx, ty } = contentAware ? safeZoneTarget(anchor, contentWidth, contentH) : { tx: 0.5, ty: 0.5 };
  const fit = computeFocalFit(canvasW, canvasH, sw, sh, focalX, focalY, focalW, focalH, tx, ty, fitMode);

  // Focal area in source coords → canvas coords
  const srcX1 = focalX - focalW / 2;
  const srcY1 = focalY - focalH / 2;
  const srcX2 = focalX + focalW / 2;
  const srcY2 = focalY + focalH / 2;

  return {
    x1: (srcX1 * fit.dw + fit.ox) / canvasW,
    y1: (srcY1 * fit.dh + fit.oy) / canvasH,
    x2: (srcX2 * fit.dw + fit.ox) / canvasW,
    y2: (srcY2 * fit.dh + fit.oy) / canvasH,
  };
}

/** Check if two rectangles overlap; returns overlap area (0 if none) */
function rectOverlap(a, b) {
  const ox = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const oy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  return ox * oy;
}

const ALL_ANCHORS = ['tl', 'tc', 'tr', 'cl', 'cc', 'cr', 'bl', 'bc', 'br'];

/**
 * Detect if the focal area overlaps with the content overlay.
 * Uses rectangle intersection instead of point distance.
 *
 * @param focalW  0-1  Width of the focal area in source coordinates
 * @param focalH  0-1  Height of the focal area in source coordinates
 */
/**
 * @param contentWidth  Content width percentage (20-100)
 * @param contentInfo   { layers, styles, contentScale, ctaScale } — for height estimation
 */
export function detectInterference(fmtW, fmtH, sourceW, sourceH, anchor, focalX, focalY, contentAware, focalW = 0.30, focalH = 0.30, contentWidth = 60, contentInfo = null, fitMode = 'cover') {
  if (!sourceW || !sourceH) return { interferes: false, suggestedAnchor: anchor };

  // Estimate actual content height for accurate vertical overlap detection
  const ch = estimateContentHeight(fmtW, fmtH, contentWidth, contentInfo);

  // Where does the focal area land on the canvas? (now uses computeFocalFit internally)
  const focalRect = focalAreaOnCanvas(fmtW, fmtH, sourceW, sourceH, focalX, focalY, focalW, focalH, anchor, contentAware, contentWidth, ch, fitMode);
  const cRect = contentRect(anchor, contentWidth, ch);
  const overlap = rectOverlap(focalRect, cRect);
  const focalArea = Math.max(0.001, (focalRect.x2 - focalRect.x1) * (focalRect.y2 - focalRect.y1));
  const overlapRatio = overlap / focalArea;

  // Find the anchor that minimises overlap with the focal area
  let bestAnchor = anchor;
  let bestOverlap = 1;
  for (const a of ALL_ANCHORS) {
    const fr = focalAreaOnCanvas(fmtW, fmtH, sourceW, sourceH, focalX, focalY, focalW, focalH, a, contentAware, contentWidth, ch, fitMode);
    // Re-estimate height for each candidate anchor (content width stays the same)
    const cr = contentRect(a, contentWidth, ch);
    const o = rectOverlap(fr, cr);
    const fa = Math.max(0.001, (fr.x2 - fr.x1) * (fr.y2 - fr.y1));
    const ratio = o / fa;
    if (ratio < bestOverlap) { bestOverlap = ratio; bestAnchor = a; }
  }

  // Only warn if there's meaningful overlap AND a better anchor actually exists
  const interferes = overlapRatio > 0.15 && bestOverlap < overlapRatio - 0.05;

  return { interferes, suggestedAnchor: bestAnchor, overlapRatio };
}

/**
 * Resolve which layers are visible for a given format.
 */
function resolveVisibleLayers(fmt, ds) {
  if (fmt.visibleLayers && ds.layers) {
    return ds.layers.filter(l => fmt.visibleLayers.includes(l.id));
  }
  // Legacy fallback
  const result = [];
  if (fmt.showTitle !== false) result.push({ id: 'headline', type: 'headline', value: ds.headline });
  if (fmt.showText !== false) result.push({ id: 'text', type: 'text', value: ds.cta });
  if (fmt.showCta !== false) result.push({ id: 'cta', type: 'cta', value: ds.cta });
  return result;
}

/**
 * Compute where the subject should appear on the canvas ("safe zone")
 * based on the content anchor and actual content dimensions.
 * The overlay/text covers the anchor side, so the subject should sit
 * on the opposite side — but only offset proportionally to content size.
 *
 * @param anchor        Two-char anchor string
 * @param contentWidth  Content width percentage (20-100), default 60
 * @param contentH      Normalised content height (0-1), default 0.45
 * @returns             { tx, ty } — target canvas position (0-1) for the subject
 */
function safeZoneTarget(anchor, contentWidth = 60, contentH = 0.45) {
  const ancV = anchor[0], ancH = anchor[1];
  const cw = contentWidth / 100;

  // Place subject in the centre of the remaining free space
  // e.g. content 40% left → free space is 40%-100% → centre at 0.70
  let tx = 0.5;
  if (ancH === 'l') tx = cw + (1 - cw) / 2;        // centre of right free space
  else if (ancH === 'r') tx = (1 - cw) / 2;          // centre of left free space

  let ty = 0.5;
  if (ancV === 't') ty = contentH + (1 - contentH) / 2;
  else if (ancV === 'b') ty = (1 - contentH) / 2;

  return { tx, ty };
}

/**
 * Draw a group of layers at a specific anchor position.
 * This is the core text/CTA rendering loop, parameterized by anchor so that
 * per-layer anchor overrides can place different layers in different corners.
 */
function drawLayerGroup(ctx, w, h, layers, groupAnchor, ds, fmt, typo) {
  if (!layers.length) return;

  const { hlFont, hlSize, hlWeight, hlColor, txtFont, txtSize, txtWeight, txtColor,
          ctaFontSize, fixedPadV, fixedPadHScaled, actualBtnH, padH, padV, maxW } = typo;

  const ancV = groupAnchor[0], ancH = groupAnchor[1];
  const textAlign = ancH === 'l' ? 'left' : ancH === 'r' ? 'right' : 'center';
  const textX = ancH === 'l' ? padH : ancH === 'r' ? w - padH : w / 2;

  // Measure total block height for this group
  let blockH = 0;
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const text = layer.value;
    if (layer.type === 'headline') {
      const lineH = hlSize * 1.3;
      const nLines = countLines(ctx, text, fontStr(hlWeight, hlSize, hlFont), maxW, 3);
      blockH += lineH * nLines - (lineH - hlSize);
    } else if (layer.type === 'text') {
      const lineH = txtSize * 1.5;
      const nLines = countLines(ctx, text, fontStr(txtWeight, txtSize, txtFont), maxW, 3);
      blockH += lineH * nLines - (lineH - txtSize);
    } else if (layer.type === 'cta') {
      blockH += actualBtnH;
    }
    if (i < layers.length - 1) {
      blockH += Math.max(0, layer.gapAfter ?? 12);
    }
  }

  let startY;
  if (ancV === 't')      startY = padV;
  else if (ancV === 'b') startY = h - padV - blockH;
  else                   startY = (h - blockH) / 2;

  let curY = Math.min(Math.max(padV, startY), h - padV - blockH);

  ctx.textAlign    = textAlign;
  ctx.textBaseline = 'top';

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const text = layer.value;

    if (i > 0) curY += Math.max(0, layers[i - 1].gapAfter ?? 12);

    if (layer.type === 'headline') {
      ctx.font      = fontStr(hlWeight, hlSize, hlFont);
      ctx.fillStyle = hlColor;
      applyTextShadow(ctx, hlColor, hlSize * 0.55);
      curY = wrapText(ctx, text, textX, curY, maxW, hlSize * 1.3, hlSize, 3);
      clearShadow(ctx);
    } else if (layer.type === 'text') {
      ctx.font         = fontStr(txtWeight, txtSize, txtFont);
      ctx.fillStyle    = txtColor;
      ctx.globalAlpha  = 0.85;
      applyTextShadow(ctx, txtColor, txtSize * 0.45);
      curY = wrapText(ctx, text, textX, curY, maxW, txtSize * 1.5, txtSize, 3);
      clearShadow(ctx);
      ctx.globalAlpha  = 1;
    } else if (layer.type === 'cta') {
      const ctaFont = ds.ctaFont || 'Inter';
      const ctaWeight = ds.ctaFontWeight || '600';
      ctx.font = fontStr(ctaWeight, ctaFontSize, ctaFont);
      const tw = ctx.measureText(text).width;
      const btnW = tw + fixedPadHScaled * 2;
      let ctaCX;
      if (ancH === 'l')      ctaCX = padH + btnW / 2;
      else if (ancH === 'r') ctaCX = w - padH - btnW / 2;
      else                   ctaCX = w / 2;
      const ctaCY = curY + actualBtnH / 2;
      ctx.textAlign = 'center';
      drawCTA(ctx, ctaCX, ctaCY, text, ds, { fontSize: ctaFontSize, padH: fixedPadHScaled, padV: fixedPadV });
      ctx.textAlign    = textAlign;
      ctx.textBaseline = 'top';
      curY += actualBtnH;
    }
  }
}

export function drawTemplate(ctx, w, h, fmt, ds) {
  if (!ds.el) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const anchor = fmt.anchor || 'bl';
  const el = ds.el;
  const isVideo = !!el.videoWidth;
  const sw = el.videoWidth || el.naturalWidth || el.width || 1;
  const sh = el.videoHeight || el.naturalHeight || el.height || 1;
  const focalX = ds.focalX ?? 0.5;
  const focalY = ds.focalY ?? 0.5;
  const focalW = ds.focalW ?? 0.30;
  const focalH = ds.focalH ?? 0.30;

  // Estimate content dimensions for content-aware focal positioning
  // (uses format-level anchor for focal targeting — per-layer anchors are refinements)
  const cwPct = fmt.contentWidth ?? 60;
  const contentInfo = {
    layers: resolveVisibleLayers(fmt, ds).filter(l => l.value),
    styles: ds,
    contentScale: fmt.contentScale || 1,
    ctaScale: fmt.ctaScale || 1,
    fmt,
  };
  const estContentH = estimateContentHeight(w, h, cwPct, contentInfo);

  let fit;
  if (isVideo) {
    const scale = Math.max(w / sw, h / sh);
    const dw = sw * scale, dh = sh * scale;
    const ox = (w - dw) / 2;
    const oy = (h - dh) / 2;
    fit = { scale, ox, oy, dw, dh };
  } else {
    const aware = ds.contentAwareFocal !== false;
    const { tx, ty } = aware ? safeZoneTarget(anchor, cwPct, estContentH) : { tx: 0.5, ty: 0.5 };
    const fitMode = ds.focalFit || 'cover';
    fit = computeFocalFit(w, h, sw, sh, focalX, focalY, focalW, focalH, tx, ty, fitMode);
  }

  // Background layer
  const hasBg = ds.bgMode && ds.bgMode !== 'none';
  if (hasBg) {
    drawBackground(ctx, w, h, ds, fit);
  }

  const [r, g, b] = hexToRgb(ds.overlayColor);
  if (!hasBg && (fit.dw < w || fit.dh < h)) {
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.drawImage(el, fit.ox, fit.oy, fit.dw, fit.dh);

  // Overlay gradient (uses format-level anchor for gradient direction)
  const grad = buildOverlayGradient(ctx, w, h, anchor, r, g, b, ds.overlayOpacity);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // ── Precompute shared typography metrics ──────────────────────────
  const userScale = fmt.contentScale || 1;
  const ctaUserScale = fmt.ctaScale || 1;
  const minDim = Math.min(w, h);

  const typo = {
    hlFont: ds.headlineFont || 'Inter',
    hlSize: Math.max(8, Math.round((ds.headlineFontSize || 24) * userScale)),
    hlWeight: ds.headlineFontWeight || '700',
    hlColor: ds.headlineColor || '#ffffff',
    txtFont: ds.textFont || 'Inter',
    txtSize: Math.max(6, Math.round((ds.textFontSize || 14) * userScale)),
    txtWeight: ds.textFontWeight || '400',
    txtColor: ds.textColor || '#ffffff',
    ctaFontSize: Math.max(6, Math.round((ds.ctaFontSize || 11) * ctaUserScale)),
    fixedPadV: Math.max(2, Math.round(ds.ctaPadV * ctaUserScale)),
    fixedPadHScaled: Math.max(4, Math.round(ds.ctaPadH * ctaUserScale)),
    actualBtnH: 0,
    padH: resolvePadding(minDim, fmt),
    padV: resolvePadding(minDim, fmt),
    maxW: Math.min(w * ((fmt.contentWidth ?? 60) / 100), w - resolvePadding(minDim, fmt) * 2),
  };
  typo.actualBtnH = typo.ctaFontSize + typo.fixedPadV * 2;

  // ── Resolve visible layers and group by effective anchor ──────────
  const visibleLayers = resolveVisibleLayers(fmt, ds);
  const activeItems = visibleLayers.filter(l => l.value);
  const layerAnchors = fmt.layerAnchors || {};

  // Group layers by their effective anchor (preserving order within each group)
  const groups = {};
  for (const layer of activeItems) {
    const eff = layerAnchors[layer.id] || anchor;
    (groups[eff] ||= []).push(layer);
  }

  // Draw each anchor group independently
  for (const [groupAnchor, groupLayers] of Object.entries(groups)) {
    drawLayerGroup(ctx, w, h, groupLayers, groupAnchor, ds, fmt, typo);
  }

  // Logo — use explicit logoAnchor if set, otherwise auto-pick the best free corner
  if (ds.logo && fmt.logoSize > 0) {
    let logoPos = fmt.logoAnchor;
    if (!logoPos) {
      // Collect all corners occupied by content layers
      const occupied = new Set(Object.keys(groups));
      // Mirror the group anchor to get the default opposite corner
      const mirrorV = anchor[0] === 'b' ? 't' : 'b';
      const mirrorH = anchor[1] === 'l' ? 'r' : anchor[1] === 'r' ? 'l' : anchor[1];
      const preferred = mirrorV + mirrorH;
      // Candidate corners ordered by preference (opposite side first)
      const candidates = [preferred, mirrorV + 'l', mirrorV + 'r', mirrorV + 'c', 'tl', 'tr', 'tc', 'bl', 'br', 'bc'];
      logoPos = candidates.find(c => !occupied.has(c)) || preferred;
    }
    drawLogoAnchored(ctx, w, h, ds.logo, fmt.logoSize, logoPos, fmt);
  }
}
