import { ref, reactive, computed } from 'vue';
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM, ZOOM_STEP, CARD_GAP } from './templateConstants.js';

/** Snap threshold in world-space pixels */
const SNAP_THRESHOLD = 4;

/**
 * Composable for Figma-style infinite canvas with pan, zoom, card drag,
 * card resize, snap-to-align guides, and draw-to-create.
 *
 * @param {Object} store — templateBuilder Pinia store
 * @param {Object} opts  — { onFormatCreated(id), onFormatResized(id) }
 */
export function useInfiniteCanvas(store, opts = {}) {

  // ── Viewport state ───────────────────────────────────────────────
  const panX = ref(0);
  const panY = ref(0);
  const zoom = ref(DEFAULT_ZOOM);

  // ── Interaction state ────────────────────────────────────────────
  const isPanning = ref(false);
  const isSpaceHeld = ref(false);
  const isDraggingCard = ref(false);
  const isResizingCard = ref(false);
  const dragCardId = ref(null);
  const selectedFormatId = ref(null);

  // ── Resize state ─────────────────────────────────────────────────
  // handle: 'n','s','e','w','ne','nw','se','sw'
  const resizeHandle = ref(null);
  let _resizeStart = null;   // { wx, wy }
  let _resizeOrigRect = null; // { x, y, w, h }

  // ── Snap guides ──────────────────────────────────────────────────
  // Array of { axis: 'x'|'y', pos: number (world px) }
  const snapGuides = ref([]);

  // ── Draw-to-create rectangle ─────────────────────────────────────
  const drawRect = reactive({ active: false, startX: 0, startY: 0, endX: 0, endY: 0 });

  const drawRectStyle = computed(() => {
    if (!drawRect.active) return null;
    const x = Math.min(drawRect.startX, drawRect.endX);
    const y = Math.min(drawRect.startY, drawRect.endY);
    const w = Math.abs(drawRect.endX - drawRect.startX);
    const h = Math.abs(drawRect.endY - drawRect.startY);
    return { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' };
  });

  // ── Container ref ────────────────────────────────────────────────
  const containerRef = ref(null);

  // ── Coordinate transforms ────────────────────────────────────────

  function worldToScreen(wx, wy) {
    return {
      x: wx * zoom.value + panX.value,
      y: wy * zoom.value + panY.value,
    };
  }

  function screenToWorld(sx, sy) {
    return {
      x: (sx - panX.value) / zoom.value,
      y: (sy - panY.value) / zoom.value,
    };
  }

  // ── Snap logic ───────────────────────────────────────────────────

  /**
   * Collect snap-candidate edges from all formats except the one being moved.
   * Returns { xs: number[], ys: number[] } — world-space positions.
   */
  function collectSnapEdges(excludeId) {
    const xs = [];
    const ys = [];
    for (const fmt of store.formats) {
      if (fmt.id === excludeId) continue;
      const p = store.canvasPositions[fmt.id];
      if (!p) continue;
      // left, center-x, right
      xs.push(p.x, p.x + fmt.w / 2, p.x + fmt.w);
      // top, center-y, bottom
      ys.push(p.y, p.y + fmt.h / 2, p.y + fmt.h);
    }
    return { xs, ys };
  }

  /**
   * Given a card rect {x,y,w,h}, find the best snap offsets.
   * Returns { dx, dy, guides[] }.
   *
   * @param {Object}   rect      — { x, y, w, h }
   * @param {string}   excludeId — format id to exclude from edge collection
   * @param {string[]} [onlyEdges] — optional: only test these moving edges
   *   e.g. ['right','bottom'] when dragging the SE resize handle.
   *   If omitted, all edges are tested (used during card drag).
   */
  function computeSnap(rect, excludeId, onlyEdges) {
    const edges = collectSnapEdges(excludeId);
    const guides = [];
    let dx = 0;
    let dy = 0;

    // Build the card edges to test.
    // left, center-x, right  /  top, center-y, bottom
    const allXs = { left: rect.x, centerX: rect.x + rect.w / 2, right: rect.x + rect.w };
    const allYs = { top: rect.y, centerY: rect.y + rect.h / 2, bottom: rect.y + rect.h };

    let cardXs, cardYs;
    if (onlyEdges) {
      // During resize: only snap the edges actually being dragged (no centers)
      cardXs = [];
      cardYs = [];
      if (onlyEdges.includes('left'))   cardXs.push(allXs.left);
      if (onlyEdges.includes('right'))  cardXs.push(allXs.right);
      if (onlyEdges.includes('top'))    cardYs.push(allYs.top);
      if (onlyEdges.includes('bottom')) cardYs.push(allYs.bottom);
    } else {
      cardXs = [allXs.left, allXs.centerX, allXs.right];
      cardYs = [allYs.top, allYs.centerY, allYs.bottom];
    }

    let bestDx = Infinity;
    let bestSnapX = null;
    for (const cx of cardXs) {
      for (const ex of edges.xs) {
        const d = Math.abs(cx - ex);
        if (d < SNAP_THRESHOLD && d < Math.abs(bestDx)) {
          bestDx = ex - cx;
          bestSnapX = ex;
        }
      }
    }

    let bestDy = Infinity;
    let bestSnapY = null;
    for (const cy of cardYs) {
      for (const ey of edges.ys) {
        const d = Math.abs(cy - ey);
        if (d < SNAP_THRESHOLD && d < Math.abs(bestDy)) {
          bestDy = ey - cy;
          bestSnapY = ey;
        }
      }
    }

    if (bestSnapX !== null) {
      dx = bestDx;
      guides.push({ axis: 'x', pos: bestSnapX });
    }
    if (bestSnapY !== null) {
      dy = bestDy;
      guides.push({ axis: 'y', pos: bestSnapY });
    }

    return { dx, dy, guides };
  }

  // ── Auto-layout ──────────────────────────────────────────────────

  function autoLayout() {
    const formats = store.formats;
    if (!formats.length) return;

    const unplaced = formats.filter(f => !store.canvasPositions[f.id]);
    const placed = formats.filter(f => store.canvasPositions[f.id]);
    if (!unplaced.length) return;

    unplaced.sort((a, b) => (a.h / a.w) - (b.h / b.w));

    const MAX_ROW_W = 3600;
    let cx = 0;
    let cy = 0;
    let rowH = 0;

    if (placed.length) {
      let maxY = 0;
      for (const f of placed) {
        const p = store.canvasPositions[f.id];
        maxY = Math.max(maxY, p.y + f.h);
      }
      cy = maxY + CARD_GAP * 2;
    }

    for (const fmt of unplaced) {
      if (cx + fmt.w > MAX_ROW_W && cx > CARD_GAP) {
        cx = CARD_GAP;
        cy += rowH + CARD_GAP;
        rowH = 0;
      }
      store.canvasPositions[fmt.id] = { x: cx, y: cy };
      cx += fmt.w + CARD_GAP;
      rowH = Math.max(rowH, fmt.h);
    }

    store.scheduleSave();
  }

  // ── Fit all ──────────────────────────────────────────────────────

  function fitAll() {
    const el = containerRef.value;
    if (!el || !store.formats.length) return;

    const { width: vw, height: vh } = el.getBoundingClientRect();
    if (!vw || !vh) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const fmt of store.formats) {
      const pos = store.canvasPositions[fmt.id] || { x: 0, y: 0 };
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + fmt.w);
      maxY = Math.max(maxY, pos.y + fmt.h);
    }

    const worldW = maxX - minX;
    const worldH = maxY - minY;
    if (worldW <= 0 || worldH <= 0) return;

    const PAD = 60;
    const zx = (vw - PAD * 2) / worldW;
    const zy = (vh - PAD * 2) / worldH;
    const z = Math.min(zx, zy, 1.0); // never zoom past 100% on fit-all

    zoom.value = Math.max(MIN_ZOOM, z);
    panX.value = (vw - worldW * zoom.value) / 2 - minX * zoom.value;
    panY.value = (vh - worldH * zoom.value) / 2 - minY * zoom.value;
  }

  /** Zoom and pan to center a specific format on screen */
  function zoomToFormat(formatId) {
    const el = containerRef.value;
    if (!el) return;
    const fmt = store.formats.find(f => f.id === formatId);
    if (!fmt) return;
    const pos = store.canvasPositions[fmt.id] || { x: 0, y: 0 };
    const { width: vw, height: vh } = el.getBoundingClientRect();
    if (!vw || !vh) return;

    const PAD = 80;
    const zx = (vw - PAD * 2) / fmt.w;
    const zy = (vh - PAD * 2) / fmt.h;
    const z = Math.min(zx, zy, 1.0);

    zoom.value = Math.max(MIN_ZOOM, z);
    panX.value = (vw - fmt.w * zoom.value) / 2 - pos.x * zoom.value;
    panY.value = (vh - fmt.h * zoom.value) / 2 - pos.y * zoom.value;
  }

  // ── Zoom ─────────────────────────────────────────────────────────

  function zoomAtPoint(cx, cy, factor) {
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom.value * factor));
    panX.value = cx - (cx - panX.value) * (newZoom / zoom.value);
    panY.value = cy - (cy - panY.value) * (newZoom / zoom.value);
    zoom.value = newZoom;
  }

  function zoomIn() {
    const el = containerRef.value;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    zoomAtPoint(width / 2, height / 2, ZOOM_STEP * ZOOM_STEP);
  }

  function zoomOut() {
    const el = containerRef.value;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    zoomAtPoint(width / 2, height / 2, 1 / (ZOOM_STEP * ZOOM_STEP));
  }

  function onWheel(e) {
    e.preventDefault();
    const el = containerRef.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomAtPoint(mx, my, factor);
  }

  // ── Pointer handlers ─────────────────────────────────────────────

  let _panStart = null;
  let _dragStart = null;
  let _dragOrigPos = null;

  function _getMouseWorld(e) {
    const el = containerRef.value;
    if (!el) return { mx: 0, my: 0, wx: 0, wy: 0 };
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = screenToWorld(mx, my);
    return { mx, my, wx: w.x, wy: w.y };
  }

  function onPointerDown(e) {
    const el = containerRef.value;
    if (!el) return;
    const { mx, my, wx, wy } = _getMouseWorld(e);

    // Middle-click or Space+left-click → pan
    if (e.button === 1 || (e.button === 0 && isSpaceHeld.value)) {
      e.preventDefault();
      isPanning.value = true;
      _panStart = { x: e.clientX, y: e.clientY, px: panX.value, py: panY.value };
      el.setPointerCapture(e.pointerId);
      return;
    }

    if (e.button !== 0) return;

    // Check resize handle first
    const handleEl = e.target.closest('[data-resize-handle]');
    if (handleEl) {
      const cardEl = handleEl.closest('[data-format-id]');
      if (cardEl) {
        const fmtId = cardEl.dataset.formatId;
        const handle = handleEl.dataset.resizeHandle;
        const fmt = store.formats.find(f => f.id === fmtId);
        const pos = store.canvasPositions[fmtId] || { x: 0, y: 0 };
        if (fmt) {
          e.stopPropagation();
          selectedFormatId.value = fmtId;
          store.activeSettingsId = fmtId;
          isResizingCard.value = true;
          dragCardId.value = fmtId;
          resizeHandle.value = handle;
          _resizeStart = { wx, wy };
          _resizeOrigRect = { x: pos.x, y: pos.y, w: fmt.w, h: fmt.h };
          el.setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    // Left-click on card → drag or select
    const cardEl = e.target.closest('[data-format-id]');
    if (cardEl) {
      // Don't start drag on buttons
      if (e.target.closest('button')) return;
      const fmtId = cardEl.dataset.formatId;
      selectedFormatId.value = fmtId;
      store.activeSettingsId = fmtId;

      isDraggingCard.value = true;
      dragCardId.value = fmtId;
      const pos = store.canvasPositions[fmtId] || { x: 0, y: 0 };
      _dragStart = { wx, wy };
      _dragOrigPos = { x: pos.x, y: pos.y };
      el.setPointerCapture(e.pointerId);
      return;
    }

    // Left-click on empty space → draw-to-create or deselect
    selectedFormatId.value = null;
    store.activeSettingsId = null;

    // Block draw-to-create when no source image is loaded
    if (opts.canDraw && !opts.canDraw()) return;

    drawRect.active = true;
    drawRect.startX = wx;
    drawRect.startY = wy;
    drawRect.endX = wx;
    drawRect.endY = wy;
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    // ── Pan ──
    if (isPanning.value && _panStart) {
      panX.value = _panStart.px + (e.clientX - _panStart.x);
      panY.value = _panStart.py + (e.clientY - _panStart.y);
      return;
    }

    // ── Resize ──
    if (isResizingCard.value && _resizeStart && _resizeOrigRect && dragCardId.value) {
      const { wx, wy } = _getMouseWorld(e);
      const dx = wx - _resizeStart.wx;
      const dy = wy - _resizeStart.wy;
      const h = resizeHandle.value;
      const orig = _resizeOrigRect;
      const MIN_SIZE = 40;

      let nx = orig.x, ny = orig.y, nw = orig.w, nh = orig.h;

      // Horizontal
      if (h.includes('e')) {
        nw = Math.max(MIN_SIZE, Math.round(orig.w + dx));
      } else if (h.includes('w')) {
        const dw = Math.min(dx, orig.w - MIN_SIZE);
        nx = Math.round(orig.x + dw);
        nw = Math.round(orig.w - dw);
      }

      // Vertical
      if (h.includes('s')) {
        nh = Math.max(MIN_SIZE, Math.round(orig.h + dy));
      } else if (h.includes('n')) {
        const dh = Math.min(dy, orig.h - MIN_SIZE);
        ny = Math.round(orig.y + dh);
        nh = Math.round(orig.h - dh);
      }

      // Determine which edges are moving for targeted snapping
      const movingEdges = [];
      if (h.includes('e')) movingEdges.push('right');
      if (h.includes('w')) movingEdges.push('left');
      if (h.includes('s')) movingEdges.push('bottom');
      if (h.includes('n')) movingEdges.push('top');

      const snapRect = { x: nx, y: ny, w: nw, h: nh };
      const snap = computeSnap(snapRect, dragCardId.value, movingEdges);

      if (snap.dx !== 0) {
        if (h.includes('e')) nw += snap.dx;
        else if (h.includes('w')) { nx += snap.dx; nw -= snap.dx; }
      }
      if (snap.dy !== 0) {
        if (h.includes('s')) nh += snap.dy;
        else if (h.includes('n')) { ny += snap.dy; nh -= snap.dy; }
      }
      snapGuides.value = snap.guides;

      store.canvasPositions[dragCardId.value] = { x: nx, y: ny };
      store.updateFormat(dragCardId.value, 'w', Math.max(MIN_SIZE, nw));
      store.updateFormat(dragCardId.value, 'h', Math.max(MIN_SIZE, nh));
      return;
    }

    // ── Card drag ──
    if (isDraggingCard.value && _dragStart && _dragOrigPos && dragCardId.value) {
      const { wx, wy } = _getMouseWorld(e);
      const dx = wx - _dragStart.wx;
      const dy = wy - _dragStart.wy;
      let newX = Math.round(_dragOrigPos.x + dx);
      let newY = Math.round(_dragOrigPos.y + dy);

      const fmt = store.formats.find(f => f.id === dragCardId.value);
      if (fmt) {
        const snap = computeSnap({ x: newX, y: newY, w: fmt.w, h: fmt.h }, dragCardId.value);
        newX += snap.dx;
        newY += snap.dy;
        snapGuides.value = snap.guides;
      }

      store.canvasPositions[dragCardId.value] = { x: newX, y: newY };
      return;
    }

    // ── Draw-to-create ──
    if (drawRect.active) {
      const { wx, wy } = _getMouseWorld(e);
      drawRect.endX = wx;
      drawRect.endY = wy;
    }
  }

  function onPointerUp(e) {
    // Always clear snap guides on release
    snapGuides.value = [];

    if (isPanning.value) {
      isPanning.value = false;
      _panStart = null;
      return;
    }

    if (isResizingCard.value) {
      isResizingCard.value = false;
      resizeHandle.value = null;
      dragCardId.value = null;
      _resizeStart = null;
      _resizeOrigRect = null;
      store.scheduleSave();
      if (opts.onFormatResized) opts.onFormatResized(dragCardId.value);
      return;
    }

    if (isDraggingCard.value) {
      isDraggingCard.value = false;
      dragCardId.value = null;
      _dragStart = null;
      _dragOrigPos = null;
      store.scheduleSave();
      return;
    }

    if (drawRect.active) {
      drawRect.active = false;
      const w = Math.round(Math.abs(drawRect.endX - drawRect.startX));
      const h = Math.round(Math.abs(drawRect.endY - drawRect.startY));
      if (w > 50 && h > 50) {
        const x = Math.round(Math.min(drawRect.startX, drawRect.endX));
        const y = Math.round(Math.min(drawRect.startY, drawRect.endY));
        const label = `Custom ${w}\u00D7${h}`;
        const id = store.addFormat(label, w, h, x, y);
        selectedFormatId.value = id;
        store.activeSettingsId = id;
        if (opts.onFormatCreated) opts.onFormatCreated(id);
      }
    }
  }

  // ── Keyboard ─────────────────────────────────────────────────────

  function resetZoom() {
    const el = containerRef.value;
    if (!el) { zoom.value = 1; return; }
    const { width: vw, height: vh } = el.getBoundingClientRect();
    // Keep the current centre point when resetting to 100%
    const cx = vw / 2, cy = vh / 2;
    const worldCX = (cx - panX.value) / zoom.value;
    const worldCY = (cy - panY.value) / zoom.value;
    zoom.value = 1;
    panX.value = cx - worldCX;
    panY.value = cy - worldCY;
  }

  function onKeyDown(e) {
    if (e.code === 'Space' && !e.repeat) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      e.preventDefault();
      isSpaceHeld.value = true;
    }
    // Ctrl+0 → reset zoom to 100%
    if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      resetZoom();
      return;
    }
    // Ctrl+1 → fit all
    if (e.key === '1' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      fitAll();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFormatId.value) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      store.removeFormat(selectedFormatId.value);
      selectedFormatId.value = null;
    }
  }

  function onKeyUp(e) {
    if (e.code === 'Space') isSpaceHeld.value = false;
  }

  function setupEvents() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
  }

  function teardownEvents() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
  }

  // ── Computed ─────────────────────────────────────────────────────

  const cursorClass = computed(() => {
    if (isPanning.value) return 'cursor-grabbing';
    if (isSpaceHeld.value) return 'cursor-grab';
    if (isResizingCard.value) {
      const h = resizeHandle.value;
      if (h === 'n' || h === 's') return 'cursor-ns';
      if (h === 'e' || h === 'w') return 'cursor-ew';
      if (h === 'nw' || h === 'se') return 'cursor-nwse';
      if (h === 'ne' || h === 'sw') return 'cursor-nesw';
      return 'cursor-nwse';
    }
    if (isDraggingCard.value) return 'cursor-move';
    return 'cursor-default';
  });

  const worldStyle = computed(() => ({
    transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
    transformOrigin: '0 0',
  }));

  const zoomPercent = computed(() => Math.round(zoom.value * 100));

  return {
    // State
    panX, panY, zoom, zoomPercent,
    isPanning, isSpaceHeld, isDraggingCard, isResizingCard, dragCardId, selectedFormatId,
    resizeHandle, snapGuides,
    drawRect, drawRectStyle,
    containerRef,
    // Computed
    cursorClass, worldStyle,
    // Methods
    worldToScreen, screenToWorld,
    autoLayout, fitAll, zoomToFormat, resetZoom,
    zoomIn, zoomOut, zoomAtPoint,
    // Event handlers
    onWheel, onPointerDown, onPointerMove, onPointerUp,
    setupEvents, teardownEvents,
  };
}
