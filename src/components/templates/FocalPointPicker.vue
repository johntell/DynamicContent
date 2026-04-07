<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  sourceUrl: { type: String, default: '' },
  focalX: { type: Number, default: 0.5 },
  focalY: { type: Number, default: 0.5 },
  focalW: { type: Number, default: 0.30 },
  focalH: { type: Number, default: 0.30 },
});

const emit = defineEmits(['update:focalX', 'update:focalY', 'update:focalW', 'update:focalH']);

const containerRef = ref(null);
const imgLoaded = ref(false);
const natW = ref(1600);
const natH = ref(1000);

// Interaction state
const dragging = ref(false);
const dragMode = ref(null); // 'move' | 'nw' | 'ne' | 'sw' | 'se'
const dragStart = ref({ mx: 0, my: 0, ox: 0, oy: 0, ow: 0, oh: 0 });

// ── Contain-fit image area tracking ─────────────────────────────
// When max-height constrains the container, the image may be pillarboxed.
// All overlay positioning and pointer mapping must be relative to the
// actual visible image area, not the full container.

const containerW = ref(300);
const containerH = ref(200);

/** Where the image actually displays within the container (contain-fit) */
const imgArea = computed(() => {
  const cw = containerW.value;
  const ch = containerH.value;
  const imgAspect = natW.value / natH.value;
  const containerAspect = cw / ch;

  let iw, ih, ix, iy;
  if (containerAspect > imgAspect) {
    // Container wider than image — pillarboxed (bars on sides)
    ih = ch;
    iw = ch * imgAspect;
    ix = (cw - iw) / 2;
    iy = 0;
  } else {
    // Container taller than image — letterboxed (bars top/bottom)
    iw = cw;
    ih = cw / imgAspect;
    ix = 0;
    iy = (ch - ih) / 2;
  }
  return { x: ix, y: iy, w: iw, h: ih };
});

/** CSS style for the overlay wrapper that matches the visible image area */
const imgAreaStyle = computed(() => {
  const a = imgArea.value;
  return {
    left: a.x + 'px',
    top: a.y + 'px',
    width: a.w + 'px',
    height: a.h + 'px',
  };
});

// Box edges as percentages (of the image area)
const boxLeft   = computed(() => ((props.focalX - props.focalW / 2) * 100) + '%');
const boxTop    = computed(() => ((props.focalY - props.focalH / 2) * 100) + '%');
const boxWidth  = computed(() => (props.focalW * 100) + '%');
const boxHeight = computed(() => (props.focalH * 100) + '%');

// Center crosshair within box
const crossX = computed(() => (props.focalX * 100) + '%');
const crossY = computed(() => (props.focalY * 100) + '%');

const aspectStyle = computed(() => ({ aspectRatio: natW.value / natH.value }));

function measureContainer() {
  const el = containerRef.value;
  if (!el) return;
  containerW.value = el.clientWidth;
  containerH.value = el.clientHeight;
}

let _resizeObs = null;
onMounted(() => {
  measureContainer();
  if (window.ResizeObserver && containerRef.value) {
    _resizeObs = new ResizeObserver(() => measureContainer());
    _resizeObs.observe(containerRef.value);
  }
});
onUnmounted(() => {
  _resizeObs?.disconnect();
});

function onImgLoad(e) {
  imgLoaded.value = true;
  const img = e.target;
  if (img.naturalWidth && img.naturalHeight) {
    natW.value = img.naturalWidth;
    natH.value = img.naturalHeight;
  }
  measureContainer();
}

watch(() => props.sourceUrl, () => { imgLoaded.value = false; });

/**
 * Map a pointer event to normalised 0-1 coordinates within the visible
 * image area (not the container). This ensures correct coordinates even
 * when the image is pillarboxed or letterboxed by object-fit: contain.
 */
function getNormPos(e) {
  const el = containerRef.value;
  if (!el) return { nx: 0.5, ny: 0.5 };
  const rect = el.getBoundingClientRect();
  const bL = parseFloat(getComputedStyle(el).borderLeftWidth) || 0;
  const bT = parseFloat(getComputedStyle(el).borderTopWidth) || 0;
  const a = imgArea.value;
  return {
    nx: Math.max(0, Math.min(1, (e.clientX - rect.left - bL - a.x) / a.w)),
    ny: Math.max(0, Math.min(1, (e.clientY - rect.top - bT - a.y) / a.h)),
  };
}

const MIN_SIZE = 0.08; // minimum box dimension (8% of image)

function clampBox(x, y, w, h) {
  w = Math.max(MIN_SIZE, Math.min(1, w));
  h = Math.max(MIN_SIZE, Math.min(1, h));
  x = Math.max(w / 2, Math.min(1 - w / 2, x));
  y = Math.max(h / 2, Math.min(1 - h / 2, y));
  return { x: r(x), y: r(y), w: r(w), h: r(h) };
}

function r(v) { return Math.round(v * 1000) / 1000; }

function emitBox(x, y, w, h) {
  const c = clampBox(x, y, w, h);
  emit('update:focalX', c.x);
  emit('update:focalY', c.y);
  emit('update:focalW', c.w);
  emit('update:focalH', c.h);
}

function hitTest(e) {
  const { nx, ny } = getNormPos(e);
  const x1 = props.focalX - props.focalW / 2;
  const y1 = props.focalY - props.focalH / 2;
  const x2 = x1 + props.focalW;
  const y2 = y1 + props.focalH;

  const a = imgArea.value;
  const pxThresh = a.w > 0 ? 12 / Math.min(a.w, a.h) : 0.04;

  // Check corners first
  if (Math.abs(nx - x1) < pxThresh && Math.abs(ny - y1) < pxThresh) return 'nw';
  if (Math.abs(nx - x2) < pxThresh && Math.abs(ny - y1) < pxThresh) return 'ne';
  if (Math.abs(nx - x1) < pxThresh && Math.abs(ny - y2) < pxThresh) return 'sw';
  if (Math.abs(nx - x2) < pxThresh && Math.abs(ny - y2) < pxThresh) return 'se';

  // Inside box → move
  if (nx >= x1 && nx <= x2 && ny >= y1 && ny <= y2) return 'move';

  // Outside → reposition center
  return 'reposition';
}

function onPointerDown(e) {
  e.preventDefault();
  const mode = hitTest(e);
  const { nx, ny } = getNormPos(e);

  if (mode === 'reposition') {
    // Move box center to click position
    emitBox(nx, ny, props.focalW, props.focalH);
    dragMode.value = 'move';
  } else {
    dragMode.value = mode;
  }

  dragging.value = true;
  dragStart.value = {
    mx: nx, my: ny,
    ox: props.focalX, oy: props.focalY,
    ow: props.focalW, oh: props.focalH,
  };

  try { containerRef.value?.setPointerCapture(e.pointerId); } catch {}
}

function onPointerMove(e) {
  if (!dragging.value) {
    // Update cursor based on hover
    const mode = hitTest(e);
    const el = containerRef.value;
    if (!el) return;
    if (mode === 'nw' || mode === 'se') el.style.cursor = 'nwse-resize';
    else if (mode === 'ne' || mode === 'sw') el.style.cursor = 'nesw-resize';
    else if (mode === 'move') el.style.cursor = 'move';
    else el.style.cursor = 'crosshair';
    return;
  }

  const { nx, ny } = getNormPos(e);
  const { mx, my, ox, oy, ow, oh } = dragStart.value;
  const dx = nx - mx;
  const dy = ny - my;

  if (dragMode.value === 'move') {
    emitBox(ox + dx, oy + dy, ow, oh);
  } else if (dragMode.value === 'nw') {
    // Top-left corner: anchor is bottom-right
    const anchorR = ox + ow / 2;
    const anchorB = oy + oh / 2;
    const newLeft = Math.min(anchorR - MIN_SIZE, (ox - ow / 2) + dx);
    const newTop = Math.min(anchorB - MIN_SIZE, (oy - oh / 2) + dy);
    const newW = anchorR - newLeft;
    const newH = anchorB - newTop;
    emitBox(newLeft + newW / 2, newTop + newH / 2, newW, newH);
  } else if (dragMode.value === 'ne') {
    const anchorL = ox - ow / 2;
    const anchorB = oy + oh / 2;
    const newRight = Math.max(anchorL + MIN_SIZE, (ox + ow / 2) + dx);
    const newTop = Math.min(anchorB - MIN_SIZE, (oy - oh / 2) + dy);
    const newW = newRight - anchorL;
    const newH = anchorB - newTop;
    emitBox(anchorL + newW / 2, newTop + newH / 2, newW, newH);
  } else if (dragMode.value === 'sw') {
    const anchorR = ox + ow / 2;
    const anchorT = oy - oh / 2;
    const newLeft = Math.min(anchorR - MIN_SIZE, (ox - ow / 2) + dx);
    const newBottom = Math.max(anchorT + MIN_SIZE, (oy + oh / 2) + dy);
    const newW = anchorR - newLeft;
    const newH = newBottom - anchorT;
    emitBox(newLeft + newW / 2, anchorT + newH / 2, newW, newH);
  } else if (dragMode.value === 'se') {
    const anchorL = ox - ow / 2;
    const anchorT = oy - oh / 2;
    const newRight = Math.max(anchorL + MIN_SIZE, (ox + ow / 2) + dx);
    const newBottom = Math.max(anchorT + MIN_SIZE, (oy + oh / 2) + dy);
    const newW = newRight - anchorL;
    const newH = newBottom - anchorT;
    emitBox(anchorL + newW / 2, anchorT + newH / 2, newW, newH);
  }
}

function onPointerUp(e) {
  dragging.value = false;
  dragMode.value = null;
  try { containerRef.value?.releasePointerCapture(e.pointerId); } catch {}
}
</script>

<template>
  <div
    ref="containerRef"
    class="fp-picker"
    :class="{ dragging }"
    :style="aspectStyle"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <img
      v-if="sourceUrl"
      :src="sourceUrl"
      class="fp-img"
      crossorigin="anonymous"
      @load="onImgLoad"
      draggable="false"
    >
    <div v-if="!sourceUrl || !imgLoaded" class="fp-placeholder">No image</div>

    <!-- All overlays sit inside a wrapper that exactly matches the visible
         image area (accounting for object-fit: contain pillarboxing). -->
    <div v-if="imgLoaded" class="fp-img-area" :style="imgAreaStyle">
      <!-- Dimmed overlay outside the focal area -->
      <div class="fp-dim fp-dim-top"    :style="{ height: boxTop }"></div>
      <div class="fp-dim fp-dim-bottom" :style="{ top: `calc(${boxTop} + ${boxHeight})`, height: `calc(100% - ${boxTop} - ${boxHeight})` }"></div>
      <div class="fp-dim fp-dim-left"   :style="{ top: boxTop, height: boxHeight, width: boxLeft }"></div>
      <div class="fp-dim fp-dim-right"  :style="{ top: boxTop, height: boxHeight, left: `calc(${boxLeft} + ${boxWidth})`, width: `calc(100% - ${boxLeft} - ${boxWidth})` }"></div>

      <!-- Focal area box -->
      <div class="fp-box" :style="{ left: boxLeft, top: boxTop, width: boxWidth, height: boxHeight }">
        <!-- Corner handles -->
        <div class="fp-handle fp-handle-nw"></div>
        <div class="fp-handle fp-handle-ne"></div>
        <div class="fp-handle fp-handle-sw"></div>
        <div class="fp-handle fp-handle-se"></div>
      </div>

      <!-- Center crosshair (always at focal center) -->
      <div class="fp-crosshair" :style="{ left: crossX, top: crossY }">
        <div class="fp-line fp-line-h"></div>
        <div class="fp-line fp-line-v"></div>
        <div class="fp-dot"></div>
      </div>

      <!-- Subtle grid overlay for visual reference -->
      <div class="fp-grid">
        <div class="fp-grid-line fp-grid-v1"></div>
        <div class="fp-grid-line fp-grid-v2"></div>
        <div class="fp-grid-line fp-grid-h1"></div>
        <div class="fp-grid-line fp-grid-h2"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fp-picker {
  position: relative;
  width: 100%;
  max-height: 260px;
  border-radius: 6px;
  overflow: hidden;
  cursor: crosshair;
  background: #1e293b;
  border: 1.5px solid var(--border);
  user-select: none;
  touch-action: none;
}

.fp-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  background: #0f172a;
}

.fp-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #64748b;
}

/* ── Image-area wrapper — matches object-fit:contain visible area ── */
.fp-img-area {
  position: absolute;
  pointer-events: none;
  z-index: 0;
}

/* ── Dimmed overlay outside focal area ── */
.fp-dim {
  position: absolute;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
  z-index: 1;
}
.fp-dim-top    { top: 0; left: 0; right: 0; }
.fp-dim-bottom { left: 0; right: 0; }
.fp-dim-left   { left: 0; }
.fp-dim-right  {}

/* ── Focal area box ── */
.fp-box {
  position: absolute;
  border: 1.5px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
  z-index: 2;
  pointer-events: none;
}

/* Corner handles */
.fp-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fff;
  border: 1.5px solid rgba(99, 102, 241, 0.9);
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  pointer-events: none; /* hit-testing is done via JS */
}
.fp-handle-nw { top: -5px; left: -5px; }
.fp-handle-ne { top: -5px; right: -5px; }
.fp-handle-sw { bottom: -5px; left: -5px; }
.fp-handle-se { bottom: -5px; right: -5px; }

/* ── Rule-of-thirds grid ── */
.fp-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 1;
}
.fp-picker:hover .fp-grid,
.fp-picker.dragging .fp-grid { opacity: 1; }

.fp-grid-line {
  position: absolute;
  background: rgba(255,255,255,0.12);
}
.fp-grid-v1 { left: 33.33%; top: 0; bottom: 0; width: 1px; }
.fp-grid-v2 { left: 66.66%; top: 0; bottom: 0; width: 1px; }
.fp-grid-h1 { top: 33.33%; left: 0; right: 0; height: 1px; }
.fp-grid-h2 { top: 66.66%; left: 0; right: 0; height: 1px; }

/* ── Center crosshair ── */
.fp-crosshair {
  position: absolute;
  pointer-events: none;
  transform: translate(-50%, -50%);
  z-index: 3;
}

.fp-line {
  position: absolute;
  background: rgba(255,255,255,0.55);
}
.fp-line-h {
  width: 16px;
  height: 1px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.fp-line-v {
  width: 1px;
  height: 16px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.fp-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid #fff;
  background: rgba(99, 102, 241, 0.8);
  box-shadow: 0 0 4px rgba(0,0,0,0.5);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
