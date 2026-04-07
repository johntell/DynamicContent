<script setup>
import { ref } from 'vue';
import { useTemplateBuilderStore } from '../../stores/templateBuilder.js';
import { useBulkDataStore } from '../../stores/bulkData.js';
import { parseSpreadsheet } from '../../composables/useSpreadsheetParser.js';

const store = useTemplateBuilderStore();
const bulk = useBulkDataStore();

const emit = defineEmits(['export-bulk']);
const dragOver = ref(false);
const parseError = ref('');

// ── File handling ──────────────────────────────────────────────
async function handleFile(file) {
  if (!file) return;
  parseError.value = '';
  try {
    const { rows, columns } = await parseSpreadsheet(file);
    bulk.importData(rows, columns, file.name, store.layers);
  } catch (e) {
    parseError.value = e.message;
  }
}

function onFileInput(e) {
  handleFile(e.target.files?.[0]);
  e.target.value = ''; // reset so same file can be re-picked
}

function onDrop(e) {
  e.preventDefault();
  dragOver.value = false;
  handleFile(e.dataTransfer?.files?.[0]);
}

function onDragOver(e) { e.preventDefault(); dragOver.value = true; }
function onDragLeave() { dragOver.value = false; }

// ── Row stepper ────────────────────────────────────────────────
function onRowInput(e) {
  const val = parseInt(e.target.value);
  if (!isNaN(val)) bulk.setActiveRow(val - 1);
}
</script>

<template>
  <div class="bulk-panel">

    <!-- Empty state: file drop zone -->
    <template v-if="!bulk.isActive">
      <div
        class="bulk-dropzone"
        :class="{ hover: dragOver }"
        @drop="onDrop"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @click="$refs.fileInput.click()"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/>
        </svg>
        <span>Drop CSV / XLSX or click to browse</span>
        <input ref="fileInput" type="file" accept=".csv,.xlsx,.xls,.tsv" @change="onFileInput" style="display:none">
      </div>
      <div v-if="parseError" class="bulk-error">{{ parseError }}</div>
    </template>

    <!-- Active state: mapping + stepper -->
    <template v-else>

      <!-- File info bar -->
      <div class="bulk-file-bar">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        <span class="bulk-file-name">{{ bulk.fileName }}</span>
        <span class="bulk-row-count">{{ bulk.rowCount }} rows</span>
        <button class="bulk-clear-btn" @click="bulk.reset()" title="Remove spreadsheet">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 2.5 7.5 7.5M7.5 2.5 2.5 7.5"/></svg>
        </button>
      </div>

      <!-- Column mapping -->
      <div class="bulk-mapping">
        <div class="bulk-mapping-title">Column mapping</div>
        <div v-for="layer in store.layers" :key="layer.id" class="bulk-map-row">
          <span class="bulk-map-label">{{ layer.label || layer.id }}</span>
          <select
            class="bulk-map-select"
            :value="bulk.columnMapping[layer.id] || ''"
            @change="bulk.setMapping(layer.id, $event.target.value)"
          >
            <option value="">-- unmapped --</option>
            <option v-for="col in bulk.columns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>

        <!-- Source image column -->
        <div class="bulk-map-row">
          <span class="bulk-map-label muted">Source image</span>
          <select
            class="bulk-map-select"
            :value="bulk.sourceImageColumn"
            @change="bulk.sourceImageColumn = $event.target.value"
          >
            <option value="">-- unmapped --</option>
            <option v-for="col in bulk.columns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>

        <!-- Logo column -->
        <div class="bulk-map-row">
          <span class="bulk-map-label muted">Logo</span>
          <select
            class="bulk-map-select"
            :value="bulk.logoColumn"
            @change="bulk.logoColumn = $event.target.value"
          >
            <option value="">-- unmapped --</option>
            <option v-for="col in bulk.columns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
      </div>

      <!-- Row stepper -->
      <div class="bulk-stepper">
        <button class="bulk-step-btn" :disabled="bulk.activeRowIndex <= 0" @click="bulk.prevRow()">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1.5 3.5 5 7 8.5"/></svg>
        </button>
        <span class="bulk-step-info">
          Row
          <input
            type="number" class="bulk-step-input"
            :value="bulk.activeRowIndex + 1"
            min="1" :max="bulk.rowCount"
            @change="onRowInput"
          >
          of {{ bulk.rowCount }}
        </span>
        <button class="bulk-step-btn" :disabled="bulk.activeRowIndex >= bulk.rowCount - 1" @click="bulk.nextRow()">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 1.5 6.5 5 3 8.5"/></svg>
        </button>
      </div>

      <!-- Row preview: show current row values -->
      <div v-if="bulk.activeRow" class="bulk-preview">
        <div v-for="col in bulk.columns" :key="col" class="bulk-preview-row">
          <span class="bulk-preview-col">{{ col }}</span>
          <span class="bulk-preview-val">{{ bulk.activeRow[col] }}</span>
        </div>
      </div>

      <!-- Bulk export -->
      <div class="bulk-export">
        <button
          class="bulk-export-btn"
          :disabled="bulk.isExporting"
          @click="$emit('export-bulk')"
        >
          <svg v-if="!bulk.isExporting" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <template v-if="bulk.isExporting">
            Exporting... {{ Math.round(bulk.exportProgress * 100) }}%
          </template>
          <template v-else>
            Export All ({{ bulk.rowCount }} &times; {{ store.formats.length }} = {{ bulk.rowCount * store.formats.length }} images)
          </template>
        </button>
        <div v-if="bulk.isExporting" class="bulk-progress">
          <div class="bulk-progress-bar" :style="{ width: (bulk.exportProgress * 100) + '%' }"></div>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.bulk-panel { font-size: 12px; }

/* ── Drop zone ─────────────────────────────────────────────────── */
.bulk-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 16px;
  border: 1.5px dashed var(--border);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.15s;
  text-align: center;
}
.bulk-dropzone:hover, .bulk-dropzone.hover {
  border-color: #6366f1;
  color: #6366f1;
  background: rgba(99,102,241,0.04);
}
.bulk-dropzone span { font-size: 11.5px; font-weight: 500; }
.bulk-error { margin-top: 6px; font-size: 11px; color: #dc2626; }

/* ── File info bar ─────────────────────────────────────────────── */
.bulk-file-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(99,102,241,0.06);
  border-radius: 6px;
  color: #6366f1;
  margin-bottom: 10px;
}
.bulk-file-name {
  font-size: 11px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bulk-row-count {
  font-size: 10px;
  font-weight: 500;
  background: rgba(99,102,241,0.12);
  padding: 1px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}
.bulk-clear-btn {
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: #6366f1;
  cursor: pointer; border-radius: 4px; padding: 0;
  opacity: 0.6; transition: opacity 0.12s;
  flex-shrink: 0;
}
.bulk-clear-btn:hover { opacity: 1; }

/* ── Column mapping ────────────────────────────────────────────── */
.bulk-mapping { margin-bottom: 10px; }
.bulk-mapping-title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.bulk-map-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.bulk-map-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
  width: 90px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bulk-map-label.muted { color: var(--text-muted); font-weight: 500; font-style: italic; }
.bulk-map-select {
  flex: 1;
  min-width: 0;
  padding: 3px 6px;
  font-size: 11px;
  font-family: inherit;
  border: 1.5px solid var(--border);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text);
  cursor: pointer;
}
.bulk-map-select:focus { outline: none; border-color: #6366f1; }

/* ── Row stepper ───────────────────────────────────────────────── */
.bulk-stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
.bulk-step-btn {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid var(--border);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.12s;
}
.bulk-step-btn:hover:not(:disabled) { border-color: #6366f1; color: #6366f1; }
.bulk-step-btn:disabled { opacity: 0.3; cursor: default; }
.bulk-step-info {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}
.bulk-step-input {
  width: 38px;
  text-align: center;
  padding: 2px 4px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  border: 1.5px solid var(--border);
  border-radius: 4px;
  background: var(--card-bg);
  color: var(--text);
  -moz-appearance: textfield;
}
.bulk-step-input::-webkit-inner-spin-button,
.bulk-step-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.bulk-step-input:focus { outline: none; border-color: #6366f1; }

/* ── Row preview ───────────────────────────────────────────────── */
.bulk-preview {
  max-height: 120px;
  overflow-y: auto;
  margin-bottom: 10px;
}
.bulk-preview-row {
  display: flex;
  gap: 6px;
  padding: 2px 0;
  font-size: 10.5px;
  line-height: 1.4;
}
.bulk-preview-col {
  width: 80px;
  flex-shrink: 0;
  font-weight: 600;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bulk-preview-val {
  flex: 1;
  min-width: 0;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Bulk export ───────────────────────────────────────────────── */
.bulk-export { margin-top: 4px; }
.bulk-export-btn {
  width: 100%;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  color: white;
  background: #6366f1;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.bulk-export-btn:hover:not(:disabled) { background: #4f46e5; }
.bulk-export-btn:disabled { opacity: 0.7; cursor: default; }

.bulk-progress {
  margin-top: 6px;
  height: 3px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}
.bulk-progress-bar {
  height: 100%;
  background: #6366f1;
  border-radius: 2px;
  transition: width 0.15s ease;
}
</style>
