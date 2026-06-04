import { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Ellipse, Arrow, Line, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { nanoid } from 'nanoid';
import { useEditorStore } from '../store/editorStore';
import type { Annotation, RectAnno, EllipseAnno, ArrowAnno, LineAnno, PenAnno, HighlightAnno, TextAnno, BadgeAnno, PixelateAnno } from '../types/annotations';
import { RectShape } from './annotations/RectShape';
import { EllipseShape } from './annotations/EllipseShape';
import { ArrowShape } from './annotations/ArrowShape';
import { LineShape } from './annotations/LineShape';
import { PenShape } from './annotations/PenShape';
import { HighlightShape } from './annotations/HighlightShape';
import { TextShape } from './annotations/TextShape';
import { BadgeShape } from './annotations/BadgeShape';
import { PixelateShape } from './annotations/PixelateShape';
import { buildPixelateCanvas } from '../utils/buildPixelateCanvas';
import { TextEditOverlay } from './TextEditOverlay';

type InProgress =
  | { type: 'rect' | 'pixelate'; x: number; y: number; width: number; height: number }
  | { type: 'ellipse'; x: number; y: number; radiusX: number; radiusY: number }
  | { type: 'arrow' | 'line'; points: number[] }
  | { type: 'pen' | 'highlight'; points: number[] }
  | null;

export function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [inProgress, setInProgress] = useState<InProgress>(null);
  const isDrawing = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const spaceDown = useRef(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, stageX: 0, stageY: 0 });

  const store = useEditorStore();
  const {
    screenshot, annotations, selectedId, activeTool, strokeColor, strokeWidth, fontSize,
    nextBadge, editingTextId, view, cropRect, fitNonce,
    addAnnotation, updateAnnotation, setSelectedId, setEditingTextId,
    setView, setCropRect, setStageRef,
  } = store;

  // Register stage ref
  useEffect(() => {
    if (stageRef.current) setStageRef(stageRef.current);
    return () => setStageRef(null);
  }, [setStageRef]);

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

  // Fit to window on new screenshot, container resize, or explicit fit request (Ctrl+0 / Fit button)
  useEffect(() => {
    if (!screenshot.imageEl || containerSize.width === 0 || containerSize.height === 0) return;
    const scale = Math.min(
      containerSize.width / screenshot.width,
      containerSize.height / screenshot.height,
      1
    );
    const x = (containerSize.width - screenshot.width * scale) / 2;
    const y = (containerSize.height - screenshot.height * scale) / 2;
    setView({ scale, x, y });
  }, [screenshot.url, containerSize.width, containerSize.height, fitNonce]);

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

    const pos = getPointerPos();
    dragStartPos.current = pos;

    if (activeTool === 'select') {
      const target = e.target;
      if (target === stage) {
        setSelectedId(null);
      }
      return;
    }

    if (activeTool === 'text') {
      const id = nanoid();
      const anno: TextAnno = {
        id, type: 'text',
        x: pos.x, y: pos.y,
        text: 'Text',
        fontSize,
        fill: strokeColor,
      };
      addAnnotation(anno);
      setEditingTextId(id);
      return;
    }

    if (activeTool === 'badge') {
      const anno: BadgeAnno = {
        id: nanoid(), type: 'badge',
        x: pos.x, y: pos.y,
        number: nextBadge,
        fill: strokeColor,
        radius: 16,
      };
      addAnnotation(anno);
      setSelectedId(anno.id);
      return;
    }

    isDrawing.current = true;
    setSelectedId(null); // starting a new draw drops any prior selection

    if (activeTool === 'rect' || activeTool === 'pixelate') {
      setInProgress({ type: activeTool, x: pos.x, y: pos.y, width: 0, height: 0 });
    } else if (activeTool === 'ellipse') {
      setInProgress({ type: 'ellipse', x: pos.x, y: pos.y, radiusX: 0, radiusY: 0 });
    } else if (activeTool === 'arrow' || activeTool === 'line') {
      setInProgress({ type: activeTool, points: [pos.x, pos.y, pos.x, pos.y] });
    } else if (activeTool === 'pen' || activeTool === 'highlight') {
      setInProgress({ type: activeTool, points: [pos.x, pos.y] });
    } else if (activeTool === 'crop') {
      setInProgress({ type: 'rect', x: pos.x, y: pos.y, width: 0, height: 0 });
    }
  }, [activeTool, view, strokeColor, fontSize, nextBadge, addAnnotation, setSelectedId, setEditingTextId, getPointerPos]);

  const handlePointerMove = useCallback((e: KonvaEventObject<PointerEvent>) => {
    if (isPanning.current) {
      const dx = e.evt.clientX - panStart.current.x;
      const dy = e.evt.clientY - panStart.current.y;
      setView({ x: panStart.current.stageX + dx, y: panStart.current.stageY + dy });
      return;
    }

    if (!isDrawing.current || !inProgress) return;
    const pos = getPointerPos();

    if (inProgress.type === 'rect' || inProgress.type === 'pixelate') {
      setInProgress({
        type: inProgress.type,
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
  }, [inProgress, getPointerPos, setView]);

  const handlePointerUp = useCallback(() => {
    if (isPanning.current) { isPanning.current = false; return; }
    if (!isDrawing.current || !inProgress) return;
    isDrawing.current = false;

    if (activeTool === 'crop' && inProgress.type === 'rect' && inProgress.width > 5 && inProgress.height > 5) {
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
      } satisfies RectAnno;
    } else if (activeTool === 'ellipse' && inProgress.type === 'ellipse' && inProgress.radiusX > 1) {
      committed = {
        id: nanoid(), type: 'ellipse',
        x: inProgress.x, y: inProgress.y,
        radiusX: inProgress.radiusX, radiusY: inProgress.radiusY,
        stroke: strokeColor, strokeWidth,
      } satisfies EllipseAnno;
    } else if (activeTool === 'arrow' && inProgress.type === 'arrow') {
      committed = {
        id: nanoid(), type: 'arrow',
        points: inProgress.points,
        stroke: strokeColor, strokeWidth,
      } satisfies ArrowAnno;
    } else if (activeTool === 'line' && inProgress.type === 'line') {
      committed = {
        id: nanoid(), type: 'line',
        points: inProgress.points,
        stroke: strokeColor, strokeWidth,
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
    }
    if (committed) {
      addAnnotation(committed);
      // Auto-select so Delete / transform / properties apply immediately
      setSelectedId(committed.id);
    }
    setInProgress(null);
  }, [activeTool, inProgress, strokeColor, strokeWidth, addAnnotation, setCropRect, setSelectedId]);

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

  // Space key for panning + Esc cancels an in-progress draw
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = true;
      if (e.key === 'Escape' && isDrawing.current) {
        isDrawing.current = false;
        setInProgress(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceDown.current = false; isPanning.current = false; }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleTransformEnd = useCallback((anno: Annotation, node: Konva.Node) => {
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    if (anno.type === 'rect' || anno.type === 'pixelate') {
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
    } else if (anno.type === 'arrow' || anno.type === 'line' || anno.type === 'pen' || anno.type === 'highlight') {
      const a = anno as ArrowAnno | LineAnno | PenAnno | HighlightAnno;
      const nx = node.x();
      const ny = node.y();
      node.position({ x: 0, y: 0 });
      updateAnnotation(anno.id, {
        points: a.points.map((v, i) => (i % 2 === 0 ? v * sx + nx : v * sy + ny)),
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
      default:
        return null;
    }
  }, [selectedId, activeTool, editingTextId, screenshot.imageEl, setSelectedId, setEditingTextId, updateAnnotation]);

  const imgWidth = screenshot.width;
  const imgHeight = screenshot.height;

  // Crop overlay pieces
  const cropOverlay = cropRect && activeTool === 'crop' ? (
    <>
      {/* top */}
      <Rect x={0} y={0} width={imgWidth} height={cropRect.y} fill="rgba(0,0,0,0.5)" listening={false} />
      {/* bottom */}
      <Rect x={0} y={cropRect.y + cropRect.height} width={imgWidth} height={imgHeight - cropRect.y - cropRect.height} fill="rgba(0,0,0,0.5)" listening={false} />
      {/* left */}
      <Rect x={0} y={cropRect.y} width={cropRect.x} height={cropRect.height} fill="rgba(0,0,0,0.5)" listening={false} />
      {/* right */}
      <Rect x={cropRect.x + cropRect.width} y={cropRect.y} width={imgWidth - cropRect.x - cropRect.width} height={cropRect.height} fill="rgba(0,0,0,0.5)" listening={false} />
      {/* dashed border */}
      <Rect
        x={cropRect.x} y={cropRect.y} width={cropRect.width} height={cropRect.height}
        stroke="white" strokeWidth={1} dash={[6, 3]} fill="transparent" listening={false}
      />
    </>
  ) : null;

  // Subtle reminder that a crop is set while using other tools (export will trim to it)
  const cropIndicator = cropRect && activeTool !== 'crop' ? (
    <Rect
      x={cropRect.x} y={cropRect.y} width={cropRect.width} height={cropRect.height}
      stroke="rgba(255,255,255,0.5)" strokeWidth={1} dash={[4, 4]} fill="transparent" listening={false}
    />
  ) : null;

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
    if (activeTool === 'select') return 'default';
    if (activeTool === 'text') return 'text';
    if (activeTool === 'crop') return 'crosshair';
    return 'crosshair';
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#181818', position: 'relative' }}>
      {!screenshot.imageEl && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: '#666', userSelect: 'none',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>✂️</div>
          <div style={{ fontSize: 18, color: '#888' }}>Take a snip with</div>
          <div style={{ fontSize: 22, color: '#aaa', marginTop: 4, fontWeight: 600 }}>Win + Shift + S</div>
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
        {/* Layer 1: Background image */}
        <Layer listening={false}>
          {screenshot.imageEl && (
            <KonvaImage
              image={screenshot.imageEl}
              x={0} y={0}
              width={screenshot.width}
              height={screenshot.height}
              listening={false}
            />
          )}
        </Layer>

        {/* Layer 2: Annotations */}
        <Layer>
          {annotations.map(renderAnnotation)}
        </Layer>

        {/* Layer 3: In-progress drawing */}
        <Layer listening={false}>
          {inProgress && activeTool !== 'crop' && (
            <>
              {(inProgress.type === 'rect') && (
                <Rect
                  x={(inProgress as { type: 'rect'; x: number; y: number; width: number; height: number }).x}
                  y={(inProgress as { type: 'rect'; x: number; y: number; width: number; height: number }).y}
                  width={(inProgress as { type: 'rect'; x: number; y: number; width: number; height: number }).width}
                  height={(inProgress as { type: 'rect'; x: number; y: number; width: number; height: number }).height}
                  stroke={strokeColor} strokeWidth={strokeWidth} fill="transparent"
                />
              )}
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
          {cropInProgressPreview}
        </Layer>

        {/* Layer 4: Overlay (crop + transformer) */}
        <Layer>
          {cropOverlay}
          {cropIndicator}
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
      {editingTextId && screenshot.imageEl && (() => {
        const textAnno = annotations.find((a) => a.id === editingTextId) as TextAnno | undefined;
        if (!textAnno) return null;
        return (
          <TextEditOverlay
            anno={textAnno}
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
            onCancel={() => {
              // If brand new (empty text), delete it
              if (!textAnno.text.trim()) {
                const store2 = useEditorStore.getState();
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
