import { useEffect, useMemo, useRef, useState, type MouseEventHandler, type WheelEventHandler } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Arrow, Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { createId, normalizeRect, type Annotation, type AnnotationGeometry } from '@marker/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/locale';
import { useLoadedImage } from '@/lib/useLoadedImage';
import { useEditorStore } from '@/lib/useEditorStore';

const DOCUMENT_WIDTH = 960;
const DOCUMENT_HEIGHT = 560;
const WORKSPACE_WIDTH = 2800;
const WORKSPACE_HEIGHT = 1800;
const GRID_SIZE = 40;
const MAJOR_GRID_SIZE = 200;
const MINI_MAP_WIDTH = 176;
const MAX_ZOOM = 6;
const PADDING = 0;

const fitImage = (imageWidth: number, imageHeight: number, maxWidth: number, maxHeight: number) => {
  const availableWidth = maxWidth - PADDING * 2;
  const availableHeight = maxHeight - PADDING * 2;
  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: (maxWidth - width) / 2,
    y: (maxHeight - height) / 2,
    width,
    height,
  };
};

const getDefaultStyle = (tool: Annotation['tool']) =>
  tool === 'highlight'
    ? { stroke: '#f59e0b', fill: 'rgba(251,191,36,0.25)', strokeWidth: 3 }
    : tool === 'blur'
      ? { stroke: '#0f172a', fill: 'rgba(15,23,42,0.45)', strokeWidth: 2 }
      : tool === 'arrow'
        ? { stroke: '#2563eb', strokeWidth: 4 }
        : tool === 'marker'
          ? { stroke: '#2563eb', fill: '#2563eb', strokeWidth: 2 }
          : tool === 'text'
            ? { stroke: '#2563eb', fill: 'rgba(255,255,255,0.95)', strokeWidth: 2 }
            : { stroke: '#ef4444', fill: 'rgba(239,68,68,0.08)', strokeWidth: 3 };

const buildAnnotation = (
  tool: Annotation['tool'],
  geometry: AnnotationGeometry,
  assetId: string,
  index: number,
): Annotation => ({
  id: createId('annotation'),
  assetId,
  tool,
  geometry,
  label: tool === 'marker' ? String(index) : tool === 'text' ? `Text ${index}` : undefined,
  style: getDefaultStyle(tool),
  createdAt: new Date().toISOString(),
});

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function AnnotationCanvas({
  readOnly = false,
  onExportReady,
}: {
  readOnly?: boolean;
  onExportReady?: (exporter: () => string | undefined) => void;
}) {
  const { messages } = useLocale();
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const hasInitializedViewRef = useRef(false);
  const draft = useEditorStore((state) => state.draft);
  const activeTool = useEditorStore((state) => state.activeTool);
  const selectedAnnotationId = useEditorStore((state) => state.selectedAnnotationId);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const addAnnotation = useEditorStore((state) => state.addAnnotation);
  const updateAnnotation = useEditorStore((state) => state.updateAnnotation);
  const setAssetPosition = useEditorStore((state) => state.setAssetPosition);
  const setSelectedAnnotation = useEditorStore((state) => state.setSelectedAnnotation);
  const image = useLoadedImage(draft.asset?.imageDataUrl);
  const [viewportSize, setViewportSize] = useState({ width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<Annotation | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [assetDragOffset, setAssetDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [scrollPosition, setScrollPosition] = useState({ left: 0, top: 0 });
  const documentOrigin = useMemo(
    () => ({
      x: (WORKSPACE_WIDTH - DOCUMENT_WIDTH) / 2,
      y: (WORKSPACE_HEIGHT - DOCUMENT_HEIGHT) / 2,
    }),
    [],
  );
  const imageBounds = useMemo(
    () =>
      draft.asset
        ? fitImage(draft.asset.width, draft.asset.height, DOCUMENT_WIDTH, DOCUMENT_HEIGHT)
        : null,
    [draft.asset],
  );
  const documentPosition = useMemo(
    () => ({
      x: draft.asset?.x ?? documentOrigin.x,
      y: draft.asset?.y ?? documentOrigin.y,
    }),
    [documentOrigin.x, documentOrigin.y, draft.asset?.x, draft.asset?.y],
  );
  const renderedDocumentPosition = useMemo(
    () => ({
      x: documentPosition.x + (assetDragOffset?.x ?? 0),
      y: documentPosition.y + (assetDragOffset?.y ?? 0),
    }),
    [assetDragOffset?.x, assetDragOffset?.y, documentPosition.x, documentPosition.y],
  );
  const fitScale = useMemo(
    () =>
      Math.min(
        1,
        viewportSize.width / DOCUMENT_WIDTH,
        viewportSize.height / DOCUMENT_HEIGHT,
      ),
    [viewportSize.height, viewportSize.width],
  );
  const canvasScale = useMemo(() => fitScale * zoom, [fitScale, zoom]);
  const viewportHeight = useMemo(
    () => Math.max(320, viewportSize.height),
    [viewportSize.height],
  );
  const scaledWorkspaceWidth = useMemo(() => Math.round(WORKSPACE_WIDTH * canvasScale), [canvasScale]);
  const scaledWorkspaceHeight = useMemo(() => Math.round(WORKSPACE_HEIGHT * canvasScale), [canvasScale]);
  const miniMapHeight = useMemo(
    () => Math.round((MINI_MAP_WIDTH * WORKSPACE_HEIGHT) / WORKSPACE_WIDTH),
    [],
  );
  const stageWidth = useMemo(
    () => Math.max(viewportSize.width, scaledWorkspaceWidth),
    [scaledWorkspaceWidth, viewportSize.width],
  );
  const stageHeight = useMemo(
    () => Math.max(viewportHeight, scaledWorkspaceHeight),
    [scaledWorkspaceHeight, viewportHeight],
  );
  const layerOffsetX = useMemo(
    () => Math.max(0, (stageWidth - scaledWorkspaceWidth) / 2),
    [scaledWorkspaceWidth, stageWidth],
  );
  const layerOffsetY = useMemo(
    () => Math.max(0, (stageHeight - scaledWorkspaceHeight) / 2),
    [scaledWorkspaceHeight, stageHeight],
  );
  const pendingScrollRef = useRef<{ left: number; top: number } | null>(null);
  const spacePressedRef = useRef(false);
  const didPanRef = useRef(false);
  const panStateRef = useRef<{
    active: boolean;
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
  }>({
    active: false,
    startClientX: 0,
    startClientY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
  });

  useEffect(() => {
    const element = viewportRef.current;

    if (!element) {
      return undefined;
    }

    const updateWidth = () => {
      setViewportSize({
        width: Math.max(element.clientWidth, 320),
        height: Math.max(element.clientHeight, 320),
      });
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    hasInitializedViewRef.current = false;
    setAssetDragOffset(null);
  }, [draft.asset?.id]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (viewport && pendingScrollRef.current) {
      viewport.scrollLeft = pendingScrollRef.current.left;
      viewport.scrollTop = pendingScrollRef.current.top;
      setScrollPosition({
        left: pendingScrollRef.current.left,
        top: pendingScrollRef.current.top,
      });
      pendingScrollRef.current = null;
    }
  }, [stageHeight, stageWidth]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport || !draft.asset || hasInitializedViewRef.current) {
      return;
    }

    viewport.scrollLeft = Math.max(0, (stageWidth - viewport.clientWidth) / 2);
    viewport.scrollTop = Math.max(0, (stageHeight - viewport.clientHeight) / 2);
    setScrollPosition({ left: viewport.scrollLeft, top: viewport.scrollTop });
    hasInitializedViewRef.current = true;
  }, [draft.asset, stageHeight, stageWidth]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      spacePressedRef.current = true;
      setIsSpacePressed(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }

      if (!isEditableTarget(event.target)) {
        event.preventDefault();
      }

      spacePressedRef.current = false;
      setIsSpacePressed(false);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const viewport = viewportRef.current;

      if (!viewport || !panStateRef.current.active) {
        return;
      }

      const deltaX = event.clientX - panStateRef.current.startClientX;
      const deltaY = event.clientY - panStateRef.current.startClientY;

      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        didPanRef.current = true;
      }

      viewport.scrollLeft = panStateRef.current.startScrollLeft - deltaX;
      viewport.scrollTop = panStateRef.current.startScrollTop - deltaY;
    };

    const stopPanning = () => {
      if (!panStateRef.current.active) {
        return;
      }

      panStateRef.current.active = false;
      setIsPanning(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopPanning);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopPanning);
    };
  }, []);

  useEffect(() => {
    onExportReady?.(() =>
      stageRef.current?.toDataURL({
        x: layerOffsetX + documentPosition.x * canvasScale,
        y: layerOffsetY + documentPosition.y * canvasScale,
        width: DOCUMENT_WIDTH * canvasScale,
        height: DOCUMENT_HEIGHT * canvasScale,
        pixelRatio: canvasScale > 0 ? 2 / canvasScale : 2,
      }),
    );
  }, [canvasScale, documentPosition.x, documentPosition.y, layerOffsetX, layerOffsetY, onExportReady]);

  const getPointer = (restrictToDocument = false) => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();

    if (!pointer) {
      return null;
    }

    const logicalPoint = {
      x: (pointer.x - layerOffsetX) / canvasScale,
      y: (pointer.y - layerOffsetY) / canvasScale,
    };

    if (
      logicalPoint.x < 0 ||
      logicalPoint.y < 0 ||
      logicalPoint.x > WORKSPACE_WIDTH ||
      logicalPoint.y > WORKSPACE_HEIGHT
    ) {
      return null;
    }

    if (!restrictToDocument) {
      return logicalPoint;
    }

    const localPoint = {
      x: logicalPoint.x - renderedDocumentPosition.x,
      y: logicalPoint.y - renderedDocumentPosition.y,
    };

    if (
      localPoint.x < 0 ||
      localPoint.y < 0 ||
      localPoint.x > DOCUMENT_WIDTH ||
      localPoint.y > DOCUMENT_HEIGHT
    ) {
      return null;
    }

    return localPoint;
  };

  const markerCount = draft.annotations.filter((annotation) => annotation.tool === 'marker').length + 1;

  const startPanning = (clientX: number, clientY: number) => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    panStateRef.current = {
      active: true,
      startClientX: clientX,
      startClientY: clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop,
    };
    didPanRef.current = false;
    setIsPanning(true);
  };

  const handleMouseDownCapture: MouseEventHandler<HTMLDivElement> = (event) => {
    const shouldPan = event.button === 1 || (spacePressedRef.current && event.button === 0);

    if (!shouldPan) {
      return;
    }

    event.preventDefault();
    startPanning(event.clientX, event.clientY);
  };

  const handleWheel: WheelEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();

    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const direction = event.deltaY < 0 ? 1 : -1;
    const nextZoom = Math.max(0.5, Math.min(MAX_ZOOM, Number((zoom + direction * 0.1).toFixed(2))));

    if (nextZoom === zoom) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const pointerX = viewport.scrollLeft + event.clientX - rect.left;
    const pointerY = viewport.scrollTop + event.clientY - rect.top;
    const logicalX = (pointerX - layerOffsetX) / canvasScale;
    const logicalY = (pointerY - layerOffsetY) / canvasScale;
    const nextCanvasScale = fitScale * nextZoom;
    const nextScaledWorkspaceWidth = Math.round(WORKSPACE_WIDTH * nextCanvasScale);
    const nextScaledWorkspaceHeight = Math.round(WORKSPACE_HEIGHT * nextCanvasScale);
    const nextStageWidth = Math.max(viewportSize.width, nextScaledWorkspaceWidth);
    const nextStageHeight = Math.max(viewportHeight, nextScaledWorkspaceHeight);
    const nextLayerOffsetX = Math.max(0, (nextStageWidth - nextScaledWorkspaceWidth) / 2);
    const nextLayerOffsetY = Math.max(0, (nextStageHeight - nextScaledWorkspaceHeight) / 2);

    pendingScrollRef.current = {
      left: Math.max(0, logicalX * nextCanvasScale + nextLayerOffsetX - (event.clientX - rect.left)),
      top: Math.max(0, logicalY * nextCanvasScale + nextLayerOffsetY - (event.clientY - rect.top)),
    };

    setZoom(nextZoom);
  };

  const handleStageMouseDown = (event: KonvaEventObject<MouseEvent>) => {
    if (
      readOnly ||
      !draft.asset ||
      panStateRef.current.active ||
      spacePressedRef.current
    ) {
      return;
    }

    const target = event.target;
    const clickedStage = target === target.getStage();

    if (activeTool === 'select' && event.evt.button === 0 && clickedStage) {
      event.evt.preventDefault();
      startPanning(event.evt.clientX, event.evt.clientY);
      setPreview(null);
      setDragStart(null);
      return;
    }

    const pointer = getPointer(true);

    if (!pointer) {
      return;
    }

    if (activeTool === 'select') {
      setPreview(null);
      return;
    }

    if (activeTool === 'marker') {
      addAnnotation(
        buildAnnotation('marker', { kind: 'marker', x: pointer.x, y: pointer.y }, draft.asset.id, markerCount),
      );
      return;
    }

    if (activeTool === 'text') {
      const body = window.prompt(
        messages.annotation.textPromptTitle,
        messages.annotation.textPromptDefault,
      );

      if (!body) {
        return;
      }

      addAnnotation({
        ...buildAnnotation(
          'text',
          { kind: 'text', x: pointer.x, y: pointer.y, width: 180, height: 72 },
          draft.asset.id,
          draft.annotations.length + 1,
        ),
        label: body,
      });
      return;
    }

    setDragStart(pointer);
  };

  const setViewportCenter = (nextZoom: number) => {
    const viewport = viewportRef.current;

    if (!viewport) {
      setZoom(nextZoom);
      return;
    }

    const nextCanvasScale = fitScale * nextZoom;
    const nextScaledWorkspaceWidth = Math.round(WORKSPACE_WIDTH * nextCanvasScale);
    const nextScaledWorkspaceHeight = Math.round(WORKSPACE_HEIGHT * nextCanvasScale);
    const nextStageWidth = Math.max(viewportSize.width, nextScaledWorkspaceWidth);
    const nextStageHeight = Math.max(viewportHeight, nextScaledWorkspaceHeight);
    const nextLayerOffsetX = Math.max(0, (nextStageWidth - nextScaledWorkspaceWidth) / 2);
    const nextLayerOffsetY = Math.max(0, (nextStageHeight - nextScaledWorkspaceHeight) / 2);
    const targetLeft =
      renderedDocumentPosition.x * nextCanvasScale +
      (DOCUMENT_WIDTH * nextCanvasScale) / 2 +
      nextLayerOffsetX -
      viewport.clientWidth / 2;
    const targetTop =
      renderedDocumentPosition.y * nextCanvasScale +
      (DOCUMENT_HEIGHT * nextCanvasScale) / 2 +
      nextLayerOffsetY -
      viewport.clientHeight / 2;

    pendingScrollRef.current = {
      left: Math.max(0, targetLeft),
      top: Math.max(0, targetTop),
    };

    if (nextZoom === zoom) {
      viewport.scrollLeft = pendingScrollRef.current.left;
      viewport.scrollTop = pendingScrollRef.current.top;
      setScrollPosition({
        left: pendingScrollRef.current.left,
        top: pendingScrollRef.current.top,
      });
      pendingScrollRef.current = null;
      return;
    }

    setZoom(nextZoom);
  };

  const commitPreview = () => {
    if (panStateRef.current.active || isPanning) {
      return;
    }

    if (preview) {
      addAnnotation(preview);
    }

    setPreview(null);
    setDragStart(null);
  };
  const updatePreview = () => {
    if (
      !dragStart ||
      readOnly ||
      !draft.asset ||
      panStateRef.current.active ||
      activeTool === 'select' ||
      activeTool === 'text' ||
      activeTool === 'marker'
    ) {
      return;
    }

    const pointer = getPointer(true);

    if (!pointer) {
      return;
    }

    const geometry =
      activeTool === 'arrow'
        ? {
            kind: 'arrow' as const,
            points: [dragStart.x, dragStart.y, pointer.x, pointer.y] as [number, number, number, number],
          }
        : normalizeRect({ x1: dragStart.x, y1: dragStart.y, x2: pointer.x, y2: pointer.y });

    setPreview(
      buildAnnotation(activeTool as Annotation['tool'], geometry, draft.asset.id, draft.annotations.length + 1),
    );
  };

  const renderAnnotation = (annotation: Annotation, isPreview = false) => {
    const selected = annotation.id === selectedAnnotationId;
    const geometry = annotation.geometry;

    switch (annotation.tool) {
      case 'rectangle':
      case 'highlight':
      case 'blur': {
        if (geometry.kind !== 'rect') {
          return null;
        }

        return (
          <Group
            key={annotation.id}
            x={renderedDocumentPosition.x + geometry.x}
            y={renderedDocumentPosition.y + geometry.y}
            draggable={!readOnly && activeTool === 'select' && !isPreview}
            onClick={() => setSelectedAnnotation(annotation.id)}
            onTap={() => setSelectedAnnotation(annotation.id)}
            onDragEnd={(event) => {
              const pos = event.target.position();
              updateAnnotation(annotation.id, (current) => {
                if (current.geometry.kind === 'rect') {
                  current.geometry = {
                    ...current.geometry,
                    x: pos.x - renderedDocumentPosition.x,
                    y: pos.y - renderedDocumentPosition.y,
                  };
                }
              });
            }}
          >
            <Rect
              width={geometry.width}
              height={geometry.height}
              stroke={annotation.style.stroke}
              strokeWidth={annotation.style.strokeWidth ?? 2}
              fill={annotation.style.fill}
              dash={selected ? [8, 6] : undefined}
              cornerRadius={8}
            />
          </Group>
        );
      }

      case 'arrow': {
        if (geometry.kind !== 'arrow') {
          return null;
        }

        return (
          <Arrow
            key={annotation.id}
            points={geometry.points}
            x={renderedDocumentPosition.x}
            y={renderedDocumentPosition.y}
            stroke={annotation.style.stroke}
            fill={annotation.style.stroke}
            pointerLength={10}
            pointerWidth={10}
            strokeWidth={annotation.style.strokeWidth ?? 4}
            onClick={() => setSelectedAnnotation(annotation.id)}
            onTap={() => setSelectedAnnotation(annotation.id)}
            dash={selected ? [8, 6] : undefined}
          />
        );
      }

      case 'marker': {
        if (geometry.kind !== 'marker') {
          return null;
        }

        return (
          <Group
            key={annotation.id}
            x={renderedDocumentPosition.x + geometry.x}
            y={renderedDocumentPosition.y + geometry.y}
            draggable={!readOnly && activeTool === 'select' && !isPreview}
            onClick={() => setSelectedAnnotation(annotation.id)}
            onTap={() => setSelectedAnnotation(annotation.id)}
            onDragEnd={(event) => {
              const pos = event.target.position();
              updateAnnotation(annotation.id, (current) => {
                if (current.geometry.kind === 'marker') {
                  current.geometry = {
                    ...current.geometry,
                    x: pos.x - renderedDocumentPosition.x,
                    y: pos.y - renderedDocumentPosition.y,
                  };
                }
              });
            }}
          >
            <Circle radius={16} fill="#2563eb" stroke={selected ? '#0f172a' : '#ffffff'} strokeWidth={selected ? 3 : 2} />
            <Text text={annotation.label ?? ''} x={-6} y={-8} fontStyle="bold" fill="#ffffff" />
          </Group>
        );
      }

      case 'text': {
        if (geometry.kind !== 'text') {
          return null;
        }

        return (
          <Group
            key={annotation.id}
            x={renderedDocumentPosition.x + geometry.x}
            y={renderedDocumentPosition.y + geometry.y}
            draggable={!readOnly && activeTool === 'select' && !isPreview}
            onClick={() => setSelectedAnnotation(annotation.id)}
            onTap={() => setSelectedAnnotation(annotation.id)}
            onDragEnd={(event) => {
              const pos = event.target.position();
              updateAnnotation(annotation.id, (current) => {
                if (current.geometry.kind === 'text') {
                  current.geometry = {
                    ...current.geometry,
                    x: pos.x - renderedDocumentPosition.x,
                    y: pos.y - renderedDocumentPosition.y,
                  };
                }
              });
            }}
          >
            <Rect
              width={geometry.width}
              height={geometry.height}
              fill={annotation.style.fill}
              stroke={annotation.style.stroke}
              strokeWidth={annotation.style.strokeWidth ?? 2}
              cornerRadius={10}
              dash={selected ? [8, 6] : undefined}
            />
            <Text text={annotation.label ?? ''} x={12} y={12} width={geometry.width - 24} fill="#0f172a" fontSize={14} />
          </Group>
        );
      }

      default:
        return null;
    }
  };

  const gridLines = useMemo(() => {
    const lines: { key: string; points: number[]; stroke: string; strokeWidth: number }[] = [];

    for (let x = 0; x <= WORKSPACE_WIDTH; x += GRID_SIZE) {
      const isMajor = x % MAJOR_GRID_SIZE === 0;
      lines.push({
        key: `grid-v-${x}`,
        points: [x, 0, x, WORKSPACE_HEIGHT],
        stroke: isMajor ? '#cbd5e1' : '#e2e8f0',
        strokeWidth: isMajor ? 1.2 : 1,
      });
    }

    for (let y = 0; y <= WORKSPACE_HEIGHT; y += GRID_SIZE) {
      const isMajor = y % MAJOR_GRID_SIZE === 0;
      lines.push({
        key: `grid-h-${y}`,
        points: [0, y, WORKSPACE_WIDTH, y],
        stroke: isMajor ? '#cbd5e1' : '#e2e8f0',
        strokeWidth: isMajor ? 1.2 : 1,
      });
    }

    return lines;
  }, []);

  const actualSizeZoom = useMemo(() => {
    if (!draft.asset || !imageBounds || !fitScale) {
      return 1;
    }

    const naturalRatio = Math.max(
      draft.asset.width / imageBounds.width,
      draft.asset.height / imageBounds.height,
    );

    return Math.max(0.5, Math.min(MAX_ZOOM, Number((naturalRatio / fitScale).toFixed(2))));
  }, [draft.asset, fitScale, imageBounds]);

  const documentMiniMapRect = useMemo(
    () => ({
      x: (renderedDocumentPosition.x / WORKSPACE_WIDTH) * MINI_MAP_WIDTH,
      y: (renderedDocumentPosition.y / WORKSPACE_HEIGHT) * miniMapHeight,
      width: (DOCUMENT_WIDTH / WORKSPACE_WIDTH) * MINI_MAP_WIDTH,
      height: (DOCUMENT_HEIGHT / WORKSPACE_HEIGHT) * miniMapHeight,
    }),
    [miniMapHeight, renderedDocumentPosition.x, renderedDocumentPosition.y],
  );

  const viewportMiniMapRect = useMemo(() => {
    const visibleLeft = Math.max(0, (scrollPosition.left - layerOffsetX) / canvasScale);
    const visibleTop = Math.max(0, (scrollPosition.top - layerOffsetY) / canvasScale);
    const visibleWidth = Math.min(WORKSPACE_WIDTH, viewportSize.width / canvasScale);
    const visibleHeight = Math.min(viewportHeight / canvasScale, WORKSPACE_HEIGHT);

    return {
      x: (visibleLeft / WORKSPACE_WIDTH) * MINI_MAP_WIDTH,
      y: (visibleTop / WORKSPACE_HEIGHT) * miniMapHeight,
      width: (visibleWidth / WORKSPACE_WIDTH) * MINI_MAP_WIDTH,
      height: (visibleHeight / WORKSPACE_HEIGHT) * miniMapHeight,
    };
  }, [canvasScale, layerOffsetX, layerOffsetY, miniMapHeight, scrollPosition.left, scrollPosition.top, viewportHeight, viewportSize.width]);

  return (
    <Card className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden p-4">
      <div className="relative min-h-[320px] flex-1">
        <div
          ref={viewportRef}
          className={cn(
            'canvas-scrollbar min-h-[320px] h-full overflow-auto rounded-2xl bg-white',
            isPanning
              ? 'cursor-grabbing'
              : isSpacePressed
                ? 'cursor-grab'
                : activeTool === 'select'
                  ? 'cursor-grab'
                : 'cursor-default',
          )}
          onScroll={(event) =>
            setScrollPosition({
              left: event.currentTarget.scrollLeft,
              top: event.currentTarget.scrollTop,
            })
          }
          onMouseDownCapture={handleMouseDownCapture}
          onWheel={handleWheel}
        >
          <Stage
            ref={stageRef}
            width={stageWidth}
            height={stageHeight}
            className="rounded-2xl"
            onMouseDown={handleStageMouseDown}
            onMouseMove={updatePreview}
            onMouseUp={commitPreview}
            onClick={(event) => {
              if (didPanRef.current) {
                didPanRef.current = false;
                return;
              }

              if (event.target === event.target.getStage()) {
                setSelectedAnnotation(null);
              }
            }}
          >
            <Layer x={layerOffsetX} y={layerOffsetY} scaleX={canvasScale} scaleY={canvasScale}>
              {gridLines.map((line) => (
                <Line
                  key={line.key}
                  points={line.points}
                  stroke={line.stroke}
                  strokeWidth={line.strokeWidth}
                  listening={false}
                />
              ))}
              <Group
                x={renderedDocumentPosition.x}
                y={renderedDocumentPosition.y}
                draggable={!readOnly && activeTool === 'select'}
                dragBoundFunc={(position) => ({
                  x: clamp(position.x, 0, WORKSPACE_WIDTH - DOCUMENT_WIDTH),
                  y: clamp(position.y, 0, WORKSPACE_HEIGHT - DOCUMENT_HEIGHT),
                })}
                onDragMove={(event) => {
                  const position = event.target.position();
                  setAssetDragOffset({
                    x: position.x - documentPosition.x,
                    y: position.y - documentPosition.y,
                  });
                }}
                onDragEnd={(event) => {
                  const position = event.target.position();
                  setAssetPosition(position.x, position.y);
                  setAssetDragOffset(null);
                }}
              >
                <Rect
                  width={DOCUMENT_WIDTH}
                  height={DOCUMENT_HEIGHT}
                  fill="#ffffff"
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  cornerRadius={24}
                  shadowColor="#94a3b8"
                  shadowBlur={28}
                  shadowOpacity={0.2}
                  shadowOffsetX={0}
                  shadowOffsetY={12}
                />
                {image && imageBounds ? (
                  <KonvaImage
                    image={image}
                    x={imageBounds.x}
                    y={imageBounds.y}
                    width={imageBounds.width}
                    height={imageBounds.height}
                    cornerRadius={18}
                  />
                ) : null}
              </Group>
              {draft.annotations.map((annotation) => renderAnnotation(annotation))}
              {preview ? renderAnnotation(preview, true) : null}
            </Layer>
          </Stage>
        </div>

        <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm">
            <Button
              type="button"
              className="bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200"
              onClick={() => setViewportCenter(1)}
            >
              Fit
            </Button>
            <Button
              type="button"
              className="bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200"
              onClick={() => setViewportCenter(actualSizeZoom)}
            >
              1:1
            </Button>
            <div className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium tabular-nums text-slate-600">
              {Math.round(renderedDocumentPosition.x)}, {Math.round(renderedDocumentPosition.y)}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute right-4 top-4">
          <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm">
            <div className="mb-2 text-xs font-medium text-slate-500">Map</div>
            <div
              className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
              style={{ width: `${MINI_MAP_WIDTH}px`, height: `${miniMapHeight}px` }}
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(203,213,225,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(203,213,225,0.45) 1px, transparent 1px)',
                  backgroundSize: '12px 12px',
                }}
              />
              <div
                className="absolute rounded-lg border border-slate-300 bg-white/90 shadow-sm"
                style={{
                  left: `${documentMiniMapRect.x}px`,
                  top: `${documentMiniMapRect.y}px`,
                  width: `${documentMiniMapRect.width}px`,
                  height: `${documentMiniMapRect.height}px`,
                }}
              />
              <div
                className="absolute rounded-md border-2 border-blue-500/80 bg-blue-500/10"
                style={{
                  left: `${viewportMiniMapRect.x}px`,
                  top: `${viewportMiniMapRect.y}px`,
                  width: `${viewportMiniMapRect.width}px`,
                  height: `${viewportMiniMapRect.height}px`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
