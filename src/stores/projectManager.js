import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tpl_builder_v8';
const LEGACY_KEY = 'tpl_builder_v7';
const LEGACY_KEYS_OLD = ['tpl_builder_v6', 'tpl_builder_v5', 'tpl_builder_v4', 'tpl_builder_v3', 'tpl_builder_v2', 'tpl_builder_v1'];

function generateId() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

// ── Default demo snapshot (first-time experience) ───────────────────────────

const DEFAULT_SNAPSHOT = {
  layers: [
    { id: 'headline', type: 'headline', label: 'Headline', value: 'Aprimo DAM', mappedField: null, gapAfter: 20 },
    { id: 'text', type: 'text', label: 'Text', value: 'Build dynamic content with CDN served assets.', mappedField: null, gapAfter: 12 },
    { id: 'cta', type: 'cta', label: 'CTA', value: 'Have fun', mappedField: null, gapAfter: 12 },
  ],
  formats: [
    { id: 'linkedin', label: 'LinkedIn / OG', w: 734, h: 221, anchor: 'tl', logoSize: 0, visibleLayers: ['headline', 'text', 'cta'], contentWidth: 31, contentScale: 1.2, ctaScale: 1, layerAnchors: { cta: 'br' }, assetAnchors: { mnobjoiv_il0ys: 'cl' } },
    { id: 'ig-square', label: 'Instagram Square', w: 483, h: 903, anchor: 'tr', logoSize: 0.11, visibleLayers: ['headline', 'text', 'cta'], contentWidth: 68, contentScale: 1.26, layerAnchors: {}, assetAnchors: { mnobjoiv_il0ys: 'br' } },
    { id: 'ig-story', label: 'Instagram Story', w: 512, h: 512, anchor: 'tr', logoSize: 0.1, visibleLayers: ['headline', 'text', 'cta'], contentWidth: 60, contentScale: 1.38, layerAnchors: {}, assetAnchors: { mnobjoiv_il0ys: 'tl', asset_mnobvu6k5f3: 'br' } },
    { id: 'facebook', label: 'Facebook Post', w: 512, h: 360, anchor: 'tl', logoSize: 0.09, visibleLayers: ['headline', 'text', 'cta'], contentScale: 1.3, contentWidth: 45, layerAnchors: { cta: 'br' }, logoAnchor: 'bl' },
    { id: 'rectangle', label: 'Display Rectangle', w: 261, h: 221, anchor: 'tc', logoSize: 0, visibleLayers: ['headline', 'cta'], ctaScale: 0.81, contentWidth: 100, contentScale: 1, layerAnchors: { cta: 'bc', text: 'bc' }, logoAnchor: '' },
    { id: 'custom-312-1155-mnnlg83q', label: 'Custom 312×1155', w: 312, h: 1151, anchor: 'bc', layerAnchors: {}, logoAnchor: '', visibleLayers: ['headline', 'text', 'cta'], logoSize: 0.2, contentScale: 1.45, contentWidth: 100, padding: 10, ctaScale: 1.05 },
  ],
  styles: {
    headlineFont: 'Playfair Display', headlineFontSize: 27, headlineFontWeight: '400', headlineColor: '#ffffff',
    textFont: 'Plus Jakarta Sans', textFontSize: 14, textFontWeight: '400', textColor: '#ffffff',
    ctaFont: 'Josefin Sans', ctaFontSize: 16, ctaFontWeight: '700', ctaTextColor: '#e2cd83',
    accentColor: '#0e5700', ctaPadH: 20, ctaPadV: 10, ctaRadius: 24, contentGap: 12,
    overlayColor: '#52430f', overlayOpacity: 0.58,
    bgMode: 'radial', bgColor1: '#8ea989', bgColor2: '#4a7321', bgAngle: 180, bgDistance: 72,
  },
  assets: [
    { id: 'mnobjoiv_il0ys', url: 'https://p3.aprimocdn.net/trial117/9a978ba1-55a8-42e8-818f-b37c00f1ddc0/PXL_20250825_190137159.MP_Original%20file.jpg', label: '', focalX: 0.534, focalY: 0.439, focalW: 0.466, focalH: 0.262, focalFit: 'cover', contentAwareFocal: false, useSmartCrop: false },
    { id: 'asset_mnobnhjmfil', url: 'https://p3.aprimocdn.net/trial117/659dd6a4-8f19-48de-b95b-b42100a90322/560114-05543-o_eCom_Original%20file.png', label: '560114-05543-o_eCom.png', focalX: 0.5, focalY: 0.665, focalW: 1, focalH: 0.374, focalFit: 'safe', contentAwareFocal: false, useSmartCrop: false },
  ],
  activeAssetId: 'asset_mnobnhjmfil',
  logoUrl: 'https://go.aprimo.com/hs-fs/hubfs/Aprimo%20Logos/Aprimo_Logo_RGB_White_png.png',
  canvasPositions: {
    linkedin: { x: 13, y: -50 }, rectangle: { x: 773, y: -50 },
    'ig-story': { x: 13, y: 198 }, 'ig-square': { x: 551, y: 198 },
    facebook: { x: 13, y: 741 }, 'custom-312-1155-mnnlg83q': { x: 1065, y: -50 },
  },
};

// ── Store ────────────────────────────────────────────────────────────────────

export const useProjectManagerStore = defineStore('projectManager', () => {

  // ── State ────────────────────────────────────────────────────────
  const projects = ref({});         // { [id]: { name, createdAt, updatedAt, snapshot } }
  const activeProjectId = ref('');
  const projectOrder = ref([]);     // ordered list of project IDs

  // ── Computed ─────────────────────────────────────────────────────
  const activeProject = computed(() => projects.value[activeProjectId.value] || null);
  const projectList = computed(() =>
    projectOrder.value
      .map(id => projects.value[id])
      .filter(Boolean)
  );

  // ── Envelope I/O ────────────────────────────────────────────────

  function loadEnvelope() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const env = JSON.parse(raw);
        projects.value = env.projects || {};
        activeProjectId.value = env.activeProjectId || '';
        projectOrder.value = env.projectOrder || Object.keys(env.projects || {});
        // Validate active project exists
        if (!projects.value[activeProjectId.value]) {
          activeProjectId.value = projectOrder.value[0] || '';
        }
        return true;
      }
    } catch { /* ignore corrupt data */ }
    return false;
  }

  function saveEnvelope() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        _version: 8,
        activeProjectId: activeProjectId.value,
        projectOrder: projectOrder.value,
        projects: projects.value,
      }));
    } catch { /* storage full — silent fail */ }
  }

  let _saveTimer = null;
  function scheduleSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(saveEnvelope, 250);
  }

  // ── Migration from v7 (single-project) ──────────────────────────

  function migrateFromV7() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return false;
      const v7 = JSON.parse(raw);

      // Build a single-asset array from the old sourceUrl + focal data
      const assets = [];
      if (v7.sourceUrl) {
        assets.push({
          id: generateId(),
          url: v7.sourceUrl,
          label: '',
          focalX: v7.focalPoint?.x ?? 0.5,
          focalY: v7.focalPoint?.y ?? 0.5,
          focalW: v7.focalPoint?.w ?? 0.30,
          focalH: v7.focalPoint?.h ?? 0.30,
          focalFit: v7.focalFit || 'cover',
          contentAwareFocal: v7.contentAwareFocal ?? true,
          useSmartCrop: v7.useSmartCrop ?? false,
        });
      }

      const snapshot = {
        layers: v7.layers || [],
        formats: v7.formats || [],
        styles: v7.styles || {},
        assets,
        activeAssetId: assets[0]?.id || '',
        logoUrl: v7.logoUrl ?? '',
        canvasPositions: v7.canvasPositions || {},
      };

      const id = generateId();
      projects.value = {
        [id]: {
          id,
          name: 'My Project',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          snapshot,
        },
      };
      activeProjectId.value = id;
      projectOrder.value = [id];
      saveEnvelope();
      return true;
    } catch { return false; }
  }

  // ── Try even older legacy keys ──────────────────────────────────
  // If nothing found in v7, check older keys and let templateBuilder
  // handle the internal migration — we just wrap the result.

  function hasAnyLegacy() {
    for (const key of LEGACY_KEYS_OLD) {
      if (localStorage.getItem(key)) return true;
    }
    return false;
  }

  // ── Initialise ──────────────────────────────────────────────────

  function init() {
    // 1. Try v8 envelope
    if (loadEnvelope()) return;

    // 2. Try v7 migration
    if (migrateFromV7()) return;

    // 3. Older legacy — create an empty project; templateBuilder will
    //    do its own internal migration on loadSavedState() and then
    //    we capture the result via saveProjectSnapshot().
    if (hasAnyLegacy()) {
      const id = generateId();
      projects.value = {
        [id]: {
          id,
          name: 'My Project',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          snapshot: null, // will be filled after templateBuilder loads
        },
      };
      activeProjectId.value = id;
      projectOrder.value = [id];
      return;
    }

    // 4. Brand new — create a demo project with pre-configured snapshot
    const id = generateId();
    projects.value = {
      [id]: {
        id,
        name: 'Demo Project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        snapshot: JSON.parse(JSON.stringify(DEFAULT_SNAPSHOT)),
      },
    };
    activeProjectId.value = id;
    projectOrder.value = [id];
    saveEnvelope();
  }

  // ── Project CRUD ────────────────────────────────────────────────

  function createProject(name = 'Untitled Project') {
    const id = generateId();
    projects.value[id] = {
      id,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      snapshot: null,
    };
    projectOrder.value.push(id);
    scheduleSave();
    return id;
  }

  function deleteProject(id) {
    if (projectOrder.value.length <= 1) return false;
    delete projects.value[id];
    projectOrder.value = projectOrder.value.filter(pid => pid !== id);
    if (activeProjectId.value === id) {
      activeProjectId.value = projectOrder.value[0] || '';
    }
    scheduleSave();
    return true;
  }

  function renameProject(id, name) {
    const p = projects.value[id];
    if (p) {
      p.name = name;
      p.updatedAt = new Date().toISOString();
      scheduleSave();
    }
  }

  function duplicateProject(id) {
    const src = projects.value[id];
    if (!src) return null;
    const newId = generateId();
    projects.value[newId] = {
      id: newId,
      name: src.name + ' (copy)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      snapshot: JSON.parse(JSON.stringify(src.snapshot)),
    };
    const idx = projectOrder.value.indexOf(id);
    projectOrder.value.splice(idx + 1, 0, newId);
    scheduleSave();
    return newId;
  }

  /** Save current templateBuilder state into the active project */
  function saveProjectSnapshot(snapshot) {
    const p = projects.value[activeProjectId.value];
    if (!p) return;
    p.snapshot = snapshot;
    p.updatedAt = new Date().toISOString();
    scheduleSave();
  }

  /** Get snapshot data for a project */
  function getProjectSnapshot(id) {
    return projects.value[id]?.snapshot || null;
  }

  function setActiveProject(id) {
    if (projects.value[id]) {
      activeProjectId.value = id;
      scheduleSave();
    }
  }

  // ── Import / Export ────────────────────────────────────────────

  /** Export a project as a downloadable JSON file */
  function exportProject(id) {
    const p = projects.value[id];
    if (!p) return;
    const payload = {
      _type: 'dynamic_content_project',
      _version: 1,
      name: p.name,
      exportedAt: new Date().toISOString(),
      snapshot: p.snapshot,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `${p.name.replace(/[^a-zA-Z0-9_ -]/g, '_')}.json`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  /**
   * Import a project from a JSON file.
   * @param {File} file
   * @returns {Promise<string|null>} the new project ID, or null on failure
   */
  async function importProject(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate structure
      if (data._type !== 'dynamic_content_project' || !data.snapshot) {
        throw new Error('Invalid project file');
      }

      const id = generateId();
      const name = data.name || file.name.replace(/\.json$/i, '') || 'Imported Project';
      projects.value[id] = {
        id,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        snapshot: data.snapshot,
      };
      projectOrder.value.push(id);
      scheduleSave();
      return id;
    } catch {
      return null;
    }
  }

  return {
    projects, activeProjectId, projectOrder,
    activeProject, projectList,
    init, saveProjectSnapshot, getProjectSnapshot,
    createProject, deleteProject, renameProject, duplicateProject,
    setActiveProject, scheduleSave,
    exportProject, importProject,
  };
});
