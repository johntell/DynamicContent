<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted, defineExpose } from 'vue';
import { drawTemplate, focalAreaOnCanvas, estimateContentHeight } from '../../composables/useTemplateRenderer.js';

const props = defineProps({
  format: { type: Object, required: true },
  drawState: { type: Object, required: true },
  croppedEl: { type: [Object, null], default: null },
  sourceType: { type: String, default: 'image' },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits(['export']);

const canvasRef = ref(null);
let _renderQueued = false;

function render() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const bw = props.format.w;
  const bh = props.format.h;
  if (!bw || !bh) return;

  // On HiDPI screens the browser stretches the canvas buffer across more
  // device pixels than it contains, causing blurry text/shapes.
  // Fix: make the buffer match the device resolution, then use CSS to
  // keep the element at its logical size.  All draw calls stay in logical
  // coordinates thanks to ctx.scale().
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = bw * dpr;
  canvas.height = bh * dpr;
  // Exact pixel CSS size — avoids fractional rounding from width:100%
  canvas.style.width  = bw + 'px';
  canvas.style.height = bh + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const usesCrop = !!props.croppedEl;
  const ds = {
    ...props.drawState,
    el: props.croppedEl || props.drawState.el,
    focalX: usesCrop ? 0.5 : props.drawState.focalX ?? 0.5,
    focalY: usesCrop ? 0.5 : props.drawState.focalY ?? 0.5,
  };
  drawTemplate(ctx, bw, bh, props.format, ds);
}

function queueRender() {
  if (_renderQueued) return;
  _renderQueued = true;
  requestAnimationFrame(() => {
    _renderQueued = false;
    render();
  });
}

// Re-render when draw inputs change
watch(
  () => [props.drawState, props.croppedEl, props.format],
  () => { queueRender(); },
  { deep: true }
);

onMounted(() => {
  nextTick(() => {
    requestAnimationFrame(() => render());
  });
});

// Focal area overlay (normalised rect for CSS positioning)
// Must mirror the exact same parameters used in drawTemplate() so the overlay
// matches the actual image placement on the canvas.
const focalOverlay = computed(() => {
  const ds = props.drawState;
  const el = ds.el;
  if (!el || props.croppedEl) return null;
  if (ds.focalW == null || ds.focalH == null) return null;

  const sw = el.naturalWidth || el.width || 0;
  const sh = el.naturalHeight || el.height || 0;
  if (!sw || !sh) return null;

  const fmt = props.format;
  const anchor = fmt.anchor || 'bl';
  const cwPct = fmt.contentWidth ?? 60;
  const contentAware = ds.contentAwareFocal !== false;
  const fitMode = ds.focalFit || 'cover';

  // Build the same contentInfo that drawTemplate uses for height estimation
  const layers = (ds.layers || []).filter(l => {
    if (!fmt.visibleLayers) return true;
    return fmt.visibleLayers.includes(l.id);
  }).filter(l => l.value);

  const contentInfo = {
    layers,
    styles: ds,
    contentScale: fmt.contentScale || 1,
    ctaScale: fmt.ctaScale || 1,
    fmt,
  };
  const estContentH = estimateContentHeight(fmt.w, fmt.h, cwPct, contentInfo);

  const r = focalAreaOnCanvas(
    fmt.w, fmt.h, sw, sh,
    ds.focalX ?? 0.5, ds.focalY ?? 0.5,
    ds.focalW, ds.focalH,
    anchor, contentAware, cwPct, estContentH, fitMode,
  );

  return {
    left: (r.x1 * 100) + '%',
    top: (r.y1 * 100) + '%',
    width: ((r.x2 - r.x1) * 100) + '%',
    height: ((r.y2 - r.y1) * 100) + '%',
  };
});

defineExpose({ render, canvasRef });
</script>

<template>
  <div class="format-card" :class="{ selected }">
    <div class="canvas-wrap">
      <canvas
        ref="canvasRef"
        class="format-canvas"
      />
      <!-- Focal area overlay -->
      <div v-if="focalOverlay" class="focal-area-overlay" :style="focalOverlay"></div>
      <div v-if="sourceType === 'video'" class="video-live-badge">
        <div class="video-live-dot"></div> LIVE
      </div>
    </div>
    <!-- Label below card -->
    <div class="card-label-bar">
      <span class="card-format-name">{{ format.label }}</span>
      <span class="card-format-dims">{{ format.w }} &times; {{ format.h }}</span>
    </div>
  </div>
</template>

<style scoped>
.format-card {
  border-radius: 6px;
  overflow: visible;
  width: 100%;
  height: 100%;
  position: relative;
}

.canvas-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  line-height: 0;
  overflow: hidden;
  border-radius: 6px;
  background: #1e293b;
  box-shadow: 0 2px 10px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.07);
  transition: box-shadow 0.15s;
}
.format-card.selected .canvas-wrap {
  box-shadow: 0 0 0 2px #6366f1, 0 4px 20px rgba(99,102,241,0.25);
}
.format-card:hover .canvas-wrap {
  box-shadow: 0 10px 30px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.10);
}
.format-card.selected:hover .canvas-wrap {
  box-shadow: 0 0 0 2px #6366f1, 0 10px 30px rgba(99,102,241,0.25);
}

.format-canvas { display: block; }

/* Label bar — sits below the card like Figma */
.card-label-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 2px 0;
  pointer-events: none;
}
.card-format-name {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-format-dims {
  font-size: 10px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Focal area overlay */
.focal-area-overlay {
  position: absolute;
  box-sizing: border-box;
  border: 1.5px dashed rgba(255, 255, 255, 0.35);
  border-radius: 2px;
  pointer-events: none;
  z-index: 1;
  opacity: 0;
  transition: opacity 0.2s;
}
.format-card:hover .focal-area-overlay { opacity: 1; }

/* Video live badge */
.video-live-badge {
  position: absolute;
  top: 8px; left: 8px;
  background: rgba(239,68,68,0.9);
  color: white;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.07em;
  padding: 3px 7px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 4;
  backdrop-filter: blur(4px);
}
.video-live-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: white;
  animation: blink 1s infinite;
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
</style>
