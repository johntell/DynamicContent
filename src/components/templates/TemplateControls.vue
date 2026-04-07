<script setup>
import { ref, computed } from 'vue';
import { useTemplateBuilderStore } from '../../stores/templateBuilder.js';
import FocalPointPicker from './FocalPointPicker.vue';
import BulkDataPanel from './BulkDataPanel.vue';

const store = useTemplateBuilderStore();

const props = defineProps({
  sourceReady: Boolean,
  sourceType: String,
});

const emit = defineEmits([
  'load-source', 'clear-logo', 'export-all', 'switch-asset', 'export-bulk',
]);

// Add-layer menu
const showAddMenu = ref(false);

// New-asset URL input
const newAssetUrl = ref('');

function onSourceKeydown(e) {
  if (e.key === 'Enter') emit('load-source');
}

// Asset helpers
function addNewAsset() {
  const url = newAssetUrl.value.trim();
  if (!url) return;
  const id = store.addAsset(url);
  newAssetUrl.value = '';
  emit('switch-asset', id);
}

function switchAsset(id) {
  store.setActiveAsset(id);
  emit('switch-asset', id);
}

function removeAsset(id) {
  store.removeAsset(id);
  if (store.activeAsset) emit('switch-asset', store.activeAssetId);
}

function assetLabel(asset) {
  if (asset.label) return asset.label;
  try {
    const url = new URL(asset.url);
    const parts = url.pathname.split('/');
    return parts[parts.length - 1]?.slice(0, 20) || 'Asset';
  } catch { return 'Asset'; }
}

// Layer helpers
function typeIcon(type) {
  if (type === 'headline') return 'H';
  if (type === 'cta') return 'C';
  return 'T';
}

function canMoveUp(idx) { return idx > 0; }
function canMoveDown(idx) { return idx < store.layers.length - 1; }
function moveUp(idx) { if (canMoveUp(idx)) store.reorderLayers(idx, idx - 1); }
function moveDown(idx) { if (canMoveDown(idx)) store.reorderLayers(idx, idx + 1); }
function addLayer(type) { store.addLayer(type); showAddMenu.value = false; }
function removeLayer(id) { store.removeLayer(id); }
function onAddMenuBlur() { setTimeout(() => { showAddMenu.value = false; }, 150); }
</script>

<template>
  <div class="ctrl-panel">
    <!-- ─── Panel header ─────────────────────────────────────────── -->
    <div class="ctrl-header">Content</div>

    <!-- ─── Scrollable body ──────────────────────────────────────── -->
    <div class="ctrl-scroll">

      <!-- ─── Source Assets ───────────────────────────────────────── -->
      <div class="ctrl-body-section">
        <!-- Asset list -->
        <div v-if="store.assets.length > 0" class="asset-list">
          <div
            v-for="asset in store.assets"
            :key="asset.id"
            class="asset-row"
            :class="{ active: asset.id === store.activeAssetId }"
            @click="switchAsset(asset.id)"
          >
            <div class="asset-row-dot" :class="{ on: asset.id === store.activeAssetId }"></div>
            <span class="asset-row-label" :title="asset.url">{{ assetLabel(asset) }}</span>
            <button class="asset-row-load" @click.stop="switchAsset(asset.id); $emit('load-source')" title="Reload">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            </button>
            <button
              v-if="store.assets.length > 1"
              class="asset-row-remove"
              @click.stop="removeAsset(asset.id)"
              title="Remove"
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 2.5 7.5 7.5M7.5 2.5 2.5 7.5"/></svg>
            </button>
          </div>
        </div>

        <!-- URL input — single unified row -->
        <div class="url-add-row">
          <input
            type="url"
            v-model="newAssetUrl"
            @keydown.enter="addNewAsset"
            :placeholder="store.assets.length ? 'Add URL...' : 'Paste image or video URL...'"
          >
          <button class="url-add-btn" @click="addNewAsset" :disabled="!newAssetUrl.trim()">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 1v10M1 6h10"/></svg>
          </button>
        </div>

        <div v-if="store.statusMsg" class="tpl-src-status" :class="store.statusType || ''">{{ store.statusMsg }}</div>

        <!-- Focal settings (only for images, condensed) -->
        <template v-if="sourceReady && sourceType !== 'video'">
          <div class="focal-bar">
            <button class="focal-pill" :class="{ on: store.useSmartCrop }" @click="store.useSmartCrop = !store.useSmartCrop" title="Auto focal point">
              Smart crop
            </button>
            <template v-if="!store.useSmartCrop">
              <button class="focal-pill" :class="{ on: store.contentAwareFocal }" @click="store.contentAwareFocal = !store.contentAwareFocal" title="Keep focal area away from text overlays">
                Content aware
              </button>
              <button class="focal-pill" :class="{ on: store.focalFit === 'safe' }" @click="store.focalFit = store.focalFit === 'safe' ? 'cover' : 'safe'" title="Safe: always show full focal area. Cover: image fills canvas.">
                Safe area
              </button>
            </template>
          </div>
          <div v-if="!store.useSmartCrop">
            <FocalPointPicker
              :source-url="store.sourceUrl"
              :focal-x="store.focalPoint.x"
              :focal-y="store.focalPoint.y"
              :focal-w="store.focalPoint.w"
              :focal-h="store.focalPoint.h"
              @update:focal-x="store.focalPoint.x = $event"
              @update:focal-y="store.focalPoint.y = $event"
              @update:focal-w="store.focalPoint.w = $event"
              @update:focal-h="store.focalPoint.h = $event"
            />
            <div class="fp-coords">
              <span>X: {{ Math.round(store.focalPoint.x * 100) }}%</span>
              <span>Y: {{ Math.round(store.focalPoint.y * 100) }}%</span>
              <span class="fp-area-dims">{{ Math.round(store.focalPoint.w * 100) }} &times; {{ Math.round(store.focalPoint.h * 100) }}%</span>
              <button v-if="store.focalPoint.x !== 0.5 || store.focalPoint.y !== 0.5 || store.focalPoint.w !== 0.3 || store.focalPoint.h !== 0.3" class="fp-reset" @click="store.focalPoint.x = 0.5; store.focalPoint.y = 0.5; store.focalPoint.w = 0.3; store.focalPoint.h = 0.3">Reset</button>
            </div>
          </div>
        </template>
      </div>

      <!-- ─── Layers ─────────────────────────────────────────────── -->
      <div class="ctrl-sub-label">LAYERS</div>
      <div class="ctrl-body-section">
        <template v-for="(layer, idx) in store.layers" :key="layer.id">
          <!-- Per-layer gap control (between previous layer and this one) -->
          <div v-if="idx > 0" class="layer-gap-handle">
            <div class="layer-gap-line"></div>
            <div class="layer-gap-pill">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 2.5h6M1 5.5h6"/></svg>
              <input
                type="number" class="layer-gap-input"
                min="0" max="80"
                :value="store.layers[idx - 1].gapAfter ?? 12"
                @input="store.updateLayerGap(store.layers[idx - 1].id, parseInt($event.target.value) || 0)"
              >
            </div>
            <div class="layer-gap-line"></div>
          </div>

          <div class="layer-item">
            <div class="layer-header">
              <span class="layer-type-badge" :class="layer.type">{{ typeIcon(layer.type) }}</span>
              <input class="layer-label-input" type="text" :value="layer.label" @input="store.updateLayerLabel(layer.id, $event.target.value)" @focus="$event.target.select()">
              <div class="layer-actions">
                <button class="layer-btn" :disabled="!canMoveUp(idx)" @click="moveUp(idx)" title="Move up">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6.5 5 3.5 8 6.5"/></svg>
                </button>
                <button class="layer-btn" :disabled="!canMoveDown(idx)" @click="moveDown(idx)" title="Move down">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5 5 6.5 8 3.5"/></svg>
                </button>
                <button class="layer-btn layer-btn-delete" @click="removeLayer(layer.id)" title="Remove layer">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 2.5 7.5 7.5M7.5 2.5 2.5 7.5"/></svg>
                </button>
              </div>
            </div>
            <textarea v-if="layer.type === 'text'" class="layer-value" :value="layer.value" @input="store.updateLayerValue(layer.id, $event.target.value)" placeholder="Text content..."></textarea>
            <input v-else class="layer-value" type="text" :value="layer.value" @input="store.updateLayerValue(layer.id, $event.target.value)" :placeholder="layer.type === 'headline' ? 'Headline text...' : layer.type === 'cta' ? 'Button label...' : 'Text...'">
          </div>
        </template>

        <div class="add-layer-wrap">
          <button class="btn-add-layer" @click="showAddMenu = !showAddMenu" @blur="onAddMenuBlur">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 1v10M1 6h10"/></svg>
            Add Layer
          </button>
          <div v-if="showAddMenu" class="add-layer-menu">
            <button @mousedown.prevent="addLayer('headline')">
              <span class="layer-type-badge headline" style="width:16px;height:16px;font-size:9px">H</span> Headline
            </button>
            <button @mousedown.prevent="addLayer('text')">
              <span class="layer-type-badge text" style="width:16px;height:16px;font-size:9px">T</span> Text Block
            </button>
            <button @mousedown.prevent="addLayer('cta')">
              <span class="layer-type-badge cta" style="width:16px;height:16px;font-size:9px">C</span> CTA Button
            </button>
          </div>
        </div>
      </div>

      <!-- ─── Bulk Data ────────────────────────────────────────────── -->
      <div class="ctrl-sub-label">BULK DATA</div>
      <div class="ctrl-body-section">
        <BulkDataPanel @export-bulk="$emit('export-bulk')" />
      </div>

      <!-- ─── Logo ───────────────────────────────────────────────── -->
      <div class="ctrl-sub-label">LOGO</div>
      <div class="ctrl-body-section">
        <div class="ctrl-field">
          <label>Logo Image URL</label>
          <div class="url-row">
            <input type="url" :value="store.logoUrl" @input="store.logoUrl = $event.target.value">
            <button class="btn-load" style="background:#64748b" @click="$emit('clear-logo')">Clear</button>
          </div>
        </div>
      </div>

    </div>

    <!-- ─── Export ───────────────────────────────────────────────── -->
    <div class="export-section">
      <button class="btn-export-all" :disabled="!sourceReady || sourceType === 'video'" @click="$emit('export-all')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:15px;height:15px"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
        Download All (ZIP)
      </button>
      <div v-if="sourceType === 'video'" class="video-export-note">Video sources: preview only — individual WebM export per banner</div>
    </div>
  </div>
</template>

<style scoped>
/* ── Control panel body ─────────────────────────────────────────────────────── */
.ctrl-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Panel header — matches toolbar / Design header at 45px ────────────────── */
.ctrl-header {
  display: flex;
  align-items: center;
  height: 45px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  background: var(--card-bg);
  flex-shrink: 0;
}

/* ── Scrollable area below header ──────────────────────────────────────────── */
.ctrl-scroll {
  flex: 1;
  overflow-y: auto;
  background: var(--bg, #f8fafc);
}

/* ── Sub-section label — like BACKGROUND / OVERLAY in Design panel ─────────── */
.ctrl-sub-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  padding: 14px 16px 0;
  border-top: 1px solid var(--border);
}

/* ── Body section content area ─────────────────────────────────────────────── */
.ctrl-body-section { padding: 14px 16px; }

/* ── Control fields ─────────────────────────────────────────────────────────── */
.ctrl-field { margin-bottom: 11px; }
.ctrl-field:last-child { margin-bottom: 0; }
.ctrl-field-row { display: flex; gap: 12px; margin-bottom: 11px; align-items: flex-start; min-width: 0; }
.ctrl-field-row .ctrl-field { margin-bottom: 0; min-width: 0; }
.ctrl-field label { display: block; font-size: 12px; font-weight: 500; color: var(--text-muted); margin-bottom: 4px; }

.ctrl-field input[type="text"],
.ctrl-field input[type="url"],
.ctrl-field input[type="number"],
.ctrl-field textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px;
  font-size: 13px;
  font-family: inherit;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text);
  resize: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ctrl-field input:focus, .ctrl-field textarea:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
}

.ctrl-field textarea { height: 100px; }

/* ── Content layer items ───────────────────────────────────────────────────── */
.layer-item {
  background: var(--card-bg);
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 7px 9px 8px;
}

.layer-header {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
}

.layer-type-badge {
  width: 18px; height: 18px;
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700;
  flex-shrink: 0; line-height: 1;
}
.layer-type-badge.headline { background: #dbeafe; color: #2563eb; }
.layer-type-badge.text     { background: #f1f5f9; color: #64748b; }
.layer-type-badge.cta      { background: #fce7f3; color: #db2777; }

.layer-header .layer-label-input,
.layer-header input.layer-label-input {
  flex: 1; min-width: 0;
  border: none !important;
  background: transparent;
  font-size: 11px !important; font-weight: 600;
  color: var(--text);
  padding: 2px 4px !important;
  border-radius: 4px;
  font-family: inherit;
  height: auto !important; line-height: 1.3;
  transition: background 0.12s;
}
.layer-header .layer-label-input:hover { background: var(--bg); }
.layer-header .layer-label-input:focus { outline: none; background: var(--bg); }

.layer-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }

.layer-btn {
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent;
  color: var(--text-muted);
  cursor: pointer; border-radius: 4px; padding: 0;
  transition: background 0.12s, color 0.12s;
}
.layer-btn:hover:not(:disabled) { background: var(--bg); color: var(--text); }
.layer-btn:disabled { opacity: 0.25; cursor: default; }
.layer-btn-delete:hover:not(:disabled) { background: #fef2f2; color: #ef4444; }

.layer-item .layer-value,
.layer-item input.layer-value,
.layer-item textarea.layer-value {
  width: 100%; box-sizing: border-box;
  padding: 5px 8px !important;
  font-size: 12px !important;
  font-family: inherit;
  border: 1.5px solid var(--border);
  border-radius: 6px;
  background: var(--bg); color: var(--text);
  resize: none; line-height: 1.4;
  height: auto !important;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.layer-item textarea.layer-value { height: 48px !important; }
.layer-value:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
}

/* ── Gap indicator between layers ──────────────────────────────────────────── */
.layer-gap-handle {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 12px;
  margin: 3px 0;
}

.layer-gap-line {
  flex: 1;
  height: 0;
  border-top: 1px dashed var(--border);
}

.layer-gap-pill {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 5px 2px 4px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  cursor: default;
  transition: border-color 0.15s, box-shadow 0.15s;
  flex-shrink: 0;
}
.layer-gap-pill:hover {
  border-color: #a5b4fc;
}
.layer-gap-pill:focus-within {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99,102,241,0.1);
}
.layer-gap-pill svg {
  opacity: 0.45;
  flex-shrink: 0;
}

.layer-gap-input {
  width: 26px !important;
  min-width: 0;
  text-align: center;
  padding: 0 !important;
  font-size: 10px !important;
  font-family: inherit;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border: none !important;
  background: transparent;
  color: var(--text-muted);
  line-height: 1;
  -moz-appearance: textfield;
}
.layer-gap-input::-webkit-inner-spin-button,
.layer-gap-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.layer-gap-input:focus {
  outline: none;
  color: var(--text);
}

/* ── Add layer ─────────────────────────────────────────────────────────────── */
.add-layer-wrap { position: relative; margin-top: 5px; }

.btn-add-layer {
  width: 100%; padding: 5px 10px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-size: 12px; font-weight: 600; font-family: inherit;
  color: var(--text-muted);
  background: transparent;
  border: 1.5px dashed var(--border);
  border-radius: 8px;
  cursor: pointer; transition: all 0.15s;
}
.btn-add-layer:hover { border-color: #6366f1; color: #6366f1; background: rgba(99,102,241,0.04); }

.add-layer-menu {
  position: absolute;
  top: 100%; left: 0; right: 0;
  margin-top: 4px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  padding: 4px;
  z-index: 10;
}
.add-layer-menu button {
  width: 100%;
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px;
  font-size: 12.5px; font-weight: 500; font-family: inherit;
  color: var(--text); background: transparent;
  border: none; border-radius: 6px;
  cursor: pointer; transition: background 0.12s;
}
.add-layer-menu button:hover { background: var(--bg); }

/* ── URL row ────────────────────────────────────────────────────────────────── */
.url-row { display: flex; gap: 6px; }
.url-row input { flex: 1; min-width: 0; }

/* ── Load / action buttons ──────────────────────────────────────────────────── */
.btn-load {
  padding: 7px 13px;
  background: #6366f1; color: white;
  border: none; border-radius: var(--radius-sm);
  font-size: 12px; font-weight: 600;
  cursor: pointer; white-space: nowrap;
  font-family: inherit; transition: background 0.15s;
}
.btn-load:hover { background: #4f46e5; }

/* ── Source status ──────────────────────────────────────────────────────────── */
.tpl-src-status {
  margin-top: 6px;
  font-size: 11.5px; font-weight: 500;
  display: flex; align-items: center; gap: 5px;
  min-height: 18px;
}
.tpl-src-status.ok  { color: #16a34a; }
.tpl-src-status.err { color: #dc2626; }
.tpl-src-status.load { color: #6366f1; }


/* ── Asset list ──────────────────────────────────────────────────────────── */
.asset-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-bottom: 6px;
}

.asset-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}
.asset-row:hover { background: rgba(99,102,241,0.06); }
.asset-row.active { background: rgba(99,102,241,0.08); }

.asset-row-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #cbd5e1;
  flex-shrink: 0;
  transition: background 0.15s;
}
.asset-row-dot.on { background: #6366f1; }

.asset-row-label {
  flex: 1; min-width: 0;
  font-size: 12px; font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-row.active .asset-row-label { font-weight: 600; color: #6366f1; }

.asset-row-load, .asset-row-remove {
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent;
  color: var(--text-muted);
  cursor: pointer; border-radius: 4px; padding: 0;
  opacity: 0;
  transition: opacity 0.12s, background 0.12s, color 0.12s;
  flex-shrink: 0;
}
.asset-row:hover .asset-row-load,
.asset-row:hover .asset-row-remove { opacity: 0.6; }
.asset-row-load:hover { opacity: 1 !important; background: var(--bg); color: var(--text); }
.asset-row-remove:hover { opacity: 1 !important; background: #fef2f2; color: #ef4444; }

/* ── URL add row ─────────────────────────────────────────────────────────── */
.url-add-row {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}
.url-add-row input {
  flex: 1; min-width: 0;
  padding: 6px 9px;
  font-size: 12px;
  font-family: inherit;
  border: 1.5px solid var(--border);
  border-radius: 7px;
  background: var(--card-bg);
  color: var(--text);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.url-add-row input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
}

.url-add-btn {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid var(--border);
  border-radius: 7px;
  background: var(--bg);
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.12s;
}
.url-add-btn:hover {
  border-color: #6366f1; color: #6366f1; background: #f5f3ff;
}
.url-add-btn:disabled { opacity: 0.3; cursor: default; }
.url-add-btn:disabled:hover { border-color: var(--border); color: var(--text-muted); background: var(--bg); }

/* ── Focal bar ───────────────────────────────────────────────────────────── */
.focal-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 8px 0 6px;
}

.focal-pill {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  border: 1.5px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  transition: all 0.12s;
}
.focal-pill:hover { border-color: #a5b4fc; }
.focal-pill.on {
  border-color: #6366f1;
  background: #ede9fe;
  color: #6366f1;
}

/* ── Element toggles ──────────────────────────────────────────────────────── */
.elem-toggle {
  padding: 4px 12px; border-radius: 20px;
  font-size: 12px; font-weight: 500; cursor: pointer;
  border: 1.5px solid var(--border);
  background: var(--bg); color: var(--text-muted);
  font-family: inherit; transition: all 0.12s;
}
.elem-toggle.on { border-color: #6366f1; background: #ede9fe; color: #6366f1; }
.elem-toggle.small { padding: 2px 9px; font-size: 11px; }

/* ── Export section ─────────────────────────────────────────────────────────── */
.export-section { padding: 16px; margin-top: auto; border-top: 1px solid var(--border); }
.btn-export-all {
  width: 100%; padding: 10px;
  background: #6366f1; color: white;
  border: none; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 600;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 7px;
  font-family: inherit; transition: background 0.15s;
}
.btn-export-all:hover { background: #4f46e5; }
.btn-export-all:disabled { opacity: 0.45; cursor: default; background: #6366f1; }
.video-export-note {
  margin-top: 7px;
  font-size: 11px; color: var(--text-muted);
  text-align: center; line-height: 1.5;
}

/* ── Focal point coords ──────────────────────────────────────────────────── */
.fp-coords {
  display: flex; gap: 12px; align-items: center;
  margin-top: 6px;
  font-size: 11px; font-weight: 600;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.fp-reset {
  margin-left: auto;
  font-size: 11px; font-weight: 500;
  color: #6366f1; background: none;
  border: none; cursor: pointer; padding: 0;
  font-family: inherit;
}
.fp-reset:hover { text-decoration: underline; }
.fp-area-dims {
  color: var(--text-muted); opacity: 0.7;
  font-size: 10px; font-weight: 500;
}
</style>
