import { defineStore } from 'pinia';
import { ref, reactive, computed, watch } from 'vue';
import { useProjectManagerStore } from './projectManager.js';

// ── Constants ────────────────────────────────────────────────────────────────

const LEGACY_STORAGE_KEY = 'tpl_builder_v7';
const LEGACY_KEYS = ['tpl_builder_v6', 'tpl_builder_v5', 'tpl_builder_v4', 'tpl_builder_v3', 'tpl_builder_v2', 'tpl_builder_v1'];

const DEFAULT_GAP = 12;

const DEFAULT_LAYERS = [
  { id: 'headline', type: 'headline', label: 'Headline', value: 'Aprimo DAM', mappedField: null, gapAfter: DEFAULT_GAP },
  { id: 'text',     type: 'text',     label: 'Text',     value: 'Make the most out of your assets with single-purpose applications.', mappedField: null, gapAfter: DEFAULT_GAP },
  { id: 'cta',      type: 'cta',      label: 'CTA',      value: 'Learn more', mappedField: null, gapAfter: DEFAULT_GAP },
];

const DEFAULT_FORMATS = [
  { id: 'default-3x2', label: 'Default 3:2', w: 900, h: 600, anchor: 'bl', layerAnchors: {}, logoAnchor: '', visibleLayers: ['headline', 'text', 'cta'], logoSize: 0.06, contentScale: 1, contentWidth: 50 },
];

const DEFAULT_STYLES = {
  // Headline
  headlineFont: 'Playfair Display',
  headlineFontSize: 32,
  headlineFontWeight: '700',
  headlineColor: '#ffffff',

  // Text
  textFont: 'Poppins',
  textFontSize: 16,
  textFontWeight: '400',
  textColor: '#ffffff',

  // CTA
  ctaFont: 'Outfit',
  ctaFontSize: 16,
  ctaFontWeight: '400',
  ctaTextColor: '#ffffff',
  accentColor: '#6366f1',
  ctaPadH: 20,
  ctaPadV: 10,
  ctaRadius: 50,

  // Spacing (baseline gap between content elements in px at reference size)
  contentGap: 12,

  // Overlay
  overlayColor: '#000000',
  overlayOpacity: 0.65,

  // Background (drawn behind the image — does not affect image layout)
  bgMode: 'none',          // 'none' | 'color' | 'linear' | 'radial'
  bgColor1: '#0f172a',
  bgColor2: '#1e293b',
  bgAngle: 180,            // degrees, for linear gradient
  bgDistance: 100,          // 0-200%, controls how far the gradient extends
};

function generateAssetId() {
  return 'asset_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Migrate legacy v1 format (showTitle/showText/showCta) → v3 (visibleLayers) */
function migrateFormat(fmt) {
  if (fmt.visibleLayers) {
    // Migrate subline → text in visibleLayers
    fmt.visibleLayers = fmt.visibleLayers.map(id => id === 'subline' ? 'text' : id);
  } else {
    const vis = [];
    if (fmt.showTitle !== false) vis.push('headline');
    if (fmt.showText !== false) vis.push('text');
    if (fmt.showCta !== false) vis.push('cta');
    const { showTitle, showText, showCta, ...rest } = fmt;
    Object.assign(fmt, rest);
    fmt.visibleLayers = vis;
  }
  // Ensure layerAnchors exists (v7+)
  if (!fmt.layerAnchors) fmt.layerAnchors = {};
  return fmt;
}

/** Migrate layers: convert subline → text, ensure gapAfter exists */
function migrateLayers(layers) {
  return layers.map(l => {
    const out = l.gapAfter == null ? { ...l, gapAfter: DEFAULT_GAP } : l;
    if (out.type === 'subline' || out.id === 'subline') {
      return { ...out, type: 'text', id: out.id === 'subline' ? 'text' : out.id, label: out.label === 'Subline' ? 'Text' : out.label };
    }
    return out;
  });
}

/** Migrate v2 styles → v3 */
function migrateStyles(s) {
  const out = { ...DEFAULT_STYLES };
  // Map old flat keys to new per-type keys
  if (s.headlineFont) out.headlineFont = s.headlineFont;
  if (s.headlineFontSize) out.headlineFontSize = s.headlineFontSize;
  if (s.headlineFontWeight) out.headlineFontWeight = s.headlineFontWeight;
  else if (s.fontWeight) out.headlineFontWeight = s.fontWeight;
  if (s.headlineColor) out.headlineColor = s.headlineColor;
  else if (s.textColor) out.headlineColor = s.textColor;

  if (s.textFont) out.textFont = s.textFont;
  if (s.textFontSize) out.textFontSize = s.textFontSize;
  if (s.textFontWeight) out.textFontWeight = s.textFontWeight;
  if (s.textColor) out.textColor = s.textColor;

  if (s.ctaFont) out.ctaFont = s.ctaFont;
  if (s.ctaFontSize != null && !s.ctaFontScale) out.ctaFontSize = s.ctaFontSize;
  else if (s.ctaFontScale != null) out.ctaFontSize = Math.round(11 * (s.ctaFontScale / 100));
  if (s.ctaFontWeight) out.ctaFontWeight = s.ctaFontWeight;
  if (s.ctaTextColor) out.ctaTextColor = s.ctaTextColor;
  if (s.accentColor) out.accentColor = s.accentColor;
  if (s.ctaPadH != null) out.ctaPadH = s.ctaPadH;
  if (s.ctaPadV != null) out.ctaPadV = s.ctaPadV;
  if (s.ctaRadius != null) out.ctaRadius = s.ctaRadius;

  if (s.overlayColor) out.overlayColor = s.overlayColor;
  if (s.overlayOpacity != null) out.overlayOpacity = s.overlayOpacity;

  if (s.bgMode) out.bgMode = s.bgMode;
  if (s.bgColor1) out.bgColor1 = s.bgColor1;
  if (s.bgColor2) out.bgColor2 = s.bgColor2;
  if (s.bgAngle != null) out.bgAngle = s.bgAngle;
  if (s.bgDistance != null) out.bgDistance = s.bgDistance;

  return out;
}

/** Migrate legacy v1 state → v3 */
function migrateLegacyV1(data) {
  const layers = JSON.parse(JSON.stringify(DEFAULT_LAYERS));
  if (data.headline != null) layers.find(l => l.id === 'headline').value = data.headline;
  if (data.subline != null) layers.find(l => l.id === 'text').value = data.subline;
  if (data.cta != null) layers.find(l => l.id === 'cta').value = data.cta;

  const formats = (data.formats || []).map(migrateFormat);

  return {
    layers,
    formats,
    styles: migrateStyles(data),
    sourceUrl: data.sourceUrl || '',
    useSmartCrop: data.useSmartCrop ?? false,
    logoUrl: data.logoUrl ?? 'https://go.aprimo.com/hs-fs/hubfs/Aprimo%20Logos/Aprimo_Logo_RGB_White_png.png',
  };
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useTemplateBuilderStore = defineStore('templateBuilder', () => {

  // ── Content layers ──────────────────────────────────────────────
  const layers = ref(JSON.parse(JSON.stringify(DEFAULT_LAYERS)));

  // ── Formats ─────────────────────────────────────────────────────
  const formats = ref(JSON.parse(JSON.stringify(DEFAULT_FORMATS)));

  // ── Global styles ───────────────────────────────────────────────
  const styles = reactive({ ...DEFAULT_STYLES });

  // ── Assets (multi-asset model — replaces sourceUrl/focalPoint) ─
  const assets = ref([]);
  const activeAssetId = ref('');

  /** Convenience: the active asset object */
  const activeAsset = computed(() => assets.value.find(a => a.id === activeAssetId.value) || null);

  /** Backwards-compatible sourceUrl — points to active asset's URL */
  const sourceUrl = computed({
    get: () => activeAsset.value?.url || '',
    set: (val) => {
      const a = activeAsset.value;
      if (a) { a.url = val; scheduleSave(); }
      else if (val) {
        // Auto-create first asset when setting URL with no assets
        addAsset(val);
      }
    },
  });

  /** Backwards-compatible useSmartCrop */
  const useSmartCrop = computed({
    get: () => activeAsset.value?.useSmartCrop ?? false,
    set: (val) => {
      const a = activeAsset.value;
      if (a) { a.useSmartCrop = val; scheduleSave(); }
    },
  });

  /** Backwards-compatible focalPoint reactive proxy */
  const focalPoint = reactive({
    get x() { return activeAsset.value?.focalX ?? 0.5; },
    set x(v) { const a = activeAsset.value; if (a) { a.focalX = v; scheduleSave(); } },
    get y() { return activeAsset.value?.focalY ?? 0.5; },
    set y(v) { const a = activeAsset.value; if (a) { a.focalY = v; scheduleSave(); } },
    get w() { return activeAsset.value?.focalW ?? 0.30; },
    set w(v) { const a = activeAsset.value; if (a) { a.focalW = v; scheduleSave(); } },
    get h() { return activeAsset.value?.focalH ?? 0.30; },
    set h(v) { const a = activeAsset.value; if (a) { a.focalH = v; scheduleSave(); } },
  });

  /** Backwards-compatible contentAwareFocal */
  const contentAwareFocal = computed({
    get: () => activeAsset.value?.contentAwareFocal ?? true,
    set: (val) => {
      const a = activeAsset.value;
      if (a) { a.contentAwareFocal = val; scheduleSave(); }
    },
  });

  /** Backwards-compatible focalFit */
  const focalFit = computed({
    get: () => activeAsset.value?.focalFit || 'cover',
    set: (val) => {
      const a = activeAsset.value;
      if (a) { a.focalFit = val; scheduleSave(); }
    },
  });

  const logoUrl = ref('https://go.aprimo.com/hs-fs/hubfs/Aprimo%20Logos/Aprimo_Logo_RGB_White_png.png');

  // ── Canvas positions (persisted) — absolute world-space {x,y} per format
  const canvasPositions = reactive({});

  // ── UI state (not persisted) ────────────────────────────────────
  const activeSettingsId = ref(null);
  const statusMsg = ref('');
  const statusType = ref('');
  const availableFields = ref([]);

  // ── Computed ────────────────────────────────────────────────────

  /** Build the drawState object that the renderer expects */
  const drawState = computed(() => {
    const layerMap = {};
    for (const l of layers.value) layerMap[l.id] = l;
    return {
      el: null,
      logo: null,
      headline: layerMap.headline?.value ?? '',
      cta: layerMap.cta?.value ?? '',
      layers: layers.value,
      // Headline style
      headlineFont: styles.headlineFont,
      headlineFontSize: styles.headlineFontSize,
      headlineFontWeight: styles.headlineFontWeight,
      headlineColor: styles.headlineColor,
      // Text style
      textFont: styles.textFont,
      textFontSize: styles.textFontSize,
      textFontWeight: styles.textFontWeight,
      textColor: styles.textColor,
      // CTA style
      ctaFont: styles.ctaFont,
      ctaFontSize: styles.ctaFontSize,
      ctaFontWeight: styles.ctaFontWeight,
      ctaTextColor: styles.ctaTextColor,
      accentColor: styles.accentColor,
      ctaPadH: styles.ctaPadH,
      ctaPadV: styles.ctaPadV,
      ctaRadius: styles.ctaRadius,
      // Spacing
      contentGap: styles.contentGap,
      // Overlay
      overlayColor: styles.overlayColor,
      overlayOpacity: styles.overlayOpacity,
      // Background
      bgMode: styles.bgMode,
      bgColor1: styles.bgColor1,
      bgColor2: styles.bgColor2,
      bgAngle: styles.bgAngle,
      bgDistance: styles.bgDistance,
      // Focal point / area
      focalX: focalPoint.x,
      focalY: focalPoint.y,
      focalW: focalPoint.w,
      focalH: focalPoint.h,
      contentAwareFocal: contentAwareFocal.value,
      focalFit: focalFit.value,
    };
  });

  const activeFormat = computed(() => {
    if (!activeSettingsId.value) return null;
    return formats.value.find(f => f.id === activeSettingsId.value) || null;
  });

  // ── Asset actions ──────────────────────────────────────────────

  function addAsset(url = '', label = '') {
    const id = generateAssetId();
    assets.value.push({
      id, url, label,
      focalX: 0.5, focalY: 0.5,
      focalW: 0.30, focalH: 0.30,
      focalFit: 'cover',
      contentAwareFocal: true,
      useSmartCrop: false,
    });
    activeAssetId.value = id;
    scheduleSave();
    return id;
  }

  function removeAsset(id) {
    const idx = assets.value.findIndex(a => a.id === id);
    if (idx === -1) return;
    assets.value.splice(idx, 1);
    if (activeAssetId.value === id) {
      activeAssetId.value = assets.value[0]?.id || '';
    }
    scheduleSave();
  }

  function setActiveAsset(id) {
    if (assets.value.find(a => a.id === id)) {
      activeAssetId.value = id;
    }
  }

  function updateAsset(id, field, value) {
    const a = assets.value.find(a => a.id === id);
    if (a) { a[field] = value; scheduleSave(); }
  }

  // ── Layer actions ───────────────────────────────────────────────

  function addLayer(type = 'text', label = '') {
    const id = `layer_${Date.now().toString(36)}`;
    const defaults = {
      headline: { label: 'Headline', value: '' },
      cta: { label: 'CTA', value: '' },
      text: { label: label || 'Text', value: '' },
    };
    const def = defaults[type] || defaults.text;
    layers.value.push({ id, type, label: def.label, value: def.value, mappedField: null, gapAfter: DEFAULT_GAP });
    for (const fmt of formats.value) {
      if (!fmt.visibleLayers) fmt.visibleLayers = [];
      fmt.visibleLayers.push(id);
    }
    scheduleSave();
    return id;
  }

  function removeLayer(id) {
    const idx = layers.value.findIndex(l => l.id === id);
    if (idx === -1) return;
    layers.value.splice(idx, 1);
    for (const fmt of formats.value) {
      if (fmt.visibleLayers) {
        const vi = fmt.visibleLayers.indexOf(id);
        if (vi !== -1) fmt.visibleLayers.splice(vi, 1);
      }
    }
    scheduleSave();
  }

  function reorderLayers(fromIdx, toIdx) {
    const item = layers.value.splice(fromIdx, 1)[0];
    layers.value.splice(toIdx, 0, item);
    scheduleSave();
  }

  function updateLayerValue(id, value) {
    const layer = layers.value.find(l => l.id === id);
    if (layer) { layer.value = value; scheduleSave(); }
  }

  function updateLayerLabel(id, label) {
    const layer = layers.value.find(l => l.id === id);
    if (layer) { layer.label = label; scheduleSave(); }
  }

  function updateLayerGap(id, gap) {
    const layer = layers.value.find(l => l.id === id);
    if (layer) { layer.gapAfter = Math.max(0, gap); scheduleSave(); }
  }

  function setFieldMapping(layerId, fieldName) {
    const layer = layers.value.find(l => l.id === layerId);
    if (layer) {
      layer.mappedField = fieldName || null;
      if (fieldName && availableFields.value.length) {
        const match = availableFields.value.find(f => f.name === fieldName);
        if (match && match.value) layer.value = match.value;
      }
      scheduleSave();
    }
  }

  // ── Format actions ──────────────────────────────────────────────

  function addFormat(label, w, h, x, y) {
    const base = label.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20);
    const id = base + '-' + Date.now().toString(36);
    const visibleLayers = layers.value.map(l => l.id);
    formats.value.push({ id, label, w, h, anchor: 'bl', layerAnchors: {}, logoAnchor: '', visibleLayers, logoSize: 0.08, contentScale: 1, contentWidth: 60 });
    // Place on canvas — if no position given, auto-layout will handle it
    if (x != null && y != null) {
      canvasPositions[id] = { x, y };
    }
    scheduleSave();
    return id;
  }

  function removeFormat(id) {
    if (formats.value.length <= 1) return;
    formats.value = formats.value.filter(f => f.id !== id);
    delete canvasPositions[id];
    if (activeSettingsId.value === id) activeSettingsId.value = null;
    scheduleSave();
  }

  function updateFormat(id, field, value) {
    const fmt = formats.value.find(f => f.id === id);
    if (fmt) { fmt[field] = value; scheduleSave(); }
  }

  function setLayerAnchor(formatId, layerId, anchor) {
    const fmt = formats.value.find(f => f.id === formatId);
    if (!fmt) return;
    if (!fmt.layerAnchors) fmt.layerAnchors = {};
    if (!anchor || anchor === fmt.anchor) {
      // Null or same as group anchor → inherit (remove override)
      delete fmt.layerAnchors[layerId];
    } else {
      fmt.layerAnchors[layerId] = anchor;
    }
    scheduleSave();
  }

  function toggleLayerVisibility(formatId, layerId) {
    const fmt = formats.value.find(f => f.id === formatId);
    if (!fmt) return;
    if (!fmt.visibleLayers) fmt.visibleLayers = [];
    const idx = fmt.visibleLayers.indexOf(layerId);
    if (idx !== -1) fmt.visibleLayers.splice(idx, 1);
    else fmt.visibleLayers.push(layerId);
    scheduleSave();
  }

  // ── Per-asset anchor overrides ───────────────────────────────────

  /** Get the effective anchor for a format, considering per-asset overrides */
  function resolveAnchor(fmt) {
    const aid = activeAssetId.value;
    if (aid && fmt.assetAnchors?.[aid]) return fmt.assetAnchors[aid];
    return fmt.anchor || 'bl';
  }

  /** Set or clear an anchor override for the active asset on a format */
  function setAssetAnchor(formatId, anchor) {
    const fmt = formats.value.find(f => f.id === formatId);
    if (!fmt) return;
    const aid = activeAssetId.value;
    if (!aid) return;
    if (!fmt.assetAnchors) fmt.assetAnchors = {};
    if (!anchor || anchor === fmt.anchor) {
      // Same as base anchor → remove override
      delete fmt.assetAnchors[aid];
      if (Object.keys(fmt.assetAnchors).length === 0) delete fmt.assetAnchors;
    } else {
      fmt.assetAnchors[aid] = anchor;
    }
    scheduleSave();
  }

  /** Check if any format has a per-asset anchor override for the active asset */
  function hasAssetAnchorOverride(formatId) {
    const fmt = formats.value.find(f => f.id === formatId);
    const aid = activeAssetId.value;
    return !!(fmt?.assetAnchors?.[aid]);
  }

  // ── Status helpers ──────────────────────────────────────────────

  function setStatus(msg, type = '') {
    statusMsg.value = msg;
    statusType.value = type;
  }

  // ── Snapshot (for project switching) ────────────────────────────

  function toSnapshot() {
    return {
      layers: JSON.parse(JSON.stringify(layers.value)),
      formats: JSON.parse(JSON.stringify(formats.value)),
      styles: { ...styles },
      assets: JSON.parse(JSON.stringify(assets.value)),
      activeAssetId: activeAssetId.value,
      logoUrl: logoUrl.value,
      canvasPositions: { ...canvasPositions },
    };
  }

  function hydrateFromSnapshot(snap) {
    if (!snap) {
      // Empty project — reset to defaults
      layers.value = JSON.parse(JSON.stringify(DEFAULT_LAYERS));
      formats.value = JSON.parse(JSON.stringify(DEFAULT_FORMATS));
      Object.assign(styles, { ...DEFAULT_STYLES });
      assets.value = [];
      activeAssetId.value = '';
      logoUrl.value = 'https://go.aprimo.com/hs-fs/hubfs/Aprimo%20Logos/Aprimo_Logo_RGB_White_png.png';
      Object.keys(canvasPositions).forEach(k => delete canvasPositions[k]);
      activeSettingsId.value = null;
      return '';
    }

    if (snap.layers?.length) layers.value = migrateLayers(snap.layers);
    if (snap.formats?.length) formats.value = snap.formats.map(migrateFormat);
    if (snap.styles) Object.assign(styles, migrateStyles(snap.styles));

    // Multi-asset model
    if (snap.assets?.length) {
      assets.value = snap.assets;
      activeAssetId.value = snap.activeAssetId || snap.assets[0]?.id || '';
    } else {
      assets.value = [];
      activeAssetId.value = '';
    }

    if (snap.logoUrl != null) logoUrl.value = snap.logoUrl;

    // Canvas positions
    Object.keys(canvasPositions).forEach(k => delete canvasPositions[k]);
    if (snap.canvasPositions) Object.assign(canvasPositions, snap.canvasPositions);

    activeSettingsId.value = null;

    return activeAsset.value?.url || '';
  }

  // ── Persistence (delegated to projectManager) ──────────────────

  let _saveTimer = null;

  function scheduleSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      try {
        const pm = useProjectManagerStore();
        pm.saveProjectSnapshot(toSnapshot());
      } catch {}
    }, 200);
  }

  /** Load from active project snapshot (v8) or fall back to legacy */
  function loadSavedState() {
    const pm = useProjectManagerStore();
    const snap = pm.getProjectSnapshot(pm.activeProjectId);

    if (snap) {
      return hydrateFromSnapshot(snap);
    }

    // Legacy migration path — try loading from old localStorage keys
    try {
      let raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.layers?.length) layers.value = migrateLayers(data.layers);
        if (data.formats?.length) formats.value = data.formats.map(migrateFormat);
        if (data.styles) Object.assign(styles, migrateStyles(data.styles));

        // Convert old single-asset to multi-asset
        if (data.sourceUrl) {
          const id = generateAssetId();
          assets.value = [{
            id, url: data.sourceUrl, label: '',
            focalX: data.focalPoint?.x ?? 0.5,
            focalY: data.focalPoint?.y ?? 0.5,
            focalW: data.focalPoint?.w ?? 0.30,
            focalH: data.focalPoint?.h ?? 0.30,
            focalFit: data.focalFit || 'cover',
            contentAwareFocal: data.contentAwareFocal ?? true,
            useSmartCrop: data.useSmartCrop ?? false,
          }];
          activeAssetId.value = id;
        }

        if (data.logoUrl != null) logoUrl.value = data.logoUrl;
        if (data.canvasPositions) Object.assign(canvasPositions, data.canvasPositions);

        // Save into project manager
        scheduleSave();
        return activeAsset.value?.url || '';
      }

      // Fallback to older legacy keys
      for (const key of LEGACY_KEYS) {
        raw = localStorage.getItem(key);
        if (!raw) continue;
        const legacy = JSON.parse(raw);

        if (key === 'tpl_builder_v6' || key === 'tpl_builder_v5') {
          if (legacy.layers?.length) layers.value = migrateLayers(legacy.layers);
          if (legacy.formats?.length) formats.value = legacy.formats.map(migrateFormat);
          if (legacy.styles) Object.assign(styles, migrateStyles(legacy.styles));
          if (legacy.sourceUrl) {
            const id = generateAssetId();
            assets.value = [{
              id, url: legacy.sourceUrl, label: '',
              focalX: legacy.focalPoint?.x ?? 0.5, focalY: legacy.focalPoint?.y ?? 0.5,
              focalW: legacy.focalPoint?.w ?? 0.30, focalH: legacy.focalPoint?.h ?? 0.30,
              focalFit: legacy.focalFit || 'cover',
              contentAwareFocal: legacy.contentAwareFocal ?? true,
              useSmartCrop: legacy.useSmartCrop ?? false,
            }];
            activeAssetId.value = id;
          }
          if (legacy.logoUrl != null) logoUrl.value = legacy.logoUrl;
          if (legacy.canvasPositions) Object.assign(canvasPositions, legacy.canvasPositions);
        } else if (key === 'tpl_builder_v4' || key === 'tpl_builder_v3') {
          if (legacy.layers?.length) layers.value = migrateLayers(legacy.layers);
          if (legacy.formats?.length) formats.value = legacy.formats.map(migrateFormat);
          if (legacy.styles) Object.assign(styles, migrateStyles(legacy.styles));
          if (legacy.sourceUrl) {
            const id = generateAssetId();
            assets.value = [{
              id, url: legacy.sourceUrl, label: '',
              focalX: legacy.focalPoint?.x ?? 0.5, focalY: legacy.focalPoint?.y ?? 0.5,
              focalW: legacy.focalPoint?.w ?? 0.30, focalH: legacy.focalPoint?.h ?? 0.30,
              focalFit: 'cover', contentAwareFocal: legacy.contentAwareFocal ?? true,
              useSmartCrop: legacy.useSmartCrop ?? false,
            }];
            activeAssetId.value = id;
          }
          if (legacy.logoUrl != null) logoUrl.value = legacy.logoUrl;
        } else if (key === 'tpl_builder_v2') {
          if (legacy.layers?.length) layers.value = migrateLayers(legacy.layers);
          if (legacy.formats?.length) formats.value = legacy.formats.map(migrateFormat);
          if (legacy.styles) Object.assign(styles, migrateStyles(legacy.styles));
          if (legacy.sourceUrl) {
            const id = generateAssetId();
            assets.value = [{ id, url: legacy.sourceUrl, label: '', focalX: 0.5, focalY: 0.5, focalW: 0.30, focalH: 0.30, focalFit: 'cover', contentAwareFocal: true, useSmartCrop: legacy.useSmartCrop ?? false }];
            activeAssetId.value = id;
          }
          if (legacy.logoUrl != null) logoUrl.value = legacy.logoUrl;
        } else {
          // v1 → v3 migration
          const migrated = migrateLegacyV1(legacy);
          layers.value = migrated.layers;
          formats.value = migrated.formats.length ? migrated.formats : JSON.parse(JSON.stringify(DEFAULT_FORMATS));
          Object.assign(styles, migrated.styles);
          if (migrated.sourceUrl) {
            const id = generateAssetId();
            assets.value = [{ id, url: migrated.sourceUrl, label: '', focalX: 0.5, focalY: 0.5, focalW: 0.30, focalH: 0.30, focalFit: 'cover', contentAwareFocal: true, useSmartCrop: migrated.useSmartCrop }];
            activeAssetId.value = id;
          }
          logoUrl.value = migrated.logoUrl;
        }
        scheduleSave();
        return activeAsset.value?.url || '';
      }
    } catch {}
    return '';
  }

  // Auto-save on style changes
  watch(() => ({ ...styles }), () => scheduleSave(), { deep: true });
  watch([logoUrl], () => scheduleSave());
  // Watch the assets array deeply for focal point changes etc.
  watch(() => assets.value, () => scheduleSave(), { deep: true });

  return {
    layers, formats, styles, assets, activeAssetId, activeAsset,
    sourceUrl, useSmartCrop, logoUrl, focalPoint, contentAwareFocal, focalFit,
    canvasPositions,
    activeSettingsId, statusMsg, statusType, availableFields,
    drawState, activeFormat,
    addAsset, removeAsset, setActiveAsset, updateAsset,
    addLayer, removeLayer, reorderLayers, updateLayerValue, updateLayerLabel, updateLayerGap, setFieldMapping,
    addFormat, removeFormat, updateFormat, setLayerAnchor, toggleLayerVisibility,
    resolveAnchor, setAssetAnchor, hasAssetAnchorOverride,
    setStatus, scheduleSave, loadSavedState,
    toSnapshot, hydrateFromSnapshot,
  };
});
