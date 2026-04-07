import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tpl_builder_v8';
const LEGACY_KEY = 'tpl_builder_v7';
const LEGACY_KEYS_OLD = ['tpl_builder_v6', 'tpl_builder_v5', 'tpl_builder_v4', 'tpl_builder_v3', 'tpl_builder_v2', 'tpl_builder_v1'];

function generateId() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

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

    // 4. Brand new — create a default project
    const id = generateId();
    projects.value = {
      [id]: {
        id,
        name: 'My Project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        snapshot: null, // templateBuilder will populate on first save
      },
    };
    activeProjectId.value = id;
    projectOrder.value = [id];
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
