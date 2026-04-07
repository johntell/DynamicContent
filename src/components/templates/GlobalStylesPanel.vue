<script setup>
import { useTemplateBuilderStore } from '../../stores/templateBuilder.js';
import { FONT_LIST, loadFont, hasWeight, nearestWeight } from '../../composables/useGoogleFonts.js';

const store = useTemplateBuilderStore();

// Font change handler — load font, then auto-correct weight if the new font
// doesn't support the currently selected weight.
async function setFont(styleKey, family) {
  await loadFont(family);
  store.styles[styleKey] = family;
  // Auto-fallback weight to nearest available
  const weightKey = styleKey.replace('Font', 'FontWeight');
  const currentWeight = store.styles[weightKey] || '400';
  const best = nearestWeight(family, currentWeight);
  if (best !== currentWeight) {
    store.styles[weightKey] = best;
  }
}

// Check if a weight button should be disabled for a given font style key
function isWeightDisabled(styleKey, weight) {
  const font = store.styles[styleKey];
  return !hasWeight(font, weight);
}

// CTA pill preview
function pillStyle() {
  const r = 2 + (store.styles.ctaRadius / 100) * 18;
  return {
    padding: `${store.styles.ctaPadV}px ${store.styles.ctaPadH}px`,
    background: store.styles.accentColor,
    color: store.styles.ctaTextColor,
    borderRadius: r + 'px',
    fontSize: (store.styles.ctaFontSize || 11) + 'px',
    fontWeight: store.styles.ctaFontWeight || '600',
    fontFamily: `"${store.styles.ctaFont || 'Inter'}", sans-serif`,
  };
}

// Font weight options
const WEIGHT_OPTIONS = [
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '600', label: 'Semi' },
  { value: '700', label: 'Bold' },
  { value: '900', label: 'Black' },
];
</script>

<template>
  <div class="gsp">
    <!-- ─── Headline Style ──────────────────────────────── -->
    <section class="gsp-section">
      <div class="gsp-card">
        <div class="gsp-card-head">
          <span class="gsp-badge hl">H</span>
          <span class="gsp-card-title">Headline</span>
        </div>
        <div class="gsp-card-body">
          <div class="gsp-row">
            <select class="gsp-select gsp-font-select" :value="store.styles.headlineFont" @change="setFont('headlineFont', $event.target.value)">
              <option v-for="f in FONT_LIST" :key="f" :value="f">{{ f }}</option>
            </select>
          </div>
          <div class="gsp-row gsp-row-tight">
            <div class="gsp-field-num">
              <input type="number" min="8" max="120" :value="store.styles.headlineFontSize" @input="store.styles.headlineFontSize = parseInt($event.target.value) || 24">
              <span class="gsp-unit">px</span>
            </div>
            <div class="gsp-color-pick">
              <input type="color" :value="store.styles.headlineColor" @input="store.styles.headlineColor = $event.target.value">
              <span class="gsp-hex">{{ store.styles.headlineColor }}</span>
            </div>
          </div>
          <div class="gsp-row">
            <div class="gsp-weight-seg">
              <button v-for="w in WEIGHT_OPTIONS" :key="w.value" class="gsp-wt" :class="{ active: store.styles.headlineFontWeight === w.value }" :disabled="isWeightDisabled('headlineFont', w.value)" @click="store.styles.headlineFontWeight = w.value" :title="w.label">{{ w.label }}</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ─── Text Style ──────────────────────────────────── -->
    <section class="gsp-section">
      <div class="gsp-card">
        <div class="gsp-card-head">
          <span class="gsp-badge txt">T</span>
          <span class="gsp-card-title">Body Text</span>
        </div>
        <div class="gsp-card-body">
          <div class="gsp-row">
            <select class="gsp-select gsp-font-select" :value="store.styles.textFont" @change="setFont('textFont', $event.target.value)">
              <option v-for="f in FONT_LIST" :key="f" :value="f">{{ f }}</option>
            </select>
          </div>
          <div class="gsp-row gsp-row-tight">
            <div class="gsp-field-num">
              <input type="number" min="8" max="80" :value="store.styles.textFontSize" @input="store.styles.textFontSize = parseInt($event.target.value) || 14">
              <span class="gsp-unit">px</span>
            </div>
            <div class="gsp-color-pick">
              <input type="color" :value="store.styles.textColor" @input="store.styles.textColor = $event.target.value">
              <span class="gsp-hex">{{ store.styles.textColor }}</span>
            </div>
          </div>
          <div class="gsp-row">
            <div class="gsp-weight-seg">
              <button v-for="w in WEIGHT_OPTIONS" :key="w.value" class="gsp-wt" :class="{ active: store.styles.textFontWeight === w.value }" :disabled="isWeightDisabled('textFont', w.value)" @click="store.styles.textFontWeight = w.value" :title="w.label">{{ w.label }}</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ─── CTA Style ───────────────────────────────────── -->
    <section class="gsp-section">
      <div class="gsp-card">
        <div class="gsp-card-head">
          <span class="gsp-badge cta">C</span>
          <span class="gsp-card-title">CTA Button</span>
        </div>
        <div class="gsp-card-body">
          <div class="gsp-row gsp-row-tight">
            <select class="gsp-select gsp-font-select" style="flex:1;min-width:0" :value="store.styles.ctaFont" @change="setFont('ctaFont', $event.target.value)">
              <option v-for="f in FONT_LIST" :key="f" :value="f">{{ f }}</option>
            </select>
            <div class="gsp-field-num">
              <input type="number" min="6" max="60" :value="store.styles.ctaFontSize" @input="store.styles.ctaFontSize = parseInt($event.target.value) || 11">
              <span class="gsp-unit">px</span>
            </div>
          </div>
          <div class="gsp-row gsp-color-pair">
            <div class="gsp-color-pick" title="Text colour">
              <input type="color" :value="store.styles.ctaTextColor" @input="store.styles.ctaTextColor = $event.target.value">
              <span class="gsp-hex">{{ store.styles.ctaTextColor }}</span>
              <span class="gsp-color-label">Text</span>
            </div>
            <div class="gsp-color-pick" title="Fill colour">
              <input type="color" :value="store.styles.accentColor" @input="store.styles.accentColor = $event.target.value">
              <span class="gsp-hex">{{ store.styles.accentColor }}</span>
              <span class="gsp-color-label">Fill</span>
            </div>
          </div>
          <div class="gsp-row">
            <div class="gsp-weight-seg">
              <button v-for="w in WEIGHT_OPTIONS" :key="w.value" class="gsp-wt" :class="{ active: store.styles.ctaFontWeight === w.value }" :disabled="isWeightDisabled('ctaFont', w.value)" @click="store.styles.ctaFontWeight = w.value" :title="w.label">{{ w.label }}</button>
            </div>
          </div>
          <div class="gsp-divider"></div>
          <!-- Padding widget with live preview -->
          <div class="gsp-row">
            <div class="gsp-cta-pad-widget">
              <div class="gsp-cta-pad-row" style="justify-content:center">
                <div class="gsp-cta-pad-field">
                  <input type="number" min="0" max="120" :value="store.styles.ctaPadV" @input="store.styles.ctaPadV = parseInt($event.target.value) || 0">
                </div>
              </div>
              <div class="gsp-cta-pad-row" style="gap:6px;align-items:center">
                <div class="gsp-cta-pad-field">
                  <input type="number" min="0" max="120" :value="store.styles.ctaPadH" @input="store.styles.ctaPadH = parseInt($event.target.value) || 0">
                </div>
                <div class="gsp-cta-pad-preview">
                  <div class="gsp-cta-pill" :style="pillStyle()">Label</div>
                </div>
                <div class="gsp-cta-pad-field">
                  <input type="number" min="0" max="120" :value="store.styles.ctaPadH" @input="store.styles.ctaPadH = parseInt($event.target.value) || 0">
                </div>
              </div>
              <div class="gsp-cta-pad-row" style="justify-content:center">
                <div class="gsp-cta-pad-field">
                  <input type="number" min="0" max="120" :value="store.styles.ctaPadV" @input="store.styles.ctaPadV = parseInt($event.target.value) || 0">
                </div>
              </div>
            </div>
          </div>
          <!-- Corner radius -->
          <div class="gsp-row gsp-row-tight">
            <span class="gsp-inline-label">Radius</span>
            <input type="range" class="gsp-mini-range" min="0" max="100" :value="store.styles.ctaRadius" @input="store.styles.ctaRadius = parseInt($event.target.value)">
            <span class="gsp-range-val">{{ store.styles.ctaRadius }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ─── Background ──────────────────────────────────── -->
    <section class="gsp-section">
      <div class="gsp-section-head">
        <span class="gsp-section-title">Background</span>
      </div>
      <div class="gsp-row">
        <div class="gsp-seg-row">
          <button class="gsp-seg" :class="{ active: store.styles.bgMode === 'none' }" @click="store.styles.bgMode = 'none'">None</button>
          <button class="gsp-seg" :class="{ active: store.styles.bgMode === 'color' }" @click="store.styles.bgMode = 'color'">Solid</button>
          <button class="gsp-seg" :class="{ active: store.styles.bgMode === 'linear' }" @click="store.styles.bgMode = 'linear'">Linear</button>
          <button class="gsp-seg" :class="{ active: store.styles.bgMode === 'radial' }" @click="store.styles.bgMode = 'radial'">Radial</button>
        </div>
      </div>
      <template v-if="store.styles.bgMode !== 'none'">
        <div class="gsp-row gsp-row-tight">
          <div class="gsp-color-field">
            <input type="color" :value="store.styles.bgColor1" @input="store.styles.bgColor1 = $event.target.value">
            <span class="gsp-color-label">{{ store.styles.bgMode === 'color' ? 'Fill' : 'Start' }}</span>
          </div>
          <div v-if="store.styles.bgMode !== 'color'" class="gsp-color-field">
            <input type="color" :value="store.styles.bgColor2" @input="store.styles.bgColor2 = $event.target.value">
            <span class="gsp-color-label">End</span>
          </div>
          <div v-if="store.styles.bgMode === 'linear'" class="gsp-field-num" title="Angle">
            <svg class="gsp-field-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 8L8 2"/><path d="M5 2h3v3"/></svg>
            <input type="number" min="0" max="360" :value="store.styles.bgAngle" @input="store.styles.bgAngle = parseInt($event.target.value)">
            <span class="gsp-unit">&deg;</span>
          </div>
          <div v-if="store.styles.bgMode !== 'color'" class="gsp-field-num" title="Distance">
            <input type="number" min="10" max="200" :value="store.styles.bgDistance" @input="store.styles.bgDistance = parseInt($event.target.value)">
            <span class="gsp-unit">%</span>
          </div>
        </div>
      </template>
    </section>

    <!-- ─── Overlay ─────────────────────────────────────── -->
    <section class="gsp-section">
      <div class="gsp-section-head">
        <span class="gsp-section-title">Overlay</span>
      </div>
      <div class="gsp-row gsp-row-tight">
        <div class="gsp-color-field">
          <input type="color" :value="store.styles.overlayColor" @input="store.styles.overlayColor = $event.target.value">
          <span class="gsp-color-label">Colour</span>
        </div>
        <div class="gsp-field-num" style="flex:1">
          <input type="range" class="gsp-mini-range" min="0" max="100" :value="Math.round(store.styles.overlayOpacity * 100)" @input="store.styles.overlayOpacity = parseInt($event.target.value) / 100">
          <span class="gsp-range-val">{{ Math.round(store.styles.overlayOpacity * 100) }}%</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ── Root ──────────────────────────────────────────────────── */
.gsp {
  display: flex;
  flex-direction: column;
}

/* ── Section ──────────────────────────────────────────────── */
.gsp-section {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}
.gsp-section:last-child { border-bottom: none; }

/* ── Card wrapper (matches left panel layer-item style) ───── */
.gsp-card {
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px 10px;
}
.gsp-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.gsp-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}
.gsp-card-body {
  display: flex;
  flex-direction: column;
}

.gsp-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 0 8px;
}

/* ── Section header (for non-card sections like Background, Overlay) ── */
.gsp-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.gsp-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

/* ── Type badges ──────────────────────────────────────────── */
.gsp-badge {
  width: 20px; height: 20px;
  border-radius: 5px;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700;
  flex-shrink: 0; line-height: 1;
}
.gsp-badge.hl  { background: #dbeafe; color: #2563eb; }
.gsp-badge.txt { background: #f1f5f9; color: #64748b; }
.gsp-badge.cta { background: #fce7f3; color: #db2777; }

/* ── Rows ─────────────────────────────────────────────────── */
.gsp-row {
  margin-bottom: 8px;
}
.gsp-row:last-child { margin-bottom: 0; }

.gsp-row-tight {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Font select ──────────────────────────────────────────── */
.gsp-select {
  width: 100%;
  height: 32px;
  padding: 0 26px 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
  font-family: inherit;
  background: var(--card-bg);
  color: var(--text);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%2394a3b8'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  transition: border-color 0.12s;
}
.gsp-select:focus { border-color: #6366f1; outline: none; }

/* ── Numeric field ────────────────────────────────────────── */
.gsp-field-num {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  height: 32px;
  padding: 0 8px;
  min-width: 0;
  transition: border-color 0.12s;
  box-sizing: border-box;
}
.gsp-field-num:focus-within { border-color: #6366f1; }

.gsp-field-num input[type="number"] {
  width: 34px;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 12px;
  font-family: inherit;
  font-weight: 600;
  color: var(--text);
  text-align: center;
  font-variant-numeric: tabular-nums;
  padding: 0;
}
.gsp-field-num input[type="number"]:focus { outline: none; }
/* Remove spinners */
.gsp-field-num input::-webkit-inner-spin-button,
.gsp-field-num input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.gsp-field-num input[type="number"] { -moz-appearance: textfield; }

.gsp-field-icon {
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0.55;
}

.gsp-unit {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  opacity: 0.6;
}

/* ── Weight segmented control ─────────────────────────────── */
.gsp-weight-seg {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  flex: 1;
  min-width: 0;
}
.gsp-wt {
  flex: 1;
  padding: 5px 0;
  font-size: 10px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  border: none;
  border-right: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text-muted);
  transition: all 0.1s;
  white-space: nowrap;
  text-align: center;
}
.gsp-wt:last-child { border-right: none; }
.gsp-wt:hover:not(:disabled) { background: #f1f5f9; color: var(--text); }
.gsp-wt.active { background: #ede9fe; color: #6366f1; font-weight: 600; }
.gsp-wt:disabled { opacity: 0.3; cursor: default; }

/* ── Colour picker (swatch + hex) ─────────────────────────── */
.gsp-color-pick {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.gsp-color-pick input[type="color"] {
  width: 30px; height: 30px;
  flex-shrink: 0;
  padding: 2px;
  border: 1.5px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  background: var(--card-bg);
}
.gsp-color-pick input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
.gsp-color-pick input[type="color"]::-webkit-color-swatch { border: none; border-radius: 4px; }
.gsp-color-pick input[type="color"]::-moz-color-swatch { border: none; border-radius: 4px; }
.gsp-hex {
  font-size: 11px;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', 'Segoe UI Mono', Consolas, monospace;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.gsp-color-pick .gsp-color-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
  margin-left: auto;
}

/* Side-by-side colour pickers (CTA text + fill) */
.gsp-color-pair {
  display: flex;
  gap: 10px;
}
.gsp-color-pair .gsp-color-pick {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.gsp-color-pair .gsp-color-pick input[type="color"] {
  width: 22px; height: 22px;
  padding: 1px;
  border: 1.5px solid var(--border);
  border-radius: 4px;
}

/* ── Colour field (swatch + label — for bg/overlay) ──────── */
.gsp-color-field {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.gsp-color-field input[type="color"] {
  width: 26px; height: 26px;
  padding: 2px;
  border: 1.5px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  background: var(--card-bg);
}
.gsp-color-field input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
.gsp-color-field input[type="color"]::-webkit-color-swatch { border: none; border-radius: 3px; }
.gsp-color-field input[type="color"]::-moz-color-swatch { border: none; border-radius: 3px; }
.gsp-color-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
}

/* ── Segmented control ────────────────────────────────────── */
.gsp-seg-row {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  width: 100%;
}
.gsp-seg {
  flex: 1;
  padding: 6px 4px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  border: none;
  border-right: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.1s;
  text-align: center;
  white-space: nowrap;
}
.gsp-seg:last-child { border-right: none; }
.gsp-seg:hover { background: #f1f5f9; color: var(--text); }
.gsp-seg.active { background: #ede9fe; color: #6366f1; }

/* ── Mini range (overlay) ─────────────────────────────────── */
.gsp-mini-range {
  flex: 1;
  min-width: 0;
  accent-color: #6366f1;
  cursor: pointer;
  height: 14px;
}
.gsp-range-val {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  min-width: 28px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ── CTA padding widget ──────────────────────────────────── */
.gsp-cta-pad-widget {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}
.gsp-cta-pad-row {
  display: flex;
  width: 100%;
}
.gsp-cta-pad-field {
  flex-shrink: 0;
}
.gsp-cta-pad-field input {
  width: 42px;
  min-width: 0;
  text-align: center;
  padding: 4px 4px;
  font-size: 11px;
  font-family: inherit;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text);
  box-sizing: border-box;
  transition: border-color 0.12s;
}
.gsp-cta-pad-field input:focus { border-color: #6366f1; outline: none; }
.gsp-cta-pad-field input::-webkit-inner-spin-button,
.gsp-cta-pad-field input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.gsp-cta-pad-field input[type="number"] { -moz-appearance: textfield; }

.gsp-cta-pad-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card-bg);
  border: 1.5px dashed var(--border);
  border-radius: 7px;
  min-height: 48px;
  margin: 0 2px;
}
.gsp-cta-pill {
  line-height: 1;
  white-space: nowrap;
  transition: padding 0.12s, border-radius 0.12s;
}

/* ── Inline label ────────────────────────────────────────── */
.gsp-inline-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
