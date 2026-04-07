<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useTemplateBuilderStore } from '../stores/templateBuilder.js';
import { useProjectManagerStore } from '../stores/projectManager.js';
import { buildSmartCropUrl, detectInterference } from '../composables/useTemplateRenderer.js';
import { loadTemplateFonts } from '../composables/useGoogleFonts.js';
import { useSourceLoader } from '../composables/useSourceLoader.js';
import { useLogoLoader } from '../composables/useLogoLoader.js';
import { useTemplateExport } from '../composables/useTemplateExport.js';
import { useInfiniteCanvas } from '../composables/useInfiniteCanvas.js';
import TemplateControls from '../components/templates/TemplateControls.vue';
import TemplateCanvas from '../components/templates/TemplateCanvas.vue';
import RightPanel from '../components/templates/RightPanel.vue';
import ProjectSwitcher from '../components/templates/ProjectSwitcher.vue';
import FormatSwitcher from '../components/templates/FormatSwitcher.vue';

// ── Stores ──────────────────────────────────────────────────────────────────

const store   = useTemplateBuilderStore();
const pm      = useProjectManagerStore();

// ── Canvas ref management ───────────────────────────────────────────────────

const canvasRefs = ref({});

function setCanvasRef(id) {
  return (el) => {
    if (el) canvasRefs.value[id] = el;
    else delete canvasRefs.value[id];
  };
}

function renderAllCanvases() {
  for (const fmt of store.formats) {
    const comp = canvasRefs.value[fmt.id];
    if (comp?.render) comp.render();
  }
}

// ── Composables ─────────────────────────────────────────────────────────────

const source = useSourceLoader(store);
const logo   = useLogoLoader(store);

const canvas = useInfiniteCanvas(store, {
  canDraw: () => source.sourceReady.value,
  onFormatCreated: (id) => {
    if (source.sourceReady.value && store.useSmartCrop && source.sourceType.value === 'image') {
      const fmt = store.formats.find(f => f.id === id);
      if (fmt) source.loadSmartCropForFormat(store.sourceUrl, id, fmt.w, fmt.h);
    }
  },
});

// Destructure refs for template auto-unwrapping
const { sourceType, sourceEl, sourceReady, sourceLoading, croppedEls } = source;
const { logoEl } = logo;
const {
  zoom, zoomPercent, cursorClass, worldStyle,
  drawRect, drawRectStyle, selectedFormatId,
  snapGuides, isResizingCard,
  onWheel, onPointerDown, onPointerMove, onPointerUp,
  zoomToFormat,
} = canvas;

// Template refs
const canvasContainerRef = ref(null);
const hiddenVideoEl = ref(null);

// Sync template ref → composable ref
watch(canvasContainerRef, el => { canvas.containerRef.value = el; });
watch(hiddenVideoEl, el => { source.hiddenVideoRef.value = el; });

// ── Resolved formats (with per-asset anchor overrides applied) ─────────────
// Returns a shallow copy of the format with the effective anchor for the active asset.
function resolvedFormat(fmt) {
  const anchor = store.resolveAnchor(fmt);
  if (anchor === fmt.anchor) return fmt;
  return { ...fmt, anchor };
}

// Draw state merges store's drawState with DOM elements
const drawState = computed(() => ({
  ...store.drawState,
  el: sourceEl.value,
  logo: logoEl.value,
}));

const exporter = useTemplateExport(store, {
  drawState,
  croppedEls,
  sourceEl,
  logoEl,
  sourceType,
  sourceReady,
  canvasRefs,
});

// ── Source loading orchestration ────────────────────────────────────────────

function loadSource() {
  // If no assets exist yet, create one from sourceUrl (backwards compat for typed URL)
  if (store.assets.length === 0 && store.activeAsset === null) {
    // Nothing to load — user needs to add an asset first
    return;
  }
  source.loadSource({
    onImageLoaded: (_img, url) => {
      source.loadSmartCrops(url);
    },
    onVideoReady: () => {
      source.startVideoLoop(renderAllCanvases);
    },
  });
}

// ── Smart crop toggle ───────────────────────────────────────────────────────

watch(() => store.useSmartCrop, () => {
  if (source.sourceReady.value && store.sourceUrl && source.sourceType.value === 'image') {
    source.loadSmartCrops(store.sourceUrl);
  }
});

// ── Interference detection ──────────────────────────────────────────────────

const interferenceMap = computed(() => {
  const el = source.sourceEl.value;
  if (!el || !source.sourceReady.value || store.useSmartCrop) return {};
  const sw = el.naturalWidth || el.width || 0;
  const sh = el.naturalHeight || el.height || 0;
  if (!sw || !sh) return {};
  const map = {};
  for (const fmt of store.formats) {
    // Build visible layers list for height estimation
    const visibleLayers = store.layers.filter(l =>
      fmt.visibleLayers ? fmt.visibleLayers.includes(l.id) : true
    );
    const contentInfo = {
      layers: visibleLayers,
      styles: store.styles,
      contentScale: fmt.contentScale || 1,
      ctaScale: fmt.ctaScale || 1,
      fmt,
    };
    const result = detectInterference(
      fmt.w, fmt.h, sw, sh,
      store.resolveAnchor(fmt),
      store.focalPoint.x, store.focalPoint.y,
      store.contentAwareFocal,
      store.focalPoint.w, store.focalPoint.h,
      fmt.contentWidth ?? 60,
      contentInfo,
      store.focalFit || 'cover',
    );
    if (result.interferes) map[fmt.id] = result;
  }
  return map;
});

const interferenceCount = computed(() => Object.keys(interferenceMap.value).length);

function fixAnchor(fmtId) {
  const info = interferenceMap.value[fmtId];
  if (!info?.suggestedAnchor) return;
  if (store.assets.length > 1) {
    store.setAssetAnchor(fmtId, info.suggestedAnchor);
  } else {
    store.updateFormat(fmtId, 'anchor', info.suggestedAnchor);
  }
}

function fixAllAnchors() {
  for (const [fmtId, info] of Object.entries(interferenceMap.value)) {
    if (store.assets.length > 1) {
      store.setAssetAnchor(fmtId, info.suggestedAnchor);
    } else {
      store.updateFormat(fmtId, 'anchor', info.suggestedAnchor);
    }
  }
}

// ── Delete format ──────────────────────────────────────────────────────────

function deleteFormat(id) {
  store.removeFormat(id);
  delete source.croppedEls[id];
  if (selectedFormatId.value === id) selectedFormatId.value = null;
}

// ── Context menu ──────────────────────────────────────────────────────────

const ctxMenu = ref({ visible: false, x: 0, y: 0, formatId: null });
const clipboard = ref(null); // { type: 'format'|'style'|'anchors', data: {...} }

function onContextMenu(e) {
  e.preventDefault();
  // Find which format card was right-clicked
  const card = e.target.closest('.world-card');
  const fmtId = card?.dataset?.formatId || null;
  if (!fmtId) {
    // Right-click on empty canvas — only show paste if something is copied
    if (clipboard.value?.type === 'format') {
      ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, formatId: null };
    }
    return;
  }
  selectedFormatId.value = fmtId;
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, formatId: fmtId };
}

function closeCtxMenu() {
  ctxMenu.value.visible = false;
}

function ctxCopy() {
  const fmt = store.formats.find(f => f.id === ctxMenu.value.formatId);
  if (!fmt) return;
  clipboard.value = { type: 'format', data: JSON.parse(JSON.stringify(fmt)) };
  closeCtxMenu();
}

function pasteFormatAt(data, screenX, screenY) {
  // Convert screen click position to world coordinates
  const el = canvasContainerRef.value;
  let wx = 0, wy = 0;
  if (el && screenX != null) {
    const rect = el.getBoundingClientRect();
    const local = canvas.screenToWorld(screenX - rect.left, screenY - rect.top);
    wx = Math.round(local.x);
    wy = Math.round(local.y);
  }
  const newId = store.addFormat(data.label + ' copy', data.w, data.h, wx, wy);
  const fmtProps = ['anchor', 'layerAnchors', 'logoAnchor', 'visibleLayers', 'logoSize', 'contentScale', 'contentWidth', 'ctaScale', 'padding'];
  for (const p of fmtProps) {
    if (data[p] !== undefined) {
      const val = typeof data[p] === 'object' ? JSON.parse(JSON.stringify(data[p])) : data[p];
      store.updateFormat(newId, p, val);
    }
  }
  return newId;
}

function ctxPaste() {
  if (!clipboard.value) return;
  const data = clipboard.value.data;
  if (clipboard.value.type === 'format') {
    pasteFormatAt(data, ctxMenu.value.x, ctxMenu.value.y);
  } else if (clipboard.value.type === 'style') {
    const targetId = ctxMenu.value.formatId;
    if (!targetId) return;
    const props = ['logoSize', 'contentScale', 'contentWidth', 'ctaScale', 'padding'];
    for (const p of props) {
      if (data[p] !== undefined) store.updateFormat(targetId, p, data[p]);
    }
  } else if (clipboard.value.type === 'anchors') {
    const targetId = ctxMenu.value.formatId;
    if (!targetId) return;
    if (data.anchor) store.updateFormat(targetId, 'anchor', data.anchor);
    if (data.layerAnchors) store.updateFormat(targetId, 'layerAnchors', JSON.parse(JSON.stringify(data.layerAnchors)));
    if (data.logoAnchor !== undefined) store.updateFormat(targetId, 'logoAnchor', data.logoAnchor);
  }
  closeCtxMenu();
}

function ctxDuplicate() {
  const fmt = store.formats.find(f => f.id === ctxMenu.value.formatId);
  if (!fmt) return;
  const pos = store.canvasPositions[fmt.id] || { x: 0, y: 0 };
  const newId = store.addFormat(fmt.label + ' copy', fmt.w, fmt.h, pos.x + 40, pos.y + 40);
  const props = ['anchor', 'layerAnchors', 'logoAnchor', 'visibleLayers', 'logoSize', 'contentScale', 'contentWidth', 'ctaScale', 'padding'];
  for (const p of props) {
    if (fmt[p] !== undefined) {
      const val = typeof fmt[p] === 'object' ? JSON.parse(JSON.stringify(fmt[p])) : fmt[p];
      store.updateFormat(newId, p, val);
    }
  }
  closeCtxMenu();
}

function ctxCopyStyle() {
  const fmt = store.formats.find(f => f.id === ctxMenu.value.formatId);
  if (!fmt) return;
  clipboard.value = { type: 'style', data: { logoSize: fmt.logoSize, contentScale: fmt.contentScale, contentWidth: fmt.contentWidth, ctaScale: fmt.ctaScale, padding: fmt.padding } };
  closeCtxMenu();
}

function ctxCopyAnchors() {
  const fmt = store.formats.find(f => f.id === ctxMenu.value.formatId);
  if (!fmt) return;
  clipboard.value = { type: 'anchors', data: { anchor: fmt.anchor, layerAnchors: JSON.parse(JSON.stringify(fmt.layerAnchors || {})), logoAnchor: fmt.logoAnchor || '' } };
  closeCtxMenu();
}

function ctxPasteLabel() {
  if (!clipboard.value) return '';
  if (clipboard.value.type === 'format') return 'Paste Format';
  if (clipboard.value.type === 'style') return 'Paste Style';
  if (clipboard.value.type === 'anchors') return 'Paste Anchors';
  return 'Paste';
}

// Close context menu on any click
function onDocClick() { closeCtxMenu(); }
onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));

// ── Keyboard shortcuts (Ctrl+C / Ctrl+V / Ctrl+D) ────────────────────────

function onKeyDown(e) {
  // Ignore if user is typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (!e.ctrlKey && !e.metaKey) return;

  if (e.key === 'c') {
    // Copy selected format
    const fmtId = selectedFormatId.value;
    if (!fmtId) return;
    const fmt = store.formats.find(f => f.id === fmtId);
    if (!fmt) return;
    clipboard.value = { type: 'format', data: JSON.parse(JSON.stringify(fmt)) };
    e.preventDefault();
  } else if (e.key === 'v') {
    // Paste — place at centre of viewport
    if (!clipboard.value || clipboard.value.type !== 'format') return;
    const data = clipboard.value.data;
    const el = canvasContainerRef.value;
    let wx = 0, wy = 0;
    if (el) {
      const centre = canvas.screenToWorld(el.clientWidth / 2, el.clientHeight / 2);
      wx = Math.round(centre.x - data.w / 2);
      wy = Math.round(centre.y - data.h / 2);
    }
    const newId = store.addFormat(data.label + ' copy', data.w, data.h, wx, wy);
    const fmtProps = ['anchor', 'layerAnchors', 'logoAnchor', 'visibleLayers', 'logoSize', 'contentScale', 'contentWidth', 'ctaScale', 'padding'];
    for (const p of fmtProps) {
      if (data[p] !== undefined) {
        const val = typeof data[p] === 'object' ? JSON.parse(JSON.stringify(data[p])) : data[p];
        store.updateFormat(newId, p, val);
      }
    }
    selectedFormatId.value = newId;
    e.preventDefault();
  } else if (e.key === 'd') {
    // Duplicate selected format
    const fmtId = selectedFormatId.value;
    if (!fmtId) return;
    ctxMenu.value.formatId = fmtId;
    ctxDuplicate();
    e.preventDefault();
  }
}
onMounted(() => document.addEventListener('keydown', onKeyDown));
onUnmounted(() => document.removeEventListener('keydown', onKeyDown));

// ── Project switching ──────────────────────────────────────────────────────

function switchProject(newProjectId) {
  // 1. Save current project snapshot before switching
  pm.saveProjectSnapshot(store.toSnapshot());
  // 2. Load the new project
  _loadProject(newProjectId);
}

/** Internal: activate a project and hydrate store (without saving current state first) */
function _loadProject(projectId) {
  // Reset source loader (clear stale image/video/status)
  source.reset();
  store.setStatus('');
  // Activate new project
  pm.setActiveProject(projectId);
  // Hydrate store from project's snapshot
  const snap = pm.getProjectSnapshot(projectId);
  const url = store.hydrateFromSnapshot(snap);
  // Re-layout & reload source
  nextTick(() => {
    canvas.autoLayout();
    if (url) loadSource();
    else renderAllCanvases();
    if (store.logoUrl.trim()) logo.loadLogoImg(store.logoUrl.trim());
    else logo.clearLogo();
    nextTick(() => requestAnimationFrame(() => canvas.fitAll()));
  });
}

function onDeleteProject(id) {
  if (pm.projectOrder.length <= 1) return;
  const wasCurrent = id === pm.activeProjectId;
  pm.deleteProject(id);
  if (wasCurrent) {
    // Don't save current snapshot — we're discarding it. Just load the new active.
    _loadProject(pm.activeProjectId);
  }
}

function onSwitchAsset(_assetId) {
  // Active asset already set by the TemplateControls component
  // Just reload the source for the new active asset
  if (store.activeAsset?.url) {
    loadSource();
  }
}

// ── Format selection from dropdown ─────────────────────────────────────────

function onSelectFormat(fmtId) {
  selectedFormatId.value = fmtId;
  store.activeSettingsId = fmtId;
  nextTick(() => zoomToFormat(fmtId));
}

// ── Font loading ────────────────────────────────────────────────────────────

watch(
  () => [store.styles.headlineFont, store.styles.textFont, store.styles.ctaFont,
         store.styles.headlineFontWeight, store.styles.textFontWeight, store.styles.ctaFontWeight],
  async () => {
    await loadTemplateFonts(
      store.styles.headlineFont, store.styles.textFont, store.styles.ctaFont,
      store.styles.headlineFontWeight, store.styles.textFontWeight, store.styles.ctaFontWeight,
    );
    renderAllCanvases();
  },
);

// ── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(() => {
  canvas.setupEvents();

  // Init project manager first — handles v7→v8 migration
  pm.init();

  const savedUrl = store.loadSavedState();

  // Load default/saved fonts immediately so they're ready for first render
  loadTemplateFonts(
    store.styles.headlineFont, store.styles.textFont, store.styles.ctaFont,
    store.styles.headlineFontWeight, store.styles.textFontWeight, store.styles.ctaFontWeight,
  ).then(() => {
    renderAllCanvases();
  });

  // Auto-layout any formats that don't have canvas positions yet
  canvas.autoLayout();

  if (savedUrl) nextTick(() => loadSource());

  if (!logo.logoEl.value && store.logoUrl.trim()) {
    logo.loadLogoImg(store.logoUrl.trim());
  }

  // Fit all after a tick to let container size settle
  nextTick(() => { requestAnimationFrame(() => canvas.fitAll()); });

  document.fonts.ready.then(() => {
    if (source.sourceReady.value) renderAllCanvases();
  });
});

onUnmounted(() => {
  source.destroy();
  logo.destroy();
  canvas.teardownEvents();
});
</script>

<template>
  <div id="tpl-page" class="tpl-page">
    <!-- Controls panel (left) -->
    <div class="tpl-controls">
      <TemplateControls
        :source-ready="sourceReady"
        :source-type="sourceType"
        @load-source="loadSource"
        @clear-logo="logo.clearLogo"
        @export-all="exporter.exportAll"
        @switch-asset="onSwitchAsset"
      />
    </div>

    <!-- Infinite canvas area (centre) -->
    <div class="tpl-canvas-area">
      <!-- Toolbar -->
      <div class="tpl-canvas-toolbar">
        <div class="toolbar-left">
          <ProjectSwitcher @switch-project="switchProject" @delete-project="onDeleteProject" />
          <span class="toolbar-sep"></span>
          <FormatSwitcher @select-format="onSelectFormat" @delete-format="deleteFormat" />
          <button v-if="interferenceCount > 0" class="toolbar-interference" @click="fixAllAnchors" title="Fix content overlap on affected formats">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            {{ interferenceCount }} overlap{{ interferenceCount > 1 ? 's' : '' }} — Fix
          </button>
        </div>
        <div class="toolbar-right">
          <!-- Zoom controls -->
          <div class="zoom-controls">
            <button class="zoom-btn" @click="canvas.zoomOut()" title="Zoom out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>
            </button>
            <button class="zoom-display" @click="canvas.fitAll()" title="Fit all">{{ zoomPercent }}%</button>
            <button class="zoom-btn" @click="canvas.zoomIn()" title="Zoom in">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Canvas viewport -->
      <div
        ref="canvasContainerRef"
        class="canvas-viewport"
        :class="cursorClass"
        @wheel.prevent="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @contextmenu="onContextMenu"
      >
        <!-- Empty state -->
        <div v-if="!sourceReady && !sourceLoading" class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
          </svg>
          <h3>Paste an asset URL to get started</h3>
          <p>Load any Aprimo CDN image or video URL, then drag on the canvas to create formats.</p>
        </div>

        <!-- World wrapper (pan + zoom applied via CSS transform) -->
        <div v-else class="world-wrapper" :style="worldStyle">
          <!-- Format cards -->
          <div
            v-for="fmt in store.formats"
            :key="fmt.id"
            class="world-card"
            :class="{ 'is-selected': selectedFormatId === fmt.id }"
            :data-format-id="fmt.id"
            :style="{
              left: (store.canvasPositions[fmt.id]?.x ?? 0) + 'px',
              top: (store.canvasPositions[fmt.id]?.y ?? 0) + 'px',
              width: fmt.w + 'px',
              height: fmt.h + 'px',
            }"
          >
            <TemplateCanvas
              :ref="setCanvasRef(fmt.id)"
              :format="resolvedFormat(fmt)"
              :draw-state="drawState"
              :cropped-el="croppedEls[fmt.id] || null"
              :source-type="sourceType"
              :selected="selectedFormatId === fmt.id"
              @export="exporter.exportFormat(fmt.id)"
            />
            <!-- Resize handles (visible when selected, scale-compensated) -->
            <template v-if="selectedFormatId === fmt.id">
              <div class="resize-handle rh-n"  data-resize-handle="n"  :style="{ transform: `scaleY(${1/zoom})` }"></div>
              <div class="resize-handle rh-s"  data-resize-handle="s"  :style="{ transform: `scaleY(${1/zoom})` }"></div>
              <div class="resize-handle rh-e"  data-resize-handle="e"  :style="{ transform: `scaleX(${1/zoom})` }"></div>
              <div class="resize-handle rh-w"  data-resize-handle="w"  :style="{ transform: `scaleX(${1/zoom})` }"></div>
              <div class="resize-handle rh-nw" data-resize-handle="nw" :style="{ transform: `scale(${1/zoom})` }"></div>
              <div class="resize-handle rh-ne" data-resize-handle="ne" :style="{ transform: `scale(${1/zoom})` }"></div>
              <div class="resize-handle rh-sw" data-resize-handle="sw" :style="{ transform: `scale(${1/zoom})` }"></div>
              <div class="resize-handle rh-se" data-resize-handle="se" :style="{ transform: `scale(${1/zoom})` }"></div>
            </template>
            <!-- Resize dimensions overlay -->
            <div v-if="isResizingCard && canvas.dragCardId.value === fmt.id" class="resize-dims" :style="{ transform: `translate(-50%, -50%) scale(${1/zoom})` }">
              {{ fmt.w }} &times; {{ fmt.h }}
            </div>
            <!-- Interference warning -->
            <button
              v-if="interferenceMap[fmt.id]"
              class="interference-badge"
              :title="`Subject may be behind text \u2014 click to move anchor to ${interferenceMap[fmt.id].suggestedAnchor.toUpperCase()}`"
              @click.stop="fixAnchor(fmt.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Fix
            </button>
          </div>

          <!-- Snap guide lines (border-width compensated for zoom) -->
          <template v-for="(guide, idx) in snapGuides" :key="'snap-' + idx">
            <div
              class="snap-guide"
              :class="guide.axis === 'x' ? 'snap-guide-v' : 'snap-guide-h'"
              :style="guide.axis === 'x'
                ? { left: guide.pos + 'px', top: '-10000px', height: '20000px', borderLeftWidth: (1/zoom) + 'px' }
                : { top: guide.pos + 'px', left: '-10000px', width: '20000px', borderTopWidth: (1/zoom) + 'px' }"
            ></div>
          </template>

          <!-- Draw-to-create rectangle -->
          <div v-if="drawRect.active" class="draw-rect" :style="drawRectStyle"></div>
        </div>

        <!-- Video loading overlay -->
        <div v-if="sourceLoading && sourceType === 'video'" class="video-loading-overlay visible">
          <div class="spinner"></div>
          <span style="font-size:13px;color:#64748b;font-weight:500">Loading video...</span>
        </div>

        <!-- Canvas hint -->
        <div v-if="sourceReady" class="canvas-hint">
          Scroll to zoom · Middle-click or Space+drag to pan · Draw on empty area to create
        </div>
      </div>

      <!-- Context menu -->
      <Teleport to="body">
        <div
          v-if="ctxMenu.visible"
          class="ctx-menu"
          :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
          @click.stop
        >
          <template v-if="ctxMenu.formatId">
            <button class="ctx-item" @click="ctxCopy">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copy Format
            </button>
            <button class="ctx-item" @click="ctxDuplicate">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Duplicate
            </button>
            <div class="ctx-divider"></div>
            <button class="ctx-item" @click="ctxCopyStyle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Copy Style
            </button>
            <button class="ctx-item" @click="ctxCopyAnchors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
              Copy Anchors
            </button>
            <template v-if="clipboard">
              <div class="ctx-divider"></div>
              <button class="ctx-item ctx-paste" @click="ctxPaste">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                {{ ctxPasteLabel() }}
              </button>
            </template>
            <div class="ctx-divider"></div>
            <button class="ctx-item ctx-danger" @click="deleteFormat(ctxMenu.formatId); closeCtxMenu()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              Delete
            </button>
          </template>
          <template v-else>
            <button class="ctx-item ctx-paste" :disabled="!clipboard || clipboard.type !== 'format'" @click="ctxPaste">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
              Paste Format
            </button>
          </template>
        </div>
      </Teleport>
    </div>

    <!-- Right panel (format properties + global styles) -->
    <RightPanel
      :format="store.activeFormat || null"
      :can-delete="store.formats.length > 1"
      :source-type="sourceType"
      @close="store.activeSettingsId = null"
      @delete="deleteFormat"
      @export="exporter.exportFormat(store.activeFormat?.id)"
    />

    <!-- Hidden video element -->
    <video ref="hiddenVideoEl" crossorigin="anonymous" loop muted playsinline style="display:none"></video>
  </div>
</template>

<style src="../css/views/templates.css"></style>

<style scoped>
.tpl-page {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-width: 0;
  position: relative;
  height: 100%;
}

.tpl-controls {
  width: 340px;
  flex-shrink: 0;
  overflow: hidden;
  border-right: 1px solid var(--border);
  background: var(--card-bg);
  display: flex;
  flex-direction: column;
  z-index: 1;
}

.tpl-canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #e8ecf1;
  min-width: 0;
  position: relative;
}

/* ── Toolbar ─────────────────────────────────────────── */
.tpl-canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 45px;
  flex-shrink: 0;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  z-index: 2;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-sep {
  width: 1px;
  height: 18px;
  background: var(--border, #e2e8f0);
  flex-shrink: 0;
}

.toolbar-interference {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px 3px 7px;
  border-radius: 10px;
  border: 1.5px solid #d97706;
  background: #fef3c7;
  color: #92400e;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.toolbar-interference:hover { background: #fde68a; }
.toolbar-interference svg { color: #d97706; flex-shrink: 0; }

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Zoom controls ───────────────────────────────────── */
.zoom-controls {
  display: flex;
  align-items: center;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.zoom-btn {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none;
  color: var(--text-muted); cursor: pointer;
  transition: background 0.12s;
}
.zoom-btn:hover { background: var(--bg); color: var(--text); }

.zoom-display {
  padding: 0 8px; height: 28px;
  background: transparent; border: none;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  font-size: 11px; font-weight: 600;
  font-family: inherit;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  cursor: pointer; min-width: 48px;
  transition: background 0.12s;
}
.zoom-display:hover { background: var(--bg); }

/* ── Canvas viewport ─────────────────────────────────── */
.canvas-viewport {
  flex: 1;
  overflow: hidden;
  position: relative;
  /* Dot grid background */
  background-color: #e8ecf1;
  background-image: radial-gradient(circle, #c5ccd6 1px, transparent 1px);
  background-size: 24px 24px;
}

.cursor-default { cursor: crosshair; }
.cursor-grab { cursor: grab; }
.cursor-grabbing { cursor: grabbing; }
.cursor-move { cursor: move; }
.cursor-ns { cursor: ns-resize; }
.cursor-ew { cursor: ew-resize; }
.cursor-nwse { cursor: nwse-resize; }
.cursor-nesw { cursor: nesw-resize; }

.world-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  /* The wrapper is infinite — no width/height. Children positioned absolutely */
  will-change: transform;
}

.world-card {
  position: absolute;
  /* Prevent card from capturing pointer during pan */
  user-select: none;
  cursor: move;
}

/* ── Draw-to-create rectangle ────────────────────────── */
.draw-rect {
  position: absolute;
  border: 2px dashed #6366f1;
  background: rgba(99, 102, 241, 0.08);
  border-radius: 4px;
  pointer-events: none;
}

/* ── Interference badge ──────────────────────────────── */
.interference-badge {
  position: absolute;
  top: 8px; left: 8px;
  z-index: 5;
  display: flex; align-items: center; gap: 4px;
  padding: 3px 8px 3px 6px;
  border-radius: 6px;
  font-size: 11px; font-weight: 600;
  cursor: pointer; border: none;
  background: rgba(217, 119, 6, 0.9);
  color: #fff; font-family: inherit;
  backdrop-filter: blur(4px);
  transition: background 0.12s; line-height: 1;
}
.interference-badge:hover { background: rgba(180, 83, 9, 0.95); }

/* ── Canvas hint ─────────────────────────────────────── */
.canvas-hint {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 5px 14px;
  background: rgba(15,23,42,0.6);
  backdrop-filter: blur(8px);
  color: rgba(255,255,255,0.7);
  font-size: 11px;
  font-weight: 500;
  border-radius: 6px;
  pointer-events: none;
  z-index: 5;
  white-space: nowrap;
}

/* ── Empty state ─────────────────────────────────────── */
.empty-state {
  position: absolute;
  inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: #94a3b8; text-align: center; gap: 14px;
}
.empty-state svg { width: 52px; height: 52px; opacity: 0.35; }
.empty-state h3 { font-size: 15px; font-weight: 600; color: #64748b; margin: 0; }
.empty-state p { font-size: 13px; max-width: 300px; line-height: 1.65; color: #94a3b8; margin: 0; }

/* ── Video loading ───────────────────────────────────── */
.video-loading-overlay {
  position: absolute;
  inset: 0;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(232,236,241,0.92);
  backdrop-filter: blur(4px);
  gap: 14px;
  z-index: 10;
}
.video-loading-overlay.visible { display: flex; }

.spinner {
  width: 40px; height: 40px;
  border: 3px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: tpl-spin 0.7s linear infinite;
}
@keyframes tpl-spin { to { transform: rotate(360deg); } }

/* ── Resize handles ──────────────────────────────────── */
.resize-handle {
  position: absolute;
  z-index: 10;
  /* Handles are in world-space, but need to be visually consistent.
     We use a fixed px size that looks right at typical zoom levels. */
}

/* Corner handles — small squares */
.rh-nw, .rh-ne, .rh-sw, .rh-se {
  width: 12px; height: 12px;
  background: white;
  border: 2px solid #6366f1;
  border-radius: 2px;
}
.rh-nw { top: -6px;  left: -6px;  cursor: nwse-resize; }
.rh-ne { top: -6px;  right: -6px; cursor: nesw-resize; }
.rh-sw { bottom: -6px; left: -6px;  cursor: nesw-resize; }
.rh-se { bottom: -6px; right: -6px; cursor: nwse-resize; }

/* Edge handles — thin bars along each edge */
.rh-n, .rh-s, .rh-e, .rh-w {
  background: transparent;
}
.rh-n {
  top: -4px; left: 12px; right: 12px; height: 8px;
  cursor: ns-resize;
}
.rh-s {
  bottom: -4px; left: 12px; right: 12px; height: 8px;
  cursor: ns-resize;
}
.rh-e {
  top: 12px; right: -4px; bottom: 12px; width: 8px;
  cursor: ew-resize;
}
.rh-w {
  top: 12px; left: -4px; bottom: 12px; width: 8px;
  cursor: ew-resize;
}

/* Resize dimensions overlay — transform set inline for zoom compensation */
.resize-dims {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center center;
  padding: 6px 14px;
  background: rgba(99, 102, 241, 0.88);
  backdrop-filter: blur(6px);
  color: white;
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.03em;
  border-radius: 6px;
  pointer-events: none;
  z-index: 12;
  white-space: nowrap;
  text-shadow: 0 1px 4px rgba(0,0,0,0.2);
}

/* ── Snap guide lines ────────────────────────────────── */
.snap-guide {
  position: absolute;
  pointer-events: none;
  z-index: 50;
}
.snap-guide-v {
  border-left: 1px dashed #f43f5e;
}
.snap-guide-h {
  border-top: 1px dashed #f43f5e;
}
</style>

<style>
/* ── Context menu (teleported to body — unscoped) ─── */
.ctx-menu {
  position: fixed;
  z-index: 9999;
  min-width: 180px;
  background: var(--card-bg, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);
  padding: 4px;
  backdrop-filter: blur(12px);
  animation: ctx-fade-in 0.1s ease;
}
@keyframes ctx-fade-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text, #1f2937);
  font-size: 12.5px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}
.ctx-item:hover { background: rgba(99,102,241,0.08); }
.ctx-item:disabled { opacity: 0.35; cursor: default; }
.ctx-item:disabled:hover { background: transparent; }
.ctx-item svg { opacity: 0.5; flex-shrink: 0; }
.ctx-item:hover svg { opacity: 0.8; }
.ctx-paste { color: #6366f1; }
.ctx-paste svg { opacity: 0.7; }
.ctx-danger { color: #ef4444; }
.ctx-danger svg { stroke: #ef4444; opacity: 0.7; }
.ctx-danger:hover { background: rgba(239,68,68,0.08); }
.ctx-divider {
  height: 1px;
  background: var(--border, #e5e7eb);
  margin: 3px 6px;
}
</style>
