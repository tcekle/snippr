import { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Group, Image as KonvaImage, Rect, Ellipse, Arrow, Line, Circle, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { nanoid } from 'nanoid';
import { useEditorStore } from '../store/editorStore';
import type { Annotation, RectAnno, ShapeAnno, ShapeKind, EllipseAnno, ArrowAnno, LineAnno, PenAnno, HighlightAnno, TextAnno, BadgeAnno, PixelateAnno, ImageAnno, LoupeAnno, SpotlightAnno, CropRect } from '../types/annotations';
import { shapePoints, isShapeTool } from '../utils/shapeGeometry';
import { whenHandFontsReady } from '../utils/handFonts';
import { RectShape } from './annotations/RectShape';
import { PolyShape } from './annotations/PolyShape';
import { EllipseShape } from './annotations/EllipseShape';
import { ArrowShape } from './annotations/ArrowShape';
import { LineShape } from './annotations/LineShape';
import { PenShape } from './annotations/PenShape';
import { HighlightShape } from './annotations/HighlightShape';
import { TextShape } from './annotations/TextShape';
import { BadgeShape } from './annotations/BadgeShape';
import { PixelateShape } from './annotations/PixelateShape';
import { LoupeShape } from './annotations/LoupeShape';
import { SpotlightShape } from './annotations/SpotlightShape';
import { ImageShape } from './annotations/ImageShape';
import { BackdropPanel, BackdropChrome } from './Backdrop';
import { backdropBounds, imageCornerRadius, tiltLayerProps, xformPoint, cropClipFunc } from '../utils/backdropGeometry';
import { buildPixelateCanvas } from '../utils/buildPixelateCanvas';
import { TextEditOverlay } from './TextEditOverlay';

type InProgress =
  | { type: 'rect' | 'pixelate' | 'loupe' | 'spotlight'; x: number; y: number; width: number; height: number }
  | { type: 'shape'; shape: ShapeKind; x: number; y: number; width: number; height: number }
  | { type: 'ellipse'; x: number; y: number; radiusX: number; radiusY: number }
  | { type: 'arrow' | 'line'; points: number[] }
  | { type: 'pen' | 'highlight'; points: number[] }
  | null;

// ── Crop interaction (Lightroom/Photoshop-style) ─────────────────────────────
// The crop frame is axis-aligned in document space; "rotation" rotates the image
// beneath it (handled in EditorCanvas via layer transforms + at export). Handle
// hit-testing is geometric (the overlay nodes are purely visual, listening=false)
// so it's unaffected by the content-layer rotation, which keeps the math simple.
type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type CropHit = CropHandle | 'rotate' | 'move' | null;
type CropDrag =
  | { mode: 'move'; start: CropRect; startPos: { x: number; y: number } }
  | { mode: 'resize'; handle: CropHandle; start: CropRect }
  | { mode: 'rotate'; start: CropRect; cx: number; cy: number; startAngle: number; startRotation: number }
  | null;

const CROP_MIN = 16;            // smallest crop side, document px
const CROP_HANDLE_PX = 10;      // on-screen handle side
const CROP_HIT_PX = 12;         // on-screen grab tolerance (half-extent)
const CROP_ROT_PX = 30;         // rotate-knob distance above the top edge

/** Which crop control (if any) sits under the cursor. Sizes are screen px, so
 *  divide by the stage scale to compare in document space. Corners beat edges. */
function cropHitTest(p: { x: number; y: number }, r: CropRect, scale: number): CropHit {
  const tol = CROP_HIT_PX / scale;
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  if (Math.hypot(p.x - cx, p.y - (r.y - CROP_ROT_PX / scale)) <= CROP_HIT_PX / scale) return 'rotate';
  const pts: [CropHandle, number, number][] = [
    ['nw', r.x, r.y], ['ne', r.x + r.width, r.y], ['se', r.x + r.width, r.y + r.height], ['sw', r.x, r.y + r.height],
    ['n', cx, r.y], ['e', r.x + r.width, cy], ['s', cx, r.y + r.height], ['w', r.x, cy],
  ];
  for (const [h, hx, hy] of pts) {
    if (Math.abs(p.x - hx) <= tol && Math.abs(p.y - hy) <= tol) return h;
  }
  if (p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height) return 'move';
  return null;
}

function cropCursorFor(hit: CropHit): string {
  switch (hit) {
    case 'nw': case 'se': return 'nwse-resize';
    case 'ne': case 'sw': return 'nesw-resize';
    case 'n': case 's': return 'ns-resize';
    case 'e': case 'w': return 'ew-resize';
    case 'rotate': return 'grab';
    case 'move': return 'move';
    default: return 'crosshair';
  }
}

/** Resize from the `start` rect by dragging `handle` to point `p`. Absolute (not
 *  incremental), so it never drifts. `aspect` (w/h) locks the ratio; otherwise the
 *  rect clamps to the image for the common free + unrotated case. */
function resizeCropRect(
  start: CropRect, handle: CropHandle, p: { x: number; y: number },
  aspect: number | null, imgW: number, imgH: number,
): CropRect {
  let l = start.x, t = start.y, rt = start.x + start.width, b = start.y + start.height;
  if (handle.includes('w')) l = Math.min(p.x, rt - CROP_MIN);
  if (handle.includes('e')) rt = Math.max(p.x, l + CROP_MIN);
  if (handle.includes('n')) t = Math.min(p.y, b - CROP_MIN);
  if (handle.includes('s')) b = Math.max(p.y, t + CROP_MIN);
  let nx = l, ny = t, nw = rt - l, nh = b - t;

  if (aspect) {
    if (handle.length === 2) {
      // Corner: keep the opposite corner anchored, fit the dragged box to the ratio.
      const ax = handle.includes('w') ? rt : l;
      const ay = handle.includes('n') ? b : t;
      let w2 = nw, h2 = nw / aspect;
      if (h2 > nh) { h2 = nh; w2 = nh * aspect; }
      w2 = Math.max(CROP_MIN, w2); h2 = Math.max(CROP_MIN, h2);
      nx = handle.includes('w') ? ax - w2 : ax;
      ny = handle.includes('n') ? ay - h2 : ay;
      nw = w2; nh = h2;
    } else if (handle === 'w' || handle === 'e') {
      nh = nw / aspect;
      ny = start.y + start.height / 2 - nh / 2;
    } else {
      nw = nh * aspect;
      nx = start.x + start.width / 2 - nw / 2;
    }
  } else if (!start.rotation) {
    if (nx < 0) { nw += nx; nx = 0; }
    if (ny < 0) { nh += ny; ny = 0; }
    if (nx + nw > imgW) nw = imgW - nx;
    if (ny + nh > imgH) nh = imgH - ny;
    nw = Math.max(CROP_MIN, nw); nh = Math.max(CROP_MIN, nh);
  }
  return { x: nx, y: ny, width: nw, height: nh, rotation: start.rotation ?? 0 };
}

export function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [inProgress, setInProgress] = useState<InProgress>(null);
  // Composition bounds = the doc/backdrop box grown to wrap any annotations that
  // spill outside it, so the page auto-sizes around them (matches export bounds).
  const [contentBounds, setContentBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  // Ctrl = temporary move tool (Photoshop-style): annotations become
  // interactive/draggable while held, and draw tools pause.
  const [ctrlDown, setCtrlDown] = useState(false);
  const isDrawing = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const spaceDown = useRef(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, stageX: 0, stageY: 0 });
  // Crop gesture (resize/move/rotate). cropPushed guards a single undo snapshot
  // per gesture; cropCursor drives the hover cursor over the crop controls.
  const cropDrag = useRef<CropDrag>(null);
  const cropPushed = useRef(false);
  const cropCursorRef = useRef('crosshair');
  const [cropCursor, setCropCursor] = useState('crosshair');

  const store = useEditorStore();
  const {
    screenshot, boardBackground, annotations, selectedId, activeTool, strokeColor, strokeWidth, fontSize,
    sketchMode, sketchRoughness, textFont,
    editingTextId, view, cropRect, backdrop, fitNonce,
    addAnnotation, updateAnnotation, setSelectedId, setEditingTextId,
    setView, setCropRect, setStageRef, newBoard,
  } = store;

  /** Sketch fields stamped onto a newly drawn shape. The seed is drawn once and
   *  stored, so the shape wobbles identically forever after — including in the
   *  exported PNG. A fresh seed per annotation stops two rings drawn back to
   *  back from being visibly the same squiggle. */
  const newSketch = useCallback(
    () => (sketchMode
      ? { sketch: true, seed: Math.floor(Math.random() * 100000), roughness: sketchRoughness }
      : {}),
    [sketchMode, sketchRoughness],
  );

  // A board is a doc with a background but no image; treat it as a real document
  // everywhere the canvas used to require screenshot.imageEl.
  const isBoard = boardBackground !== null;
  const hasDoc = !!screenshot.imageEl || isBoard;

  // ── Crop/backdrop composition state ───────────────────────────────────────
  // Crop and backdrop COMPOSE: the committed crop defines the content rect the
  // backdrop wraps. While the crop TOOL is active the composition shows the
  // uncommitted view (frame around the full image, nothing clipped) so the
  // chrome doesn't chase the drag; leaving the tool commits it.
  const cropRot = cropRect?.rotation ?? 0;
  const cropCx = cropRect ? cropRect.x + cropRect.width / 2 : 0;
  const cropCy = cropRect ? cropRect.y + cropRect.height / 2 : 0;
  // A full-image, unrotated crop trims nothing — treat it as "no crop" for display.
  const cropTrivial = !!cropRect && !cropRot
    && cropRect.x <= 0 && cropRect.y <= 0
    && cropRect.width >= screenshot.width && cropRect.height >= screenshot.height;
  const cropApplied = !!cropRect && activeTool !== 'crop' && !cropTrivial;
  // What the backdrop frame wraps + the tilt pivot: committed crop or whole image.
  const contentRect = cropApplied && cropRect
    ? { x: cropRect.x, y: cropRect.y, width: cropRect.width, height: cropRect.height }
    : { x: 0, y: 0, width: screenshot.width, height: screenshot.height };

  // Register stage ref
  useEffect(() => {
    if (stageRef.current) setStageRef(stageRef.current);
    return () => setStageRef(null);
  }, [setStageRef]);

  // Canvas text is rasterised with whatever face is resolved at draw time, and
  // nothing invalidates it when a webfont arrives later — a hand-lettered label
  // drawn during that window stays in the fallback until something else forces
  // a redraw. Force one when the faces land.
  useEffect(() => {
    let cancelled = false;
    whenHandFontsReady().then(() => {
      if (!cancelled) stageRef.current?.batchDraw();
    });
    return () => { cancelled = true; };
  }, []);

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    setContainerSize({ width: el.offsetWidth, height: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  // The base box is the content rect (image/board page, or the committed crop)
  // or the padded backdrop composition around it.
  const baseBounds = useCallback(
    () => backdrop ? backdropBounds(contentRect, backdrop) : contentRect,
    // contentRect is rebuilt each render; depend on its parts to keep this stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [backdrop, contentRect.x, contentRect.y, contentRect.width, contentRect.height]
  );

  // Base box grown to wrap any committed annotations (layer 1) that spill outside
  // it, so the page auto-sizes around them. getClientRect(relativeTo: stage) is in
  // document space (the stage transform cancels out), so it's zoom/pan-independent.
  // Returns the base unchanged when everything is inside.
  const measureContentBounds = useCallback(() => {
    const base = baseBounds();
    // A committed crop is a hard boundary: annotations outside it are clipped
    // away, so they must not grow the page (getClientRect can't see the clip).
    if (cropApplied) return base;
    const stage = stageRef.current;
    if (!stage) return base;
    const annoLayer = stage.getLayers()[1];
    const a = annoLayer?.getClientRect({ relativeTo: stage });
    if (!a || a.width === 0 || a.height === 0) return base;
    const minX = Math.floor(Math.min(base.x, a.x));
    const minY = Math.floor(Math.min(base.y, a.y));
    const maxX = Math.ceil(Math.max(base.x + base.width, a.x + a.width));
    const maxY = Math.ceil(Math.max(base.y + base.height, a.y + a.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [baseBounds, cropApplied]);

  // Track the grown bounds as annotations change — used to grow the board page fill.
  useEffect(() => {
    setContentBounds(hasDoc ? measureContentBounds() : null);
  }, [annotations, measureContentBounds, hasDoc]);

  // Fit on new doc, container resize, or explicit fit (Ctrl+0 / Fit). Frames the
  // whole composition incl. out-of-page annotations. Deliberately NOT triggered by
  // drawing, so committing an annotation never yanks the user's zoom/pan.
  useEffect(() => {
    if (!hasDoc || containerSize.width === 0 || containerSize.height === 0) return;
    // A committed crop (any tool but crop, non-trivial) frames just the crop
    // region; otherwise frame the whole composition. Read live state so this isn't
    // re-triggered on every crop edit — only on fitNonce/resize/new-doc.
    const st = useEditorStore.getState();
    const cr = st.cropRect;
    const trivial = !!cr && !cr.rotation && cr.x <= 0 && cr.y <= 0
      && cr.width >= st.screenshot.width && cr.height >= st.screenshot.height;
    const cropView = !!cr && st.activeTool !== 'crop' && !trivial;
    // measureContentBounds already frames the committed crop (or the backdrop
    // composition around it); cropView only picks the zoom-to-fill cap.
    const bounds = measureContentBounds();
    // A committed crop zooms to fill the viewport (cap at max zoom); normal docs
    // never upscale past 100%.
    const scale = Math.min(
      containerSize.width / bounds.width,
      containerSize.height / bounds.height,
      cropView ? 8 : 1
    );
    const x = (containerSize.width - bounds.width * scale) / 2 - bounds.x * scale;
    const y = (containerSize.height - bounds.height * scale) / 2 - bounds.y * scale;
    setView({ scale, x, y });
  }, [screenshot.url, containerSize.width, containerSize.height, fitNonce, hasDoc, measureContentBounds]);

  // Re-fit on crop-tool transitions: entering frames the whole image (to adjust),
  // leaving frames the committed crop. Other tool changes don't refit.
  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    const was = prevToolRef.current;
    prevToolRef.current = activeTool;
    if (was !== activeTool && (was === 'crop' || activeTool === 'crop')) {
      useEditorStore.getState().requestFit();
    }
  }, [activeTool]);

  // Update transformer on selection change
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    if (selectedId) {
      const node = stageRef.current.findOne('#' + selectedId);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
      } else {
        transformerRef.current.nodes([]);
      }
    } else {
      transformerRef.current.nodes([]);
    }
  }, [selectedId, annotations]);

  const getPointerPos = useCallback(() => {
    return stageRef.current?.getRelativePointerPosition() ?? { x: 0, y: 0 };
  }, []);

  // Pointer position in the annotations' DRAW SPACE — the innermost group of
  // the annotations layer (named 'draw-space'), beneath the tilt, crop-clip and
  // straighten groups — so its inverse transform maps the cursor into the same
  // space committed annotations render in, and shapes land under the cursor.
  // The crop frame itself stays in stage space (it's upright by design), so
  // crop interactions use getPointerPos.
  const getDrawPos = useCallback(() => {
    const stage = stageRef.current;
    const layer = stage?.getLayers()[1];
    const drawSpace = layer?.findOne('.draw-space') ?? layer;
    return drawSpace?.getRelativePointerPosition()
      ?? stage?.getRelativePointerPosition()
      ?? { x: 0, y: 0 };
  }, []);

  const handlePointerDown = useCallback((e: KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    // Middle mouse or space+drag = pan
    if (e.evt.button === 1 || spaceDown.current) {
      isPanning.current = true;
      panStart.current = {
        x: e.evt.clientX,
        y: e.evt.clientY,
        stageX: view.x,
        stageY: view.y,
      };
      return;
    }

    if (e.evt.button !== 0) return;

    // Ctrl-click falls through to the shape's own drag handling — never draw
    if (e.evt.ctrlKey && activeTool !== 'select') return;

    // Crop works in stage/document space (the frame is upright); annotations are
    // captured in the (possibly rotated) annotation layer's space.
    const pos = activeTool === 'crop' ? getPointerPos() : getDrawPos();
    dragStartPos.current = pos;

    if (activeTool === 'select') {
      const target = e.target;
      if (target === stage) {
        setSelectedId(null);
      }
      return;
    }

    // Text is created on pointerUP: a textarea mounted during pointerdown
    // loses focus to the browser's own mousedown focus handling.
    if (activeTool === 'text') return;

    if (activeTool === 'badge') {
      // Number = highest existing badge + 1, so deleting or undoing the last
      // badge frees its number for the next one.
      const annos = useEditorStore.getState().annotations;
      const next = annos.reduce((m, a) => (a.type === 'badge' ? Math.max(m, a.number) : m), 0) + 1;
      const anno: BadgeAnno = {
        id: nanoid(), type: 'badge',
        x: pos.x, y: pos.y,
        number: next,
        fill: strokeColor,
        radius: 16,
        ...newSketch(),
      };
      addAnnotation(anno);
      setSelectedId(anno.id);
      return;
    }

    // Crop: adjust the existing frame via geometric hit-testing of its handles /
    // body / rotate knob; a drag on empty canvas starts a fresh crop region.
    if (activeTool === 'crop') {
      const cr = useEditorStore.getState().cropRect;
      if (cr) {
        const hit = cropHitTest(pos, cr, view.scale);
        cropPushed.current = false;
        if (hit === 'move') {
          cropDrag.current = { mode: 'move', start: cr, startPos: pos };
          return;
        }
        if (hit === 'rotate') {
          const cx = cr.x + cr.width / 2, cy = cr.y + cr.height / 2;
          cropDrag.current = {
            mode: 'rotate', start: cr, cx, cy,
            startAngle: Math.atan2(pos.y - cy, pos.x - cx), startRotation: cr.rotation ?? 0,
          };
          return;
        }
        if (hit) {
          cropDrag.current = { mode: 'resize', handle: hit, start: cr };
          return;
        }
      }
      // Empty-canvas drag → draw a fresh crop rectangle.
      isDrawing.current = true;
      setSelectedId(null);
      setInProgress({ type: 'rect', x: pos.x, y: pos.y, width: 0, height: 0 });
      return;
    }

    isDrawing.current = true;
    setSelectedId(null); // starting a new draw drops any prior selection

    if (activeTool === 'rect' || activeTool === 'pixelate' || activeTool === 'loupe' || activeTool === 'spotlight') {
      setInProgress({ type: activeTool, x: pos.x, y: pos.y, width: 0, height: 0 });
    } else if (isShapeTool(activeTool)) {
      setInProgress({ type: 'shape', shape: activeTool, x: pos.x, y: pos.y, width: 0, height: 0 });
    } else if (activeTool === 'ellipse') {
      setInProgress({ type: 'ellipse', x: pos.x, y: pos.y, radiusX: 0, radiusY: 0 });
    } else if (activeTool === 'arrow' || activeTool === 'line') {
      setInProgress({ type: activeTool, points: [pos.x, pos.y, pos.x, pos.y] });
    } else if (activeTool === 'pen' || activeTool === 'highlight') {
      setInProgress({ type: activeTool, points: [pos.x, pos.y] });
    }
  }, [activeTool, view, strokeColor, fontSize, newSketch, addAnnotation, setSelectedId, setEditingTextId, getPointerPos, getDrawPos]);

  const handlePointerMove = useCallback((e: KonvaEventObject<PointerEvent>) => {
    if (isPanning.current) {
      const dx = e.evt.clientX - panStart.current.x;
      const dy = e.evt.clientY - panStart.current.y;
      setView({ x: panStart.current.stageX + dx, y: panStart.current.stageY + dy });
      return;
    }

    // Crop gesture (resize / move / rotate). One undo snapshot per gesture.
    if (cropDrag.current) {
      const d = cropDrag.current;
      const cp = getPointerPos();
      if (!cropPushed.current) { useEditorStore.getState().pushHistory(); cropPushed.current = true; }
      if (d.mode === 'move') {
        let nx = d.start.x + (cp.x - d.startPos.x);
        let ny = d.start.y + (cp.y - d.startPos.y);
        if (!d.start.rotation) {
          nx = Math.max(0, Math.min(nx, screenshot.width - d.start.width));
          ny = Math.max(0, Math.min(ny, screenshot.height - d.start.height));
        }
        setCropRect({ ...d.start, x: nx, y: ny });
      } else if (d.mode === 'rotate') {
        const ang = Math.atan2(cp.y - d.cy, cp.x - d.cx);
        const deg = Math.max(-45, Math.min(45, d.startRotation + (ang - d.startAngle) * 180 / Math.PI));
        setCropRect({ ...d.start, rotation: Math.round(deg * 10) / 10 });
      } else {
        setCropRect(resizeCropRect(d.start, d.handle, cp, useEditorStore.getState().cropAspect, screenshot.width, screenshot.height));
      }
      return;
    }

    // Hover cursor over the crop controls when idle (not drawing a fresh region).
    if (activeTool === 'crop' && !isDrawing.current) {
      const cr = useEditorStore.getState().cropRect;
      const c = cropCursorFor(cr ? cropHitTest(getPointerPos(), cr, view.scale) : null);
      if (c !== cropCursorRef.current) { cropCursorRef.current = c; setCropCursor(c); }
    }

    if (!isDrawing.current || !inProgress) return;
    const pos = activeTool === 'crop' ? getPointerPos() : getDrawPos();

    if (inProgress.type === 'rect' || inProgress.type === 'pixelate' || inProgress.type === 'loupe' || inProgress.type === 'spotlight' || inProgress.type === 'shape') {
      setInProgress({
        ...inProgress,
        x: Math.min(pos.x, dragStartPos.current.x),
        y: Math.min(pos.y, dragStartPos.current.y),
        width: Math.abs(pos.x - dragStartPos.current.x),
        height: Math.abs(pos.y - dragStartPos.current.y),
      });
    } else if (inProgress.type === 'ellipse') {
      const cx = (pos.x + dragStartPos.current.x) / 2;
      const cy = (pos.y + dragStartPos.current.y) / 2;
      setInProgress({
        type: 'ellipse',
        x: cx, y: cy,
        radiusX: Math.abs(pos.x - dragStartPos.current.x) / 2,
        radiusY: Math.abs(pos.y - dragStartPos.current.y) / 2,
      });
    } else if (inProgress.type === 'arrow' || inProgress.type === 'line') {
      setInProgress({ type: inProgress.type, points: [dragStartPos.current.x, dragStartPos.current.y, pos.x, pos.y] });
    } else if (inProgress.type === 'pen' || inProgress.type === 'highlight') {
      setInProgress({ type: inProgress.type, points: [...inProgress.points, pos.x, pos.y] });
    }
  }, [inProgress, getPointerPos, getDrawPos, setView, activeTool, view, screenshot.width, screenshot.height, setCropRect]);

  const handlePointerUp = useCallback((e: KonvaEventObject<PointerEvent>) => {
    if (isPanning.current) { isPanning.current = false; return; }

    // End a crop resize/move/rotate gesture (history already snapshotted on first move).
    if (cropDrag.current) { cropDrag.current = null; cropPushed.current = false; return; }

    // Create text here (not on pointerdown): focus only moves on mousedown,
    // so a textarea mounted after the release keeps focus and typing starts
    // immediately.
    if (activeTool === 'text' && e.evt.button === 0 && !e.evt.ctrlKey) {
      const pos = getDrawPos();
      const id = nanoid();
      addAnnotation({
        id, type: 'text',
        x: pos.x, y: pos.y,
        text: '',
        fontSize,
        fill: strokeColor,
        fontFamily: textFont,
      } satisfies TextAnno);
      setEditingTextId(id);
      return;
    }

    if (!isDrawing.current || !inProgress) return;
    isDrawing.current = false;

    if (activeTool === 'crop' && inProgress.type === 'rect' && inProgress.width > 5 && inProgress.height > 5) {
      useEditorStore.getState().pushHistory();
      setCropRect({ x: inProgress.x, y: inProgress.y, width: inProgress.width, height: inProgress.height });
      setInProgress(null);
      return;
    }

    let committed: Annotation | null = null;
    if (activeTool === 'rect' && inProgress.type === 'rect' && inProgress.width > 2 && inProgress.height > 2) {
      committed = {
        id: nanoid(), type: 'rect',
        x: inProgress.x, y: inProgress.y,
        width: inProgress.width, height: inProgress.height,
        stroke: strokeColor, strokeWidth,
        ...newSketch(),
      } satisfies RectAnno;
    } else if (inProgress.type === 'shape' && inProgress.width > 2 && inProgress.height > 2) {
      committed = {
        id: nanoid(), type: 'shape', shape: inProgress.shape,
        x: inProgress.x, y: inProgress.y,
        width: inProgress.width, height: inProgress.height,
        stroke: strokeColor, strokeWidth,
        ...newSketch(),
      } satisfies ShapeAnno;
    } else if (activeTool === 'ellipse' && inProgress.type === 'ellipse' && inProgress.radiusX > 1) {
      committed = {
        id: nanoid(), type: 'ellipse',
        x: inProgress.x, y: inProgress.y,
        radiusX: inProgress.radiusX, radiusY: inProgress.radiusY,
        stroke: strokeColor, strokeWidth,
        ...newSketch(),
      } satisfies EllipseAnno;
    } else if (activeTool === 'arrow' && inProgress.type === 'arrow') {
      committed = {
        id: nanoid(), type: 'arrow',
        points: inProgress.points,
        stroke: strokeColor, strokeWidth,
        ...newSketch(),
      } satisfies ArrowAnno;
    } else if (activeTool === 'line' && inProgress.type === 'line') {
      committed = {
        id: nanoid(), type: 'line',
        points: inProgress.points,
        stroke: strokeColor, strokeWidth,
        ...newSketch(),
      } satisfies LineAnno;
    } else if (activeTool === 'pen' && inProgress.type === 'pen' && inProgress.points.length > 2) {
      committed = {
        id: nanoid(), type: 'pen',
        points: inProgress.points,
        stroke: strokeColor, strokeWidth,
      } satisfies PenAnno;
    } else if (activeTool === 'highlight' && inProgress.type === 'highlight' && inProgress.points.length > 2) {
      committed = {
        id: nanoid(), type: 'highlight',
        points: inProgress.points,
        stroke: '#ffe600', strokeWidth,
      } satisfies HighlightAnno;
    } else if (activeTool === 'pixelate' && inProgress.type === 'pixelate' && inProgress.width > 5 && inProgress.height > 5) {
      committed = {
        id: nanoid(), type: 'pixelate',
        x: inProgress.x, y: inProgress.y,
        width: inProgress.width, height: inProgress.height,
        pixelSize: 12,
      } satisfies PixelateAnno;
    } else if (activeTool === 'loupe' && inProgress.type === 'loupe' && inProgress.width > 8 && inProgress.height > 8) {
      const size = Math.max(inProgress.width, inProgress.height);
      const zoom = 2.5;
      const lensSide = size * zoom;
      const srcX = inProgress.x, srcY = inProgress.y;
      // Place the lens centered over the source, above it (or below if there's no
      // room above). It may extend past the image edge — the canvas auto-grows to
      // include it, so it stays visible and is baked into the export.
      const lx = Math.max(0, srcX + size / 2 - lensSide / 2);
      const ly = srcY - lensSide - 24 >= 0 ? srcY - lensSide - 24 : srcY + size + 24;
      committed = {
        id: nanoid(), type: 'loupe',
        srcX, srcY, size,
        x: lx, y: ly,
        zoom, shape: 'circle',
        borderColor: strokeColor, borderWidth: 3,
        showSource: true, connector: true,
      } satisfies LoupeAnno;
    } else if (activeTool === 'spotlight' && inProgress.type === 'spotlight' && inProgress.width > 8 && inProgress.height > 8) {
      committed = {
        id: nanoid(), type: 'spotlight',
        x: inProgress.x, y: inProgress.y, width: inProgress.width, height: inProgress.height,
        shape: 'rect', dim: 0.62, feather: 10, invert: false,
      } satisfies SpotlightAnno;
    }
    if (committed) {
      addAnnotation(committed);
      // Auto-select so Delete / transform / properties apply immediately
      setSelectedId(committed.id);
    }
    setInProgress(null);
  }, [activeTool, inProgress, strokeColor, strokeWidth, fontSize, textFont, newSketch, addAnnotation, setCropRect, setSelectedId, setEditingTextId, getPointerPos, getDrawPos]);

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    if (e.evt.ctrlKey) {
      const oldScale = view.scale;
      const pointer = stage.getPointerPosition()!;
      const mousePointTo = {
        x: (pointer.x - view.x) / oldScale,
        y: (pointer.y - view.y) / oldScale,
      };
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = Math.max(0.1, Math.min(8, oldScale * (direction > 0 ? 1.1 : 1 / 1.1)));
      setView({
        scale: newScale,
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    } else if (e.evt.shiftKey) {
      setView({ x: view.x - e.evt.deltaY });
    } else {
      setView({ y: view.y - e.evt.deltaY });
    }
  }, [view, setView]);

  // Space key for panning, Ctrl as temporary move tool, Esc cancels a draw
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = true;
      if (e.key === 'Control') setCtrlDown(true);
      if (e.key === 'Escape' && isDrawing.current) {
        isDrawing.current = false;
        setInProgress(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceDown.current = false; isPanning.current = false; }
      if (e.key === 'Control') setCtrlDown(false);
    };
    // Alt-tab with Ctrl held would leave the flag stuck
    const onBlur = () => setCtrlDown(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const handleTransformEnd = useCallback((anno: Annotation, node: Konva.Node) => {
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    if (anno.type === 'rect' || anno.type === 'shape' || anno.type === 'pixelate' || anno.type === 'image') {
      updateAnnotation(anno.id, {
        x: node.x(), y: node.y(),
        width: Math.max(2, (anno as RectAnno).width * sx),
        height: Math.max(2, (anno as RectAnno).height * sy),
      } as Partial<typeof anno>, true);
    } else if (anno.type === 'ellipse') {
      updateAnnotation(anno.id, {
        x: node.x(), y: node.y(),
        radiusX: Math.max(1, (anno as EllipseAnno).radiusX * sx),
        radiusY: Math.max(1, (anno as EllipseAnno).radiusY * sy),
      } as Partial<typeof anno>, true);
    } else if (anno.type === 'text') {
      updateAnnotation(anno.id, {
        x: node.x(), y: node.y(),
        fontSize: Math.max(8, (anno as TextAnno).fontSize * sy),
      } as Partial<typeof anno>, true);
    } else if (anno.type === 'badge') {
      updateAnnotation(anno.id, {
        x: node.x(), y: node.y(),
        radius: Math.max(8, (anno as BadgeAnno).radius * sx),
      } as Partial<typeof anno>, true);
    } else if (anno.type === 'spotlight') {
      updateAnnotation(anno.id, {
        x: node.x(), y: node.y(),
        width: Math.max(8, (anno as SpotlightAnno).width * sx),
        height: Math.max(8, (anno as SpotlightAnno).height * sy),
      } as Partial<typeof anno>, true);
    } else if (anno.type === 'arrow' || anno.type === 'line' || anno.type === 'pen' || anno.type === 'highlight') {
      const a = anno as ArrowAnno | LineAnno | PenAnno | HighlightAnno;
      const nx = node.x();
      const ny = node.y();
      node.position({ x: 0, y: 0 });
      updateAnnotation(anno.id, {
        points: a.points.map((v, i) => (i % 2 === 0 ? v * sx + nx : v * sy + ny)),
      } as Partial<typeof anno>, true);
    } else if (anno.type === 'loupe') {
      const a = anno as LoupeAnno;
      updateAnnotation(anno.id, {
        x: node.x(), y: node.y(),
        zoom: Math.max(1, a.zoom * sx),
      } as Partial<typeof anno>, true);
    }
  }, [updateAnnotation]);

  const renderAnnotation = useCallback((anno: Annotation) => {
    const sel = selectedId === anno.id && activeTool === 'select';
    const onSelect = () => { if (activeTool === 'select') setSelectedId(anno.id); };

    switch (anno.type) {
      case 'rect':
        return <RectShape key={anno.id} anno={anno} selected={sel} onSelect={onSelect}
          onChange={(p, h) => updateAnnotation(anno.id, p as Partial<RectAnno>, h)} />;
      case 'shape':
        return <PolyShape key={anno.id} anno={anno} selected={sel} onSelect={onSelect}
          onChange={(p, h) => updateAnnotation(anno.id, p as Partial<ShapeAnno>, h)} />;
      case 'ellipse':
        return <EllipseShape key={anno.id} anno={anno} selected={sel} onSelect={onSelect}
          onChange={(p, h) => updateAnnotation(anno.id, p as Partial<EllipseAnno>, h)} />;
      case 'arrow':
        return <ArrowShape key={anno.id} anno={anno} selected={sel} onSelect={onSelect}
          onChange={(p, h) => updateAnnotation(anno.id, p as Partial<ArrowAnno>, h)} />;
      case 'line':
        return <LineShape key={anno.id} anno={anno} selected={sel} onSelect={onSelect}
          onChange={(p, h) => updateAnnotation(anno.id, p as Partial<LineAnno>, h)} />;
      case 'pen':
        return <PenShape key={anno.id} anno={anno} selected={sel} onSelect={onSelect}
          onChange={(p, h) => updateAnnotation(anno.id, p as Partial<PenAnno>, h)} />;
      case 'highlight':
        return <HighlightShape key={anno.id} anno={anno} selected={sel} onSelect={onSelect}
          onChange={(p, h) => updateAnnotation(anno.id, p as Partial<HighlightAnno>, h)} />;
      case 'text':
        return <TextShape key={anno.id} anno={anno} selected={sel} editing={editingTextId === anno.id}
          onSelect={onSelect}
          onEdit={() => setEditingTextId(anno.id)}
          onChange={(p, h) => updateAnnotation(anno.id, p as Partial<TextAnno>, h)} />;
      case 'badge':
        return <BadgeShape key={anno.id} anno={anno} selected={sel} onSelect={onSelect}
          onChange={(p, h) => updateAnnotation(anno.id, p as Partial<BadgeAnno>, h)} />;
      case 'pixelate':
        if (!screenshot.imageEl) return null;
        return <PixelateShape key={anno.id} anno={anno} imageEl={screenshot.imageEl} selected={sel}
          onSelect={onSelect}
          onChange={(p, h) => updateAnnotation(anno.id, p as Partial<PixelateAnno>, h)} />;
      case 'loupe':
        if (!screenshot.imageEl) return null;
        return <LoupeShape key={anno.id} anno={anno} imageEl={screenshot.imageEl} selected={sel}
          onSelect={onSelect}
          onChange={(p, h) => updateAnnotation(anno.id, p as Partial<LoupeAnno>, h)} />;
      case 'spotlight':
        return <SpotlightShape key={anno.id} anno={anno}
          docW={screenshot.width} docH={screenshot.height}
          selected={sel} onSelect={onSelect}
          onChange={(p, h) => updateAnnotation(anno.id, p as Partial<SpotlightAnno>, h)} />;
      case 'image':
        return <ImageShape key={anno.id} anno={anno} selected={sel} onSelect={onSelect}
          onChange={(p, h) => updateAnnotation(anno.id, p as Partial<ImageAnno>, h)} />;
      default:
        return null;
    }
  }, [selectedId, activeTool, editingTextId, screenshot.imageEl, screenshot.width, screenshot.height, setSelectedId, setEditingTextId, updateAnnotation]);

  // ── Content-layer transform stack ──────────────────────────────────────────
  // Every content layer nests:  tilt ▸ crop-clip ▸ straighten ▸ nodes.
  // The crop clips in pre-tilt space (crop the screenshot, THEN lean the
  // device) and the straighten rotates the image beneath the upright crop
  // frame inside the clip. Transforms live on GROUPS, not layers, so the
  // backdrop panel can stay upright in the same bg layer. Each props object
  // spells out every transform key so toggling resets to identity (react-konva
  // only rewrites props that are present).
  //
  // The committed crop is a real Konva GROUP clip — unlike a LAYER clip, a
  // group's clip honors the stage zoom/pan, so the matte hack is gone. It uses
  // clipFunc (not clipX/Y/W/H) so a backdrop frame can round the screen
  // corners; the same path builder is shared with exportPng.
  const IDENTITY_XFORM = { rotation: 0, skewX: 0, skewY: 0, offsetX: 0, offsetY: 0, x: 0, y: 0 };
  // Tilt is suppressed while the crop tool is active: the crop frame lives in
  // document space and must map 1:1 onto image pixels while adjusting.
  const tilted = !!backdrop?.tilt && activeTool !== 'crop' && !!screenshot.imageEl;
  const tiltProps = tilted ? tiltLayerProps(contentRect) : IDENTITY_XFORM;
  const rotProps = cropRot
    ? { rotation: cropRot, skewX: 0, skewY: 0, offsetX: cropCx, offsetY: cropCy, x: cropCx, y: cropCy }
    : IDENTITY_XFORM;
  const clipFunc = cropApplied && cropRect
    ? cropClipFunc(cropRect, backdrop ? imageCornerRadius(backdrop, cropRect.width, cropRect.height) : 0)
    : undefined;

  // Interactive crop overlay: dim outside + rule-of-thirds + frame + 8 resize
  // handles + a rotate knob. Every node is visual only (listening=false) — the
  // pointer handlers do geometric hit-testing — so it is immune to the content
  // rotation above and renders at a constant on-screen size (÷ stage scale).
  // Hidden while dragging out a fresh region.
  const cropUI = activeTool === 'crop' && cropRect && !inProgress ? (() => {
    const sc = view.scale;
    const { x, y, width: w, height: h } = cropRect;
    const cx = x + w / 2, cy = y + h / 2;
    const BIG = 100000; // dim extends far past the page so the whole canvas darkens
    const hs = CROP_HANDLE_PX / sc, hh = hs / 2;
    const lw = 1 / sc;
    const rotDist = CROP_ROT_PX / sc, rotR = 5.5 / sc;
    const dimFill = 'rgba(0,0,0,0.5)';
    const handlePts: [number, number][] = [
      [x, y], [x + w, y], [x + w, y + h], [x, y + h],   // corners
      [cx, y], [x + w, cy], [cx, y + h], [x, cy],         // edge midpoints
    ];
    return (
      <>
        <Rect x={x - BIG} y={y - BIG} width={w + 2 * BIG} height={BIG} fill={dimFill} listening={false} />
        <Rect x={x - BIG} y={y + h} width={w + 2 * BIG} height={BIG} fill={dimFill} listening={false} />
        <Rect x={x - BIG} y={y} width={BIG} height={h} fill={dimFill} listening={false} />
        <Rect x={x + w} y={y} width={BIG} height={h} fill={dimFill} listening={false} />
        <Line points={[x + w / 3, y, x + w / 3, y + h]} stroke="rgba(255,255,255,0.35)" strokeWidth={lw} listening={false} />
        <Line points={[x + 2 * w / 3, y, x + 2 * w / 3, y + h]} stroke="rgba(255,255,255,0.35)" strokeWidth={lw} listening={false} />
        <Line points={[x, y + h / 3, x + w, y + h / 3]} stroke="rgba(255,255,255,0.35)" strokeWidth={lw} listening={false} />
        <Line points={[x, y + 2 * h / 3, x + w, y + 2 * h / 3]} stroke="rgba(255,255,255,0.35)" strokeWidth={lw} listening={false} />
        <Rect x={x} y={y} width={w} height={h} stroke="#fff" strokeWidth={lw * 1.5} listening={false} />
        <Line points={[cx, y, cx, y - rotDist]} stroke="#fff" strokeWidth={lw} listening={false} />
        <Circle x={cx} y={y - rotDist} radius={rotR} fill="#fff" listening={false} />
        {handlePts.map(([hx, hy], i) => (
          <Rect key={i} x={hx - hh} y={hy - hh} width={hs} height={hs}
            fill="#fff" stroke="rgba(0,0,0,0.45)" strokeWidth={lw} listening={false} />
        ))}
      </>
    );
  })() : null;

  // Crop preview when drawing crop
  const cropInProgressPreview = activeTool === 'crop' && inProgress?.type === 'rect' ? (
    <Rect
      x={(inProgress as { type: 'rect'; x: number; y: number; width: number; height: number }).x}
      y={(inProgress as { type: 'rect'; x: number; y: number; width: number; height: number }).y}
      width={(inProgress as { type: 'rect'; x: number; y: number; width: number; height: number }).width}
      height={(inProgress as { type: 'rect'; x: number; y: number; width: number; height: number }).height}
      stroke="white" strokeWidth={1} dash={[6, 3]} fill="rgba(255,255,255,0.05)" listening={false}
    />
  ) : null;

  const getCursor = () => {
    if (spaceDown.current || isPanning.current) return 'grabbing';
    if (ctrlDown && activeTool !== 'select') return 'default';
    if (activeTool === 'select') return 'default';
    if (activeTool === 'text') return 'text';
    if (activeTool === 'crop') return cropCursor;
    return 'crosshair';
  };

  // Design-tool dot grid that pans/zooms with the stage; hidden when zoomed
  // out far enough that the dots would alias into noise.
  const dotSpacing = 16 * view.scale;
  const dotGrid = dotSpacing >= 6
    ? {
        backgroundImage: 'radial-gradient(circle, #2e2e2e 1px, transparent 1px)',
        backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }
    : {};

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%', overflow: 'hidden',
      backgroundColor: '#181818', position: 'relative', ...dotGrid,
    }}>
      {!hasDoc && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', userSelect: 'none',
          pointerEvents: 'none',
        }}>
          {/* Card so the hint reads as a unit over the dot grid */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: '#1f1f1f', border: '1px solid #2e2e2e', borderRadius: 12,
            padding: '36px 56px', color: '#666',
            boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>✂️</div>
            <div style={{ fontSize: 18, color: '#888' }}>Take a snip with</div>
            <div style={{ fontSize: 22, color: '#aaa', marginTop: 4, fontWeight: 600 }}>Win + Shift + S</div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 14 }}>
              or paste (Ctrl+V) / drop an image file
            </div>
            {/* The card is pointerEvents:none; the button re-enables its own. */}
            <button
              onClick={() => newBoard()}
              style={{
                pointerEvents: 'auto', marginTop: 18, cursor: 'pointer',
                background: 'transparent', color: '#9b9b9b',
                border: '1px solid #3d3d3d', borderRadius: 6,
                padding: '7px 14px', fontSize: 13, fontWeight: 600,
              }}
            >
              or start a blank canvas <span style={{ opacity: 0.6 }}>Ctrl+N</span>
            </button>
          </div>
        </div>
      )}
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        style={{ cursor: getCursor() }}
      >
        {/* Layer 1: Backdrop (behind) + background image. Both are captured by
            toDataURL on export. The panel stays upright; the device chrome +
            crop-clipped image lean together inside the tilt group, and the
            straighten rotates the image inside the clip. */}
        <Layer listening={false}>
          {/* Board page fill (a board has no image). 'transparent' draws nothing
              so the dark editor / dot grid shows through and export keeps alpha. */}
          {isBoard && boardBackground !== 'transparent' && (
            <Rect
              x={contentBounds?.x ?? 0}
              y={contentBounds?.y ?? 0}
              width={contentBounds?.width ?? screenshot.width}
              height={contentBounds?.height ?? screenshot.height}
              fill={boardBackground!}
              listening={false}
            />
          )}
          {screenshot.imageEl && backdrop && (
            <BackdropPanel
              b={backdrop}
              bounds={contentBounds ?? backdropBounds(contentRect, backdrop)}
            />
          )}
          <Group listening={false} {...tiltProps}>
            {screenshot.imageEl && backdrop && (
              <BackdropChrome b={backdrop} content={contentRect} />
            )}
            <Group listening={false} name="crop-clip" clipFunc={clipFunc}>
              <Group listening={false} {...rotProps}>
                {screenshot.imageEl && (
                  <KonvaImage
                    image={screenshot.imageEl}
                    x={0} y={0}
                    width={screenshot.width}
                    height={screenshot.height}
                    cornerRadius={
                      backdrop && !cropApplied
                        ? imageCornerRadius(backdrop, screenshot.width, screenshot.height)
                        : 0 // a committed crop rounds at the clip path instead
                    }
                    listening={false}
                  />
                )}
              </Group>
            </Group>
          </Group>
        </Layer>

        {/* Layer 2: Annotations — only interactive with the select tool (or
            Ctrl held as a temporary move tool); otherwise strokes that start
            on top of a shape must draw, not drag it. */}
        <Layer listening={activeTool === 'select' || ctrlDown}>
          <Group {...tiltProps}>
            <Group name="crop-clip" clipFunc={clipFunc}>
              <Group name="draw-space" {...rotProps}>
                {annotations.map(renderAnnotation)}
              </Group>
            </Group>
          </Group>
        </Layer>

        {/* Layer 3: In-progress drawing. Carries the same straighten rotation as
            the content layers so previews track the cursor (coords are captured
            in the rotated space via getDrawPos). The crop draw-preview lives in
            the unrotated overlay layer instead — the crop frame is upright. */}
        <Layer listening={false}>
          <Group {...tiltProps}>
          <Group clipFunc={clipFunc}>
          <Group {...rotProps}>
          {inProgress && activeTool !== 'crop' && (
            <>
              {(inProgress.type === 'rect' || inProgress.type === 'loupe' || inProgress.type === 'spotlight') && (
                <Rect
                  x={(inProgress as { type: 'rect' | 'loupe' | 'spotlight'; x: number; y: number; width: number; height: number }).x}
                  y={(inProgress as { type: 'rect' | 'loupe' | 'spotlight'; x: number; y: number; width: number; height: number }).y}
                  width={(inProgress as { type: 'rect' | 'loupe' | 'spotlight'; x: number; y: number; width: number; height: number }).width}
                  height={(inProgress as { type: 'rect' | 'loupe' | 'spotlight'; x: number; y: number; width: number; height: number }).height}
                  stroke={strokeColor} strokeWidth={strokeWidth} fill="transparent"
                />
              )}
              {(inProgress.type === 'shape') && (() => {
                const ip = inProgress as { type: 'shape'; shape: ShapeKind; x: number; y: number; width: number; height: number };
                return (
                  <Line
                    x={ip.x} y={ip.y}
                    points={shapePoints(ip.shape, ip.width, ip.height)}
                    closed lineJoin="round"
                    stroke={strokeColor} strokeWidth={strokeWidth} fill="transparent"
                  />
                );
              })()}
              {(inProgress.type === 'pixelate') && screenshot.imageEl && (() => {
                const ip = inProgress as { type: 'pixelate'; x: number; y: number; width: number; height: number };
                if (ip.width <= 0 || ip.height <= 0) return null;
                const canvas = buildPixelateCanvas(screenshot.imageEl, ip, 12);
                return <KonvaImage image={canvas} x={ip.x} y={ip.y} width={ip.width} height={ip.height} />;
              })()}
              {(inProgress.type === 'ellipse') && (
                <Ellipse
                  x={(inProgress as { type: 'ellipse'; x: number; y: number; radiusX: number; radiusY: number }).x}
                  y={(inProgress as { type: 'ellipse'; x: number; y: number; radiusX: number; radiusY: number }).y}
                  radiusX={(inProgress as { type: 'ellipse'; x: number; y: number; radiusX: number; radiusY: number }).radiusX}
                  radiusY={(inProgress as { type: 'ellipse'; x: number; y: number; radiusX: number; radiusY: number }).radiusY}
                  stroke={strokeColor} strokeWidth={strokeWidth} fill="transparent"
                />
              )}
              {(inProgress.type === 'arrow') && (
                <Arrow
                  points={(inProgress as { type: 'arrow'; points: number[] }).points}
                  stroke={strokeColor} strokeWidth={strokeWidth} fill={strokeColor}
                  pointerLength={12} pointerWidth={10}
                />
              )}
              {(inProgress.type === 'line') && (
                <Line
                  points={(inProgress as { type: 'line'; points: number[] }).points}
                  stroke={strokeColor} strokeWidth={strokeWidth} lineCap="round" lineJoin="round"
                />
              )}
              {(inProgress.type === 'pen') && (
                <Line
                  points={(inProgress as { type: 'pen'; points: number[] }).points}
                  stroke={strokeColor} strokeWidth={strokeWidth} lineCap="round" lineJoin="round" tension={0.5}
                />
              )}
              {(inProgress.type === 'highlight') && (
                <Line
                  points={(inProgress as { type: 'highlight'; points: number[] }).points}
                  stroke="#ffe600" strokeWidth={strokeWidth * 4} opacity={0.45} lineCap="round" lineJoin="round" tension={0.5}
                />
              )}
            </>
          )}
          </Group>
          </Group>
          </Group>
        </Layer>

        {/* Layer 4: Overlay (crop + transformer) */}
        <Layer>
          {/* Guide outline for a transparent board so the page bounds are visible
              on the dark canvas. In this overlay layer, export hides it. */}
          {isBoard && boardBackground === 'transparent' && (
            <Rect
              x={0} y={0}
              width={screenshot.width}
              height={screenshot.height}
              stroke="rgba(255,255,255,0.15)" strokeWidth={1}
              listening={false}
            />
          )}
          {cropUI}
          {cropInProgressPreview}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            // Whole selection box is draggable — no need to grab the stroke itself
            shouldOverdrawWholeArea
            onTransformEnd={(e) => {
              const node = e.target as Konva.Node;
              const id = node.id();
              const anno = annotations.find((a) => a.id === id);
              if (anno) handleTransformEnd(anno, node);
            }}
          />
        </Layer>
      </Stage>

      {/* Text edit overlay */}
      {editingTextId && hasDoc && (() => {
        const textAnno = annotations.find((a) => a.id === editingTextId) as TextAnno | undefined;
        if (!textAnno) return null;
        // Anno coords live in the draw-space group; the HTML textarea needs the
        // stage-space point, so map forward through the transform stack in
        // render order: straighten first, then tilt (identity props are no-ops).
        const docPos = xformPoint(xformPoint({ x: textAnno.x, y: textAnno.y }, rotProps), tiltProps);
        return (
          <TextEditOverlay
            anno={textAnno}
            docPos={docPos}
            stageRef={stageRef}
            containerRef={containerRef}
            view={view}
            onCommit={(text) => {
              if (text.trim()) {
                updateAnnotation(editingTextId, { text: text.trim() }, true);
              } else {
                const store2 = useEditorStore.getState();
                store2.pushHistory();
                useEditorStore.setState({
                  annotations: store2.annotations.filter((a) => a.id !== editingTextId),
                });
              }
              setEditingTextId(null);
            }}
          />
        );
      })()}
    </div>
  );
}
