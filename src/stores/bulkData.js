import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useBulkDataStore = defineStore('bulkData', () => {
  // ── State ──────────────────────────────────────────────────────
  const rows = ref([]);           // Array of row objects { colName: value, ... }
  const columns = ref([]);        // String[] column headers
  const columnMapping = ref({});  // { layerId: columnName }
  const sourceImageColumn = ref('');
  const logoColumn = ref('');
  const activeRowIndex = ref(0);
  const isActive = ref(false);
  const fileName = ref('');

  // ── Export progress ────────────────────────────────────────────
  const exportProgress = ref(0);   // 0..1
  const isExporting = ref(false);

  // ── Getters ────────────────────────────────────────────────────
  const rowCount = computed(() => rows.value.length);
  const activeRow = computed(() => rows.value[activeRowIndex.value] ?? null);

  // ── Actions ────────────────────────────────────────────────────

  /**
   * Import parsed spreadsheet data.
   * @param {Object[]} parsedRows - array of row objects
   * @param {string[]} parsedColumns - column header names
   * @param {string} name - original filename
   * @param {Object[]} layers - store.layers for auto-mapping
   */
  function importData(parsedRows, parsedColumns, name, layers = []) {
    rows.value = parsedRows;
    columns.value = parsedColumns;
    fileName.value = name;
    activeRowIndex.value = 0;
    isActive.value = true;

    // Auto-map columns to layers by fuzzy name match
    const mapping = {};
    for (const layer of layers) {
      const match = findBestColumnMatch(layer, parsedColumns);
      if (match) mapping[layer.id] = match;
    }
    columnMapping.value = mapping;

    // Auto-detect source image / logo columns
    sourceImageColumn.value = parsedColumns.find(c =>
      /^(image|source|photo|asset|url|image.?url|source.?url)$/i.test(c.trim())
    ) || '';
    logoColumn.value = parsedColumns.find(c =>
      /^(logo|logo.?url|brand.?logo)$/i.test(c.trim())
    ) || '';
  }

  /** Fuzzy match a layer to a column by label or id */
  function findBestColumnMatch(layer, cols) {
    const nameLC = (layer.label || layer.id || '').toLowerCase().trim();
    const typeLC = (layer.type || '').toLowerCase();

    // Exact match on label
    const exact = cols.find(c => c.toLowerCase().trim() === nameLC);
    if (exact) return exact;

    // Exact match on type (headline, cta)
    const typeMatch = cols.find(c => c.toLowerCase().trim() === typeLC);
    if (typeMatch) return typeMatch;

    // Partial match: column contains layer label or vice versa
    const partial = cols.find(c => {
      const cLC = c.toLowerCase().trim();
      return cLC.includes(nameLC) || nameLC.includes(cLC);
    });
    if (partial) return partial;

    return null;
  }

  function setMapping(layerId, columnName) {
    if (columnName) {
      columnMapping.value[layerId] = columnName;
    } else {
      delete columnMapping.value[layerId];
    }
    // Trigger reactivity
    columnMapping.value = { ...columnMapping.value };
  }

  function setActiveRow(index) {
    activeRowIndex.value = Math.max(0, Math.min(index, rows.value.length - 1));
  }

  function nextRow() { setActiveRow(activeRowIndex.value + 1); }
  function prevRow() { setActiveRow(activeRowIndex.value - 1); }

  /**
   * Build a drawState with layer values overridden from a specific row.
   * @param {number} rowIndex
   * @param {Object} baseDrawState - the original drawState from the store
   * @returns {Object} overridden drawState
   */
  function buildRowDrawState(rowIndex, baseDrawState) {
    const row = rows.value[rowIndex];
    if (!row) return baseDrawState;

    const overriddenLayers = baseDrawState.layers.map(layer => {
      const col = columnMapping.value[layer.id];
      if (col && row[col] != null && String(row[col]).trim() !== '') {
        return { ...layer, value: String(row[col]) };
      }
      return layer;
    });

    // Also update the top-level headline/cta shortcuts the renderer uses
    const headlineLayer = overriddenLayers.find(l => l.type === 'headline');
    const ctaLayer = overriddenLayers.find(l => l.type === 'cta');

    return {
      ...baseDrawState,
      layers: overriddenLayers,
      headline: headlineLayer?.value ?? baseDrawState.headline,
      cta: ctaLayer?.value ?? baseDrawState.cta,
      // Attach overrides for source/logo (consumer uses these)
      _sourceUrlOverride: sourceImageColumn.value ? (row[sourceImageColumn.value] || '') : '',
      _logoUrlOverride: logoColumn.value ? (row[logoColumn.value] || '') : '',
    };
  }

  function reset() {
    rows.value = [];
    columns.value = [];
    columnMapping.value = {};
    sourceImageColumn.value = '';
    logoColumn.value = '';
    activeRowIndex.value = 0;
    isActive.value = false;
    fileName.value = '';
    exportProgress.value = 0;
    isExporting.value = false;
  }

  return {
    // State
    rows, columns, columnMapping, sourceImageColumn, logoColumn,
    activeRowIndex, isActive, fileName,
    exportProgress, isExporting,
    // Getters
    rowCount, activeRow,
    // Actions
    importData, setMapping, setActiveRow, nextRow, prevRow,
    buildRowDrawState, reset,
  };
});
