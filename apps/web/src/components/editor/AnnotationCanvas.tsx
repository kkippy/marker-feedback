import { useCallback, useEffect, useMemo, useRef, useState, type MouseEventHandler } from 'react';
import { useWheel } from '@use-gesture/react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Arrow, Circle, Group, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva';
import { createId, normalizeRect, type Annotation, type AnnotationGeometry } from '@marker/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/locale';
import { useLoadedImage } from '@/lib/useLoadedImage';
import { DEFAULT_TEXT_STYLE, useEditorStore } from '@/lib/useEditorStore';
import { toDocumentLocalPoint } from './annotationCoordinates';
import { getCanvasCheckerboardStyle } from './canvasBackgroundStyle';
import { interpolateViewportTransition } from './canvasZoomMotion';
import { getCanvasWheelConfig, getNextCanvasZoom, shouldHandleCanvasZoomShortcut } from './canvasZoomGesture';
import { CanvasContextMenu } from './CanvasContextMenu';
import { getContextMenuItems, type ContextMenuActionId } from './contextMenuItems';
import { getInlineTextOverlayStyle } from './inlineTextOverlay';
import { InlineTextEditor } from './InlineTextEditor';
import { getViewportScrollForWorkspacePoint } from './minimapNavigation';

const DOCUMENT_WIDTH = 960;
const DOCUMENT_HEIGHT = 560;
const WORKSPACE_WIDTH = 2800;
const WORKSPACE_HEIGHT = 1800;
const MINI_MAP_WIDTH = 176;
const MAX_ZOOM = 6;
const ZOOM_ANIMATION_DURATION_MS = 140;
const PADDING = 0;
const COPY_OFFSET = 24;
const getTextFontStyle = (style: Annotation['style']) => {
  const fontWeight = style.fontWeight ?? DEFAULT_TEXT_STYLE.fontWeight;
  const fontStyle = style.fontStyle ?? DEFAULT_TEXT_STYLE.fontStyle;

  if (fontWeight === 'bold' && fontStyle === 'italic') {
    return 'bold italic';
  }

  if (fontWeight === 'bold') {
    return 'bold';
  }

  if (fontStyle === 'italic') {
    return 'italic';
  }

  return 'normal';
};

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
            ? { ...DEFAULT_TEXT_STYLE }
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

const offsetAnnotationGeometry = (geometry: AnnotationGeometry): AnnotationGeometry => {
  switch (geometry.kind) {
    case 'rect':
    case 'marker':
    case 'text':
      return {
        ...geometry,
        x: geometry.x + COPY_OFFSET,
        y: geometry.y + COPY_OFFSET,
      };
    case 'arrow':
      return {
        ...geometry,
        points: [
          geometry.points[0] + COPY_OFFSET,
          geometry.points[1] + COPY_OFFSET,
          geometry.points[2] + COPY_OFFSET,
          geometry.points[3] + COPY_OFFSET,
        ],
      };
    default:
      return geometry;
  }
};

export function AnnotationCanvas({
  readOnly = false,
  onExportReady,
}: {
  readOnly?: boolean;
  onExportReady?: (exporter: () => string | undefined) => void;
}) {
  useLocale();
  const frameRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const hasInitializedViewRef = useRef(false);
  const draft = useEditorStore((state) => state.draft);
  const activeTool = useEditorStore((state) => state.activeTool);
  const selectedAnnotationId = useEditorStore((state) => state.selectedAnnotationId);
  const zoom = useEditorStore((state) => state.zoom);
  const contextMenu = useEditorStore((state) => state.contextMenu);
  const inlineTextEditor = useEditorStore((state) => state.inlineTextEditor);
  const setZoom = useEditorStore((state) => state.setZoom);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const addAnnotation = useEditorStore((state) => state.addAnnotation);
  const updateAnnotation = useEditorStore((state) => state.updateAnnotation);
  const commitDraft = useEditorStore((state) => state.commitDraft);
  const setAssetPosition = useEditorStore((state) => state.setAssetPosition);
  const setSelectedAnnotation = useEditorStore((state) => state.setSelectedAnnotation);
  const openContextMenu = useEditorStore((state) => state.openContextMenu);
  const closeContextMenu = useEditorStore((state) => state.closeContextMenu);
  const startInlineTextCreate = useEditorStore((state) => state.startInlineTextCreate);
  const startInlineTextEdit = useEditorStore((state) => state.startInlineTextEdit);
  const updateInlineTextValue = useEditorStore((state) => state.updateInlineTextValue);
  const updateInlineTextSize = useEditorStore((state) => state.updateInlineTextSize);
  const updateInlineTextFrame = useEditorStore((state) => state.updateInlineTextFrame);
  const updateSelectedTextStyle = useEditorStore((state) => state.updateSelectedTextStyle);
  const commitInlineTextEditor = useEditorStore((state) => state.commitInlineTextEditor);
  const cancelInlineTextEditor = useEditorStore((state) => state.cancelInlineTextEditor);
  const image = useLoadedImage(draft.asset?.imageDataUrl);
  const [viewportSize, setViewportSize] = useState({ width: DOCUMENT_WIDTH, height: DOCUMENT_HEIGHT });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<Annotation | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [assetDragOffset, setAssetDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [hoveredTextAnnotationId, setHoveredTextAnnotationId] = useState<string | null>(null);
  const [scrollPosition, setScrollPosition] = useState({ left: 0, top: 0 });
  const [displayZoom, setDisplayZoom] = useState(zoom);
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
  const canvasScale = useMemo(() => fitScale * displayZoom, [displayZoom, fitScale]);
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
  const contextMenuItems = useMemo(() => {
    const target = contextMenu.target;

    if (!target) {
      return [];
    }

    if (target.kind === 'empty-space') {
      return getContextMenuItems({ kind: 'empty-space' });
    }

    const annotation = draft.annotations.find((item) => item.id === target.annotationId);
    return annotation ? getContextMenuItems({ kind: 'annotation', annotation }) : [];
  }, [contextMenu.target, draft.annotations]);
  const inlineTextStyle = useMemo(() => {
    if (!inlineTextEditor) {
      return null;
    }

    return getInlineTextOverlayStyle({
      annotationGeometry: {
        kind: 'text',
        x: inlineTextEditor.x,
        y: inlineTextEditor.y,
        width: inlineTextEditor.width,
        height: inlineTextEditor.height,
      },
      documentPosition: renderedDocumentPosition,
      canvasScale,
      layerOffsetX,
      layerOffsetY,
      scrollLeft: scrollPosition.left,
      scrollTop: scrollPosition.top,
    });
  }, [canvasScale, inlineTextEditor, layerOffsetX, layerOffsetY, renderedDocumentPosition, scrollPosition.left, scrollPosition.top]);
  const zoomAnimationFrameRef = useRef<number | null>(null);
  const zoomAnimationRef = useRef<{
    startTime: number;
    startZoom: number;
    targetZoom: number;
    startLeft: number;
    targetLeft: number;
    startTop: number;
    targetTop: number;
  } | null>(null);
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
    setDisplayZoom(zoom);
  }, [draft.asset?.id]);

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

  const stopZoomAnimation = useCallback(() => {
    if (zoomAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(zoomAnimationFrameRef.current);
      zoomAnimationFrameRef.current = null;
    }
    zoomAnimationRef.current = null;
  }, []);

  const startZoomAnimation = useCallback(
    ({
      targetZoom,
      targetScroll,
    }: {
      targetZoom: number;
      targetScroll?: { left: number; top: number };
    }) => {
      const viewport = viewportRef.current;

      if (!viewport) {
        setDisplayZoom(targetZoom);
        return;
      }

      stopZoomAnimation();

      const currentLeft = viewport.scrollLeft;
      const currentTop = viewport.scrollTop;
      const nextTargetLeft = targetScroll?.left ?? currentLeft;
      const nextTargetTop = targetScroll?.top ?? currentTop;

      if (
        Math.abs(displayZoom - targetZoom) < 0.001 &&
        Math.abs(currentLeft - nextTargetLeft) < 0.5 &&
        Math.abs(currentTop - nextTargetTop) < 0.5
      ) {
        setDisplayZoom(targetZoom);
        return;
      }

      zoomAnimationRef.current = {
        startTime: 0,
        startZoom: displayZoom,
        targetZoom,
        startLeft: currentLeft,
        targetLeft: nextTargetLeft,
        startTop: currentTop,
        targetTop: nextTargetTop,
      };

      const step = (timestamp: number) => {
        const animation = zoomAnimationRef.current;
        const activeViewport = viewportRef.current;

        if (!animation || !activeViewport) {
          stopZoomAnimation();
          return;
        }

        if (!animation.startTime) {
          animation.startTime = timestamp;
        }

        const progress = Math.min(1, (timestamp - animation.startTime) / ZOOM_ANIMATION_DURATION_MS);
        const snapshot = interpolateViewportTransition({
          startZoom: animation.startZoom,
          targetZoom: animation.targetZoom,
          startLeft: animation.startLeft,
          targetLeft: animation.targetLeft,
          startTop: animation.startTop,
          targetTop: animation.targetTop,
          progress,
        });

        setDisplayZoom(snapshot.zoom);
        activeViewport.scrollLeft = snapshot.left;
        activeViewport.scrollTop = snapshot.top;
        setScrollPosition({ left: snapshot.left, top: snapshot.top });

        if (progress < 1) {
          zoomAnimationFrameRef.current = window.requestAnimationFrame(step);
          return;
        }

        stopZoomAnimation();
      };

      zoomAnimationFrameRef.current = window.requestAnimationFrame(step);
    },
    [displayZoom, stopZoomAnimation],
  );

  useEffect(() => () => stopZoomAnimation(), [stopZoomAnimation]);

  useEffect(() => {
    const activeAnimation = zoomAnimationRef.current;

    if (Math.abs(displayZoom - zoom) < 0.001) {
      return;
    }

    if (activeAnimation && Math.abs(activeAnimation.targetZoom - zoom) < 0.001) {
      return;
    }

    startZoomAnimation({ targetZoom: zoom });
  }, [displayZoom, startZoomAnimation, zoom]);

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

  const getFramePosition = (clientX: number, clientY: number) => {
    const rect = frameRef.current?.getBoundingClientRect();

    if (!rect) {
      return { x: clientX, y: clientY };
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

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

    return toDocumentLocalPoint({
      workspacePoint: logicalPoint,
      documentPosition: renderedDocumentPosition,
    });
  };

  const markerCount = draft.annotations.filter((annotation) => annotation.tool === 'marker').length + 1;

  const startPanning = (clientX: number, clientY: number) => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    if (zoomAnimationRef.current) {
      const interruptedZoom = Number(displayZoom.toFixed(2));
      stopZoomAnimation();
      setDisplayZoom(interruptedZoom);
      setZoom(interruptedZoom);
      setScrollPosition({
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
      });
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
    if (contextMenu.isOpen) {
      closeContextMenu();
    }

    const shouldPan = event.button === 1 || (spacePressedRef.current && event.button === 0);

    if (!shouldPan) {
      return;
    }

    event.preventDefault();
    startPanning(event.clientX, event.clientY);
  };

  const applyZoomAtOrigin = useCallback((nextZoom: number, originX: number, originY: number) => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    if (nextZoom === zoom) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const pointerX = viewport.scrollLeft + originX - rect.left;
    const pointerY = viewport.scrollTop + originY - rect.top;
    const logicalX = (pointerX - layerOffsetX) / canvasScale;
    const logicalY = (pointerY - layerOffsetY) / canvasScale;
    const nextCanvasScale = fitScale * nextZoom;
    const nextScaledWorkspaceWidth = Math.round(WORKSPACE_WIDTH * nextCanvasScale);
    const nextScaledWorkspaceHeight = Math.round(WORKSPACE_HEIGHT * nextCanvasScale);
    const nextStageWidth = Math.max(viewportSize.width, nextScaledWorkspaceWidth);
    const nextStageHeight = Math.max(viewportHeight, nextScaledWorkspaceHeight);
    const nextLayerOffsetX = Math.max(0, (nextStageWidth - nextScaledWorkspaceWidth) / 2);
    const nextLayerOffsetY = Math.max(0, (nextStageHeight - nextScaledWorkspaceHeight) / 2);

    const targetScroll = {
      left: Math.max(0, logicalX * nextCanvasScale + nextLayerOffsetX - (originX - rect.left)),
      top: Math.max(0, logicalY * nextCanvasScale + nextLayerOffsetY - (originY - rect.top)),
    };

    setZoom(nextZoom);
    startZoomAnimation({ targetZoom: nextZoom, targetScroll });
  }, [
    canvasScale,
    fitScale,
    layerOffsetX,
    layerOffsetY,
    setZoom,
    startZoomAnimation,
    viewportHeight,
    viewportSize.width,
    zoom,
  ]);

  useWheel(({ event, first, intentional }) => {
    if (!intentional || !draft.asset) {
      return;
    }

    if (contextMenu.isOpen) {
      closeContextMenu();
    }

    if (!shouldHandleCanvasZoomShortcut(event)) {
      return;
    }

    if ('preventDefault' in event) {
      event.preventDefault();
    }

    const nextZoom = getNextCanvasZoom({
      currentZoom: zoom,
      deltaY: event.deltaY,
      minZoom: 0.5,
      maxZoom: MAX_ZOOM,
    });

    applyZoomAtOrigin(nextZoom, event.clientX, event.clientY);
  }, getCanvasWheelConfig({
    target: viewportRef,
  }));
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
      startInlineTextCreate(pointer);
      return;
    }

    setDragStart(pointer);
  };

  const handleStageContextMenu = (event: KonvaEventObject<PointerEvent>) => {
    event.evt.preventDefault();

    if (readOnly || !draft.asset) {
      return;
    }

    if (inlineTextEditor) {
      commitInlineTextEditor();
    }

    const pointer = getPointer(true);

    if (!pointer) {
      closeContextMenu();
      return;
    }

    setSelectedAnnotation(null);
    openContextMenu({ kind: 'empty-space', point: pointer }, getFramePosition(event.evt.clientX, event.evt.clientY));
  };

  const openAnnotationContextMenu = (annotation: Annotation, event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true;
    event.evt.preventDefault();
    event.evt.stopPropagation();

    if (readOnly) {
      return;
    }

    if (inlineTextEditor) {
      commitInlineTextEditor();
    }

    setSelectedAnnotation(annotation.id);
    openContextMenu(
      { kind: 'annotation', annotationId: annotation.id },
      getFramePosition(event.evt.clientX, event.evt.clientY),
    );
  };

  const handleContextMenuAction = (actionId: ContextMenuActionId) => {
    const target = contextMenu.target;

    if (!target) {
      return;
    }

    if (actionId === 'add-text' && target.kind === 'empty-space') {
      startInlineTextCreate(target.point);
      return;
    }

    if (actionId === 'rectangle' || actionId === 'arrow' || actionId === 'highlight' || actionId === 'marker') {
      setActiveTool(actionId);
      closeContextMenu();
      return;
    }

    if (target.kind !== 'annotation') {
      closeContextMenu();
      return;
    }

    const annotation = draft.annotations.find((item) => item.id === target.annotationId);

    if (!annotation) {
      closeContextMenu();
      return;
    }

    switch (actionId) {
      case 'edit-text':
        startInlineTextEdit(annotation.id);
        return;
      case 'copy':
        commitDraft((nextDraft) => {
          const current = nextDraft.annotations.find((item) => item.id === annotation.id);

          if (!current) {
            return;
          }

          nextDraft.annotations.push({
            ...current,
            id: createId('annotation'),
            geometry: offsetAnnotationGeometry(current.geometry),
            createdAt: new Date().toISOString(),
          });
        });
        closeContextMenu();
        return;
      case 'delete':
        commitDraft((nextDraft) => {
          nextDraft.annotations = nextDraft.annotations.filter((item) => item.id !== annotation.id);
        });
        setSelectedAnnotation(null);
        closeContextMenu();
        return;
      case 'bring-to-front':
        commitDraft((nextDraft) => {
          const index = nextDraft.annotations.findIndex((item) => item.id === annotation.id);

          if (index < 0) {
            return;
          }

          const [item] = nextDraft.annotations.splice(index, 1);
          nextDraft.annotations.push(item);
        });
        closeContextMenu();
        return;
      default:
        closeContextMenu();
    }
  };

  const scrollViewportToWorkspacePoint = (
    target: { x: number; y: number },
    nextZoom = zoom,
  ) => {
    const viewport = viewportRef.current;

    if (!viewport) {
      if (nextZoom !== zoom) {
        setZoom(nextZoom);
      }
      return;
    }

    const nextCanvasScale = fitScale * nextZoom;
    const nextScaledWorkspaceWidth = Math.round(WORKSPACE_WIDTH * nextCanvasScale);
    const nextScaledWorkspaceHeight = Math.round(WORKSPACE_HEIGHT * nextCanvasScale);
    const nextStageWidth = Math.max(viewportSize.width, nextScaledWorkspaceWidth);
    const nextStageHeight = Math.max(viewportHeight, nextScaledWorkspaceHeight);
    const nextLayerOffsetX = Math.max(0, (nextStageWidth - nextScaledWorkspaceWidth) / 2);
    const nextLayerOffsetY = Math.max(0, (nextStageHeight - nextScaledWorkspaceHeight) / 2);

    const targetScroll = getViewportScrollForWorkspacePoint({
      target,
      canvasScale: nextCanvasScale,
      layerOffsetX: nextLayerOffsetX,
      layerOffsetY: nextLayerOffsetY,
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
      stageWidth: nextStageWidth,
      stageHeight: nextStageHeight,
    });

    if (nextZoom === zoom) {
      viewport.scrollLeft = targetScroll.left;
      viewport.scrollTop = targetScroll.top;
      setScrollPosition({
        left: targetScroll.left,
        top: targetScroll.top,
      });
      return;
    }

    setZoom(nextZoom);
    startZoomAnimation({ targetZoom: nextZoom, targetScroll });
  };

  const setViewportCenter = (nextZoom: number) => {
    scrollViewportToWorkspacePoint(
      {
        x: renderedDocumentPosition.x + DOCUMENT_WIDTH / 2,
        y: renderedDocumentPosition.y + DOCUMENT_HEIGHT / 2,
      },
      nextZoom,
    );
  };

  const handleMiniMapPointerDown: MouseEventHandler<HTMLDivElement> = (event) => {
    if (!draft.asset || miniMapHeight <= 0) {
      return;
    }

    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = clamp(event.clientX - rect.left, 0, MINI_MAP_WIDTH);
    const pointerY = clamp(event.clientY - rect.top, 0, miniMapHeight);

    scrollViewportToWorkspacePoint({
      x: (pointerX / MINI_MAP_WIDTH) * WORKSPACE_WIDTH,
      y: (pointerY / miniMapHeight) * WORKSPACE_HEIGHT,
    });
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
    const commonProps = {
      onClick: () => setSelectedAnnotation(annotation.id),
      onTap: () => setSelectedAnnotation(annotation.id),
      onContextMenu: (event: KonvaEventObject<PointerEvent>) => openAnnotationContextMenu(annotation, event),
    };

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
            {...commonProps}
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
            dash={selected ? [8, 6] : undefined}
            {...commonProps}
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
            {...commonProps}
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

        const isEditingCurrentText = inlineTextEditor?.annotationId === annotation.id;
        const isHoveredCurrentText = hoveredTextAnnotationId === annotation.id;
        const textBackgroundColor = annotation.style.textBackgroundColor ?? DEFAULT_TEXT_STYLE.textBackgroundColor;

        return (
          <Group
            key={annotation.id}
            x={renderedDocumentPosition.x + geometry.x}
            y={renderedDocumentPosition.y + geometry.y}
            draggable={!readOnly && activeTool === 'select' && !isPreview}
            {...commonProps}
            onMouseEnter={() => {
              if (!readOnly) {
                setHoveredTextAnnotationId(annotation.id);
              }
            }}
            onMouseLeave={() => {
              if (hoveredTextAnnotationId === annotation.id) {
                setHoveredTextAnnotationId(null);
              }
            }}
            onDblClick={() => {
              if (!readOnly) {
                startInlineTextEdit(annotation.id);
              }
            }}
            onDblTap={() => {
              if (!readOnly) {
                startInlineTextEdit(annotation.id);
              }
            }}
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
              fill={
                !isEditingCurrentText && textBackgroundColor && textBackgroundColor !== 'transparent'
                  ? textBackgroundColor
                  : 'rgba(15,23,42,0.001)'
              }
              stroke={
                !isEditingCurrentText && isHoveredCurrentText
                    ? '#94a3b8'
                    : undefined
              }
              strokeWidth={isHoveredCurrentText ? 1 : 0}
            />
            {isEditingCurrentText ? null : (
              <Text
                text={annotation.label ?? ''}
                width={geometry.width}
                fill={annotation.style.textColor ?? DEFAULT_TEXT_STYLE.textColor}
                fontSize={annotation.style.fontSize ?? DEFAULT_TEXT_STYLE.fontSize}
                fontStyle={getTextFontStyle(annotation.style)}
                textDecoration={annotation.style.textDecoration ?? DEFAULT_TEXT_STYLE.textDecoration}
                lineHeight={1.45}
              />
            )}
          </Group>
        );
      }

      default:
        return null;
    }
  };

  const checkerboardStyle = useMemo(() => getCanvasCheckerboardStyle(), []);

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
      <div ref={frameRef} className="relative min-h-[320px] flex-1">
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
          onScroll={(event) => {
            if (contextMenu.isOpen) {
              closeContextMenu();
            }
            setScrollPosition({
              left: event.currentTarget.scrollLeft,
              top: event.currentTarget.scrollTop,
            });
          }}
          onMouseDownCapture={handleMouseDownCapture}
        >
          <div className="relative" style={{ width: `${stageWidth}px`, height: `${stageHeight}px` }}>
            <div className="pointer-events-none absolute inset-0 rounded-2xl" style={checkerboardStyle} />

            <Stage
              ref={stageRef}
              width={stageWidth}
              height={stageHeight}
              className="relative rounded-2xl"
              onMouseDown={handleStageMouseDown}
              onMouseMove={updatePreview}
              onMouseUp={commitPreview}
              onContextMenu={handleStageContextMenu}
              onClick={(event) => {
                if (didPanRef.current) {
                  didPanRef.current = false;
                  return;
                }

                if (contextMenu.isOpen) {
                  closeContextMenu();
                }

                if (event.target === event.target.getStage()) {
                  setSelectedAnnotation(null);
                }
              }}
            >
              <Layer x={layerOffsetX} y={layerOffsetY} scaleX={canvasScale} scaleY={canvasScale}>
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
        </div>

        {inlineTextEditor && inlineTextStyle ? (
          <InlineTextEditor
            isOpen
            value={inlineTextEditor.value}
            frame={{
              x: inlineTextEditor.x,
              y: inlineTextEditor.y,
              width: inlineTextEditor.width,
              height: inlineTextEditor.height,
            }}
            textStyle={inlineTextEditor.style ?? DEFAULT_TEXT_STYLE}
            canvasScale={canvasScale}
            style={{
              left: inlineTextStyle.left,
              top: inlineTextStyle.top,
            }}
            onChange={updateInlineTextValue}
            onTextStyleChange={updateSelectedTextStyle}
            onSizeChange={updateInlineTextSize}
            onFrameChange={updateInlineTextFrame}
            onCommit={commitInlineTextEditor}
            onCancel={cancelInlineTextEditor}
          />
        ) : null}

        <CanvasContextMenu
          isOpen={contextMenu.isOpen && !readOnly}
          x={contextMenu.screenX}
          y={contextMenu.screenY}
          items={contextMenuItems}
          onSelect={handleContextMenuAction}
        />

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
              className="pointer-events-auto relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 cursor-pointer"
              style={{ width: `${MINI_MAP_WIDTH}px`, height: `${miniMapHeight}px` }}
              onPointerDown={handleMiniMapPointerDown}
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


