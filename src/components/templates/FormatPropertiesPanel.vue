<script setup>
import { ref, computed, watch } from 'vue';
import { useTemplateBuilderStore } from '../../stores/templateBuilder.js';
import { DEFAULT_FORMAT_PROPS } from '../../composables/templateConstants.js';

const ANCHOR_DEFS = [
  { k: 'tl', icon: '\u2196' }, { k: 'tc', icon: '\u2191' }, { k: 'tr', icon: '\u2197' },
  { k: 'cl', icon: '\u2190' }, { k: 'cc', icon: '\u25CF' }, { k: 'cr', icon: '\u2192' },
  { k: 'bl', icon: '\u2199' }, { k: 'bc', icon: '\u2193' }, { k: 'br', icon: '\u2198' },
];

const ANCHOR_ICONS = Object.fromEntries(ANCHOR_DEFS.map(a => [a.k, a.icon]));

const store = useTemplateBuilderStore();

const props = defineProps({
  format: { type: Object, required: true },
  canDelete: { type: Boolean, default: true },
  sourceType: { type: String, default: 'image' },
});

const emit = defineEmits(['close', 'delete', 'export']);

const localName = ref('');

watch(() => props.format, (fmt) => {
  if (fmt) localName.value = fmt.label;
}, { immediate: true });

function onNameInput() {
  store.updateFormat(props.format.id, 'label', localName.value);
}

const hasMultipleAssets = computed(() => store.assets.length > 1);
const hasActiveAssetAnchor = computed(() => store.hasAssetAnchorOverride(props.format.id));

function setAnchor(k) {
  store.updateFormat(props.format.id, 'anchor', k);
}

function toggleLayerVis(layerId) {
  store.toggleLayerVisibility(props.format.id, layerId);
}

function isLayerVisible(layerId) {
  return props.format.visibleLayers?.includes(layerId) ?? false;
}

function toggleLogo() {
  const current = props.format.logoSize ?? 0.08;
  store.updateFormat(props.format.id, 'logoSize', current > 0 ? 0 : 0.08);
}

const logoVisible = computed(() => (props.format.logoSize ?? 0.08) > 0);

// ── Unified anchor selection ─────────────────────────────────────────────────
// null = group anchor, 'headline'/'text'/'cta' = layer, '_logo' = logo
const selectedElement = ref(null);

function selectElement(id) {
  selectedElement.value = selectedElement.value === id ? null : id;
}

// What the anchor grid label says
const anchorLabel = computed(() => {
  if (!selectedElement.value) {
    if (hasMultipleAssets.value && hasActiveAssetAnchor.value) return 'Group (this asset)';
    return 'Group';
  }
  if (selectedElement.value === '_logo') return 'Logo';
  const layer = store.layers.find(l => l.id === selectedElement.value);
  return layer?.label || selectedElement.value;
});

// Current effective anchor for whatever is selected
const activeAnchor = computed(() => {
  const sel = selectedElement.value;
  if (!sel) return store.resolveAnchor(props.format);
  if (sel === '_logo') {
    if (props.format.logoAnchor) return props.format.logoAnchor;
    const a = store.resolveAnchor(props.format);
    const mirrorV = a[0] === 'b' ? 't' : 'b';
    const mirrorH = a[1] === 'l' ? 'r' : a[1] === 'r' ? 'l' : a[1];
    return mirrorV + mirrorH;
  }
  return props.format.layerAnchors?.[sel] || store.resolveAnchor(props.format);
});

// Whether the selected element has a custom (non-inherited) anchor
const hasCustomAnchor = computed(() => {
  const sel = selectedElement.value;
  if (!sel) {
    // "All" selected — show reset if any individual overrides exist
    const la = props.format.layerAnchors;
    const hasLayerOverrides = la && Object.keys(la).length > 0;
    return hasLayerOverrides || !!props.format.logoAnchor || hasActiveAssetAnchor.value;
  }
  if (sel === '_logo') return !!props.format.logoAnchor;
  return !!props.format.layerAnchors?.[sel];
});

function setActiveAnchor(k) {
  const sel = selectedElement.value;
  if (!sel) {
    if (hasMultipleAssets.value) {
      // With multiple assets, set per-asset anchor override
      store.setAssetAnchor(props.format.id, k);
    } else {
      store.updateFormat(props.format.id, 'anchor', k);
    }
  } else if (sel === '_logo') {
    store.updateFormat(props.format.id, 'logoAnchor', k);
  } else {
    store.setLayerAnchor(props.format.id, sel, k);
  }
}

function resetActiveAnchor() {
  const sel = selectedElement.value;
  if (!sel) {
    // Clear all individual overrides
    store.updateFormat(props.format.id, 'layerAnchors', {});
    store.updateFormat(props.format.id, 'logoAnchor', '');
    // Also clear per-asset anchor override if multi-asset
    if (hasActiveAssetAnchor.value) {
      store.setAssetAnchor(props.format.id, null);
    }
    return;
  }
  if (sel === '_logo') {
    store.updateFormat(props.format.id, 'logoAnchor', '');
  } else {
    store.setLayerAnchor(props.format.id, sel, null);
  }
}

function getLayerAnchor(layerId) {
  return props.format.layerAnchors?.[layerId] || null;
}

function effectiveLogoAnchor() {
  if (props.format.logoAnchor) return props.format.logoAnchor;
  const a = props.format.anchor || 'bl';
  const mirrorV = a[0] === 'b' ? 't' : 'b';
  const mirrorH = a[1] === 'l' ? 'r' : a[1] === 'r' ? 'l' : a[1];
  return mirrorV + mirrorH;
}

// ── Sizing reset-all ────────────────────────────────────────────────────────

const SIZING_FIELDS = ['contentWidth', 'padding', 'contentScale', 'ctaScale', 'logoSize'];

const anySizingModified = computed(() =>
  SIZING_FIELDS.some(f => props.format[f] !== undefined && props.format[f] !== DEFAULT_FORMAT_PROPS[f])
);

function resetAllSizing() {
  for (const f of SIZING_FIELDS) {
    if (f in DEFAULT_FORMAT_PROPS) {
      store.updateFormat(props.format.id, f, DEFAULT_FORMAT_PROPS[f]);
    }
  }
}

// ── Editable numeric fields ──────────────────────────────────────────────────

function updateDimension(field, val) {
  const n = parseInt(val);
  if (!isNaN(n) && n > 0) store.updateFormat(props.format.id, field, n);
}

function updatePosition(axis, val) {
  const n = parseInt(val);
  if (!isNaN(n)) {
    store.canvasPositions[props.format.id] = {
      ...store.canvasPositions[props.format.id],
      [axis]: n,
    };
    store.scheduleSave();
  }
}

function updateSlider(field, val, divisor = 1) {
  const n = parseFloat(val);
  if (!isNaN(n)) store.updateFormat(props.format.id, field, divisor === 1 ? n : n / divisor);
}

function resetProp(field) {
  if (field in DEFAULT_FORMAT_PROPS) {
    store.updateFormat(props.format.id, field, DEFAULT_FORMAT_PROPS[field]);
  }
}

function isDefault(field) {
  return props.format[field] === DEFAULT_FORMAT_PROPS[field];
}

const pos = computed(() => store.canvasPositions[props.format.id] || { x: 0, y: 0 });

function onDelete() {
  emit('delete', props.format.id);
}
</script>

<template>
  <div class="props-panel">
    <!-- Header -->
    <div class="props-header">
      <input
        type="text"
        class="props-name-input"
        v-model="localName"
        @input="onNameInput"
        placeholder="Format name"
      >
      <button class="props-close" @click="$emit('close')" title="Close">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
      </button>
    </div>

    <div class="props-body">
      <!-- Size section -->
      <section class="props-section">
        <div class="props-card">
          <div class="props-card-title">Size</div>
          <div class="props-grid-2">
            <div class="props-num-field">
              <label>W</label>
              <input type="number" min="10" :value="format.w" @change="updateDimension('w', $event.target.value)">
              <span class="props-field-unit">px</span>
            </div>
            <div class="props-num-field">
              <label>H</label>
              <input type="number" min="10" :value="format.h" @change="updateDimension('h', $event.target.value)">
              <span class="props-field-unit">px</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Location section -->
      <section class="props-section">
        <div class="props-card">
          <div class="props-card-title">Location</div>
          <div class="props-grid-2">
            <div class="props-num-field">
              <label>X</label>
              <input type="number" :value="pos.x" @change="updatePosition('x', $event.target.value)">
              <span class="props-field-unit">px</span>
            </div>
            <div class="props-num-field">
              <label>Y</label>
              <input type="number" :value="pos.y" @change="updatePosition('y', $event.target.value)">
              <span class="props-field-unit">px</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Anchor & Elements (unified) -->
      <section class="props-section">
        <div class="props-card">
          <!-- Anchor grid — always visible, context changes with selection -->
          <div class="anchor-header">
            <div class="anchor-header-label">{{ anchorLabel }} Anchor</div>
            <button
              v-if="hasCustomAnchor"
              class="anchor-header-reset"
              :title="!selectedElement ? 'Clear all element overrides' : selectedElement === '_logo' ? 'Reset to auto' : 'Reset to group anchor'"
              @click="resetActiveAnchor"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>
          </div>
          <div class="anchor-grid-wrap">
            <div class="anchor-grid">
              <button
                v-for="a in ANCHOR_DEFS" :key="a.k"
                class="anchor-btn"
                :class="{ active: activeAnchor === a.k }"
                :title="a.k.toUpperCase()"
                @click="setActiveAnchor(a.k)"
              >{{ a.icon }}</button>
            </div>
          </div>

          <!-- Element selector row -->
          <div class="elem-selector">
            <button
              class="elem-chip"
              :class="{ selected: !selectedElement }"
              @click="selectElement(null)"
              title="Group anchor"
            >All</button>
            <template v-for="layer in store.layers" :key="layer.id">
              <button
                v-if="isLayerVisible(layer.id)"
                class="elem-chip"
                :class="{ selected: selectedElement === layer.id, custom: getLayerAnchor(layer.id) }"
                @click="selectElement(layer.id)"
              >{{ layer.label }}</button>
            </template>
            <button
              v-if="logoVisible"
              class="elem-chip"
              :class="{ selected: selectedElement === '_logo', custom: !!format.logoAnchor }"
              @click="selectElement('_logo')"
            >Logo</button>
          </div>
        </div>
      </section>

      <!-- Visibility toggles -->
      <section class="props-section">
        <div class="props-card">
          <div class="props-card-title">Visibility</div>
          <div class="vis-toggles">
            <button v-for="layer in store.layers" :key="layer.id" class="elem-toggle" :class="{ on: isLayerVisible(layer.id) }" @click="toggleLayerVis(layer.id)">{{ layer.label }}</button>
            <button class="elem-toggle" :class="{ on: logoVisible }" @click="toggleLogo">Logo</button>
          </div>
        </div>
      </section>

      <!-- Sizing -->
      <section class="props-section">
        <div class="props-card">
          <div class="sizing-header">
            <div class="props-card-title" style="margin-bottom:0">Sizing</div>
            <button
              v-if="anySizingModified"
              class="anchor-header-reset"
              title="Reset all sizing to defaults"
              @click="resetAllSizing"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>
          </div>
          <div class="props-slider-group">
            <div class="props-slider-item">
              <span class="props-slider-label">Content Width</span>
              <div class="props-slider-row">
                <input type="range" min="20" max="100" :value="format.contentWidth ?? 60" @input="updateSlider('contentWidth', $event.target.value)">
                <input type="number" class="props-num-inline" min="20" max="100" :value="format.contentWidth ?? 60" @change="updateSlider('contentWidth', $event.target.value)">
                <span class="props-unit">%</span>
                <button class="props-reset-inline" :class="{ modified: !isDefault('contentWidth') }" :disabled="isDefault('contentWidth')" @click="resetProp('contentWidth')" title="Reset to default">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
              </div>
            </div>
            <div class="props-slider-item">
              <span class="props-slider-label">Padding</span>
              <div class="props-slider-row">
                <input type="range" min="0" max="20" :value="format.padding ?? 0" @input="updateSlider('padding', $event.target.value)">
                <input type="number" class="props-num-inline" min="0" max="20" :value="format.padding ?? 0" @change="updateSlider('padding', $event.target.value)">
                <span class="props-unit">%</span>
                <button class="props-reset-inline" :class="{ modified: !isDefault('padding') }" :disabled="isDefault('padding')" @click="resetProp('padding')" :title="(format.padding ?? 0) === 0 ? 'Auto' : 'Reset to auto'">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
              </div>
            </div>
            <div class="props-slider-item">
              <span class="props-slider-label">Text Scale</span>
              <div class="props-slider-row">
                <input type="range" min="50" max="300" :value="Math.round((format.contentScale || 1) * 100)" @input="updateSlider('contentScale', $event.target.value, 100)">
                <input type="number" class="props-num-inline" min="50" max="300" :value="Math.round((format.contentScale || 1) * 100)" @change="updateSlider('contentScale', $event.target.value, 100)">
                <span class="props-unit">%</span>
                <button class="props-reset-inline" :class="{ modified: !isDefault('contentScale') }" :disabled="isDefault('contentScale')" @click="resetProp('contentScale')" title="Reset to default">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
              </div>
            </div>
            <div class="props-slider-item">
              <span class="props-slider-label">CTA Scale</span>
              <div class="props-slider-row">
                <input type="range" min="50" max="300" :value="Math.round((format.ctaScale || 1) * 100)" @input="updateSlider('ctaScale', $event.target.value, 100)">
                <input type="number" class="props-num-inline" min="50" max="300" :value="Math.round((format.ctaScale || 1) * 100)" @change="updateSlider('ctaScale', $event.target.value, 100)">
                <span class="props-unit">%</span>
                <button class="props-reset-inline" :class="{ modified: !isDefault('ctaScale') }" :disabled="isDefault('ctaScale')" @click="resetProp('ctaScale')" title="Reset to default">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
              </div>
            </div>
            <div class="props-slider-item">
              <span class="props-slider-label">Logo Size</span>
              <div class="props-slider-row">
                <input type="range" min="2" max="20" :value="Math.round((format.logoSize || 0.08) * 100)" @input="updateSlider('logoSize', $event.target.value, 100)">
                <input type="number" class="props-num-inline" min="2" max="20" :value="Math.round((format.logoSize || 0.08) * 100)" @change="updateSlider('logoSize', $event.target.value, 100)">
                <span class="props-unit">%</span>
                <button class="props-reset-inline" :class="{ modified: !isDefault('logoSize') }" :disabled="isDefault('logoSize')" @click="resetProp('logoSize')" title="Reset to default">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Actions -->
      <section class="props-section props-actions">
        <button class="props-export-btn" @click="$emit('export')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
          Download {{ sourceType === 'video' ? 'WebM' : 'PNG' }}
        </button>
        <button class="props-delete-btn" :disabled="!canDelete" @click="onDelete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          Delete Format
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.props-panel {
  width: 260px;
  flex-shrink: 0;
  overflow-y: auto;
  border-left: 1px solid var(--border);
  background: var(--card-bg);
  display: flex;
  flex-direction: column;
  z-index: 25;
}

.props-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.props-name-input {
  flex: 1; min-width: 0;
  padding: 5px 8px;
  font-size: 13px; font-weight: 600; font-family: inherit;
  border: 1px solid transparent; border-radius: 5px;
  background: transparent; color: var(--text);
  transition: all 0.12s;
}
.props-name-input:hover { background: var(--bg); }
.props-name-input:focus { outline: none; border-color: #6366f1; background: var(--bg); }

.props-close {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; color: var(--text-muted);
  border: none; border-radius: 5px;
  cursor: pointer; transition: background 0.12s;
  flex-shrink: 0;
}
.props-close:hover { background: var(--bg); }

.props-body { flex: 1; overflow-y: auto; background: var(--card-bg); }

.props-section {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}
.props-section:last-child { border-bottom: none; }

/* ── Card wrapper ─────────────────────────────────── */
.props-card {
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px 10px;
}
.props-card-title {
  font-size: 12px; font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

.props-section-label {
  font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-muted); margin-bottom: 8px;
}

/* ── Size / Location grids ───────────────────────── */
.props-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}
.props-num-field {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 5px 8px;
  transition: border-color 0.12s;
  min-width: 0;
  overflow: hidden;
}
.props-num-field:focus-within { border-color: #6366f1; }
.props-num-field label {
  font-size: 10px; font-weight: 600;
  color: var(--text-muted);
  min-width: 12px;
}
.props-num-field input {
  flex: 1; min-width: 0; width: 0;
  border: none; background: transparent;
  font-size: 12px; font-family: inherit; font-weight: 500;
  color: var(--text);
  text-align: right;
  font-variant-numeric: tabular-nums;
  padding: 0;
}
.props-num-field input:focus { outline: none; }
.props-field-unit {
  font-size: 9px; font-weight: 500;
  color: var(--text-muted);
  opacity: 0.6;
  margin-left: 1px;
}
/* Remove spinners */
.props-num-field input::-webkit-inner-spin-button,
.props-num-field input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.props-num-field input[type="number"] { -moz-appearance: textfield; }

/* ── Anchor grid ──────────────────────────────────── */
.anchor-grid-wrap { display: flex; justify-content: center; }
.anchor-grid { display: grid; grid-template-columns: repeat(3, 28px); gap: 3px; }
.anchor-btn {
  width: 28px; height: 28px;
  border-radius: 4px;
  border: 1.5px solid var(--border);
  background: var(--card-bg);
  cursor: pointer;
  font-size: 12px;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted);
  transition: all 0.12s; font-family: inherit;
}
.anchor-btn:hover { border-color: #6366f1; color: #6366f1; }
.anchor-btn.active { border-color: #6366f1; background: #ede9fe; color: #6366f1; }

/* ── Anchor header (label + reset) ───────────────── */
.anchor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.anchor-header-label {
  font-size: 12px; font-weight: 600;
  color: var(--text);
}
.anchor-header-reset {
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none;
  color: #6366f1; cursor: pointer;
  border-radius: 4px; transition: background 0.15s, opacity 0.15s;
  opacity: 0.7; flex-shrink: 0; padding: 0;
}
.anchor-header-reset:hover { background: #ede9fe; opacity: 1; }

.sizing-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

/* ── Element selector chips (below the anchor grid) ─ */
.elem-selector {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.elem-chip {
  padding: 3px 10px; border-radius: 16px;
  font-size: 11px; font-weight: 500; cursor: pointer;
  border: 1.5px solid var(--border);
  background: var(--card-bg); color: var(--text-muted);
  font-family: inherit; transition: all 0.12s;
}
.elem-chip:hover { border-color: #a5b4fc; color: var(--text); }
.elem-chip.selected { border-color: #6366f1; background: #6366f1; color: white; }
.elem-chip.custom:not(.selected) { border-color: #a5b4fc; color: #6366f1; }

/* ── Visibility toggles ─────────────────────────── */
.vis-toggles { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; }
.elem-toggle {
  padding: 3px 10px; border-radius: 16px;
  font-size: 11px; font-weight: 500; cursor: pointer;
  border: 1.5px solid var(--border);
  background: var(--card-bg); color: var(--text-muted);
  font-family: inherit; transition: all 0.12s;
}
.elem-toggle.on { border-color: #6366f1; background: #ede9fe; color: #6366f1; }

/* ── Slider items ─────────────────────────────────── */
.props-slider-group { display: flex; flex-direction: column; gap: 10px; }
.props-slider-label {
  display: block;
  font-size: 11px; font-weight: 500;
  color: var(--text-muted);
  margin-bottom: 3px;
}
.props-reset-inline {
  width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none;
  color: var(--text-muted); cursor: default;
  border-radius: 4px; transition: background 0.15s, color 0.15s, opacity 0.15s;
  opacity: 0.25; flex-shrink: 0; padding: 0;
}
.props-reset-inline.modified {
  color: #6366f1; cursor: pointer; opacity: 0.7;
}
.props-reset-inline.modified:hover { background: #ede9fe; opacity: 1; }

.props-slider-row {
  display: flex; align-items: center; gap: 6px;
}
.props-slider-row input[type="range"] {
  flex: 1; min-width: 0;
  accent-color: #6366f1;
  cursor: pointer;
}
.props-num-inline {
  width: 42px;
  padding: 3px 4px;
  font-size: 11px; font-family: inherit; font-weight: 600;
  color: var(--text);
  text-align: right;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--card-bg);
  font-variant-numeric: tabular-nums;
}
.props-num-inline:focus { outline: none; border-color: #6366f1; }
/* Remove spinners */
.props-num-inline::-webkit-inner-spin-button,
.props-num-inline::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.props-num-inline { -moz-appearance: textfield; }

.props-unit {
  font-size: 10px; color: var(--text-muted); font-weight: 500;
  min-width: 14px;
}

/* ── Actions ───────────────────────────────────────── */
.props-actions {
  display: flex; flex-direction: column; gap: 6px;
  padding-top: 8px;
}
.props-export-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 8px; border-radius: 6px;
  background: #6366f1; color: white;
  border: none;
  font-size: 11.5px; font-weight: 600;
  cursor: pointer; font-family: inherit;
  transition: all 0.12s;
}
.props-export-btn:hover { background: #4f46e5; }
.props-export-btn svg { stroke: white; }
.props-delete-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 7px; border-radius: 5px;
  background: transparent; color: #ef4444;
  border: 1px solid #fecaca;
  font-size: 11px; font-weight: 500;
  cursor: pointer; font-family: inherit;
  transition: all 0.12s;
}
.props-delete-btn:hover:not(:disabled) { background: #fef2f2; border-color: #ef4444; }
.props-delete-btn:disabled { opacity: 0.3; cursor: default; }
</style>
