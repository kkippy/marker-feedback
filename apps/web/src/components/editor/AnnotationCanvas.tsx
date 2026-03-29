import { useCallback, useEffect, useMemo, useRef, useState, type MouseEventHandler } from 'react';
import { useWheel } from '@use-gesture/react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Arrow, Circle, Group, Image as KonvaImage, Layer, Line as KonvaLine, Rect, Stage, Text } from 'react-konva';
import { createId, normalizeRect, type Annotation, type AnnotationGeometry } from '@marker/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/locale';
import { useLoadedImage } from '@/lib/useLoadedImage';
import { DEFAULT_TEXT_STYLE, useEditorStore } from '@/lib/useEditorStore';
import { toDocumentLocalPoint } from './annotationCoordinates';
import { getCanvasCheckerboardStyle } from './canvasBackgroundStyle';
import { resetCanvasViewportSnapshot, setCanvasViewportSnapshot, type ViewportMetrics } from './canvasViewportStore';
import { interpolateViewportTransition } from './canvasZoomMotion';
import {
  getCanvasWheelConfig,
  getNextCanvasZoomFromNormalizedDelta,
  getNormalizedCanvasWheelDelta,
  shouldHandleCanvasZoomShortcut,
} from './canvasZoomGesture';
import { CanvasContextMenu } from './CanvasContextMenu';
import { FloatingLineStyleToolbar } from './FloatingLineStyleToolbar';
import { getContextMenuItems, type ContextMenuActionId } from './contextMenuItems';
import { InlineTextEditor } from './InlineTextEditor';

const DOCUMENT_WIDTH = 960;
const DOCUMENT_HEIGHT = 560;
const WORKSPACE_WIDTH = 2800;
const WORKSPACE_HEIGHT = 1800;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;
const ZOOM_ANIMATION_DURATION_MS = 140;
const WORKSPACE_PADDING = 800;
const PADDING = 0;
const COPY_OFFSET = 24;
const MAX_PENDING_WHEEL_DELTA = 360;
const MAX_WHEEL_DELTA_APPLY_PER_FRAME = 84;

interface LineEditPreview {
  annotationId: string;
  points: [number, number, number, number];
}

type LineMarkerStyle = NonNullable<Annotation['style']['lineStartMarker']>;

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
    y: 0,
    width,
    height,
  };
};

const getDefaultStyle = (tool: Annotation['tool']) =>
  tool === 'highlight'
    ? { stroke: '#f59e0b', fill: 'rgba(251,191,36,0.25)', strokeWidth: 3 }
    : tool === 'blur'
      ? { stroke: '#0f172a', fill: 'rgba(15,23,42,0.45)', strokeWidth: 2 }
      : tool === 'line'
        ? {
            stroke: '#0f172a',
            strokeWidth: 4,
            lineDash: 'solid' as const,
            lineDashSize: 0,
            lineStartMarker: 'none' as const,
            lineEndMarker: 'none' as const,
          }
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


const translateLinePoints = (
  points: [number, number, number, number],
  dx: number,
  dy: number,
): [number, number, number, number] => [
  Number((points[0] + dx).toFixed(2)),
  Number((points[1] + dy).toFixed(2)),
  Number((points[2] + dx).toFixed(2)),
  Number((points[3] + dy).toFixed(2)),
];

const replaceLineHandle = (
  points: [number, number, number, number],
  handle: 'start' | 'end',
  nextX: number,
  nextY: number,
): [number, number, number, number] =>
  handle === 'start'
    ? [Number(nextX.toFixed(2)), Number(nextY.toFixed(2)), points[2], points[3]]
    : [points[0], points[1], Number(nextX.toFixed(2)), Number(nextY.toFixed(2))];

const getLineMidpoint = (points: [number, number, number, number]) => ({
  x: (points[0] + points[2]) / 2,
  y: (points[1] + points[3]) / 2,
});

const getLineEndpointVector = (
  points: [number, number, number, number],
  marker: 'start' | 'end',
) => {
  const x = marker === 'start' ? points[0] : points[2];
  const y = marker === 'start' ? points[1] : points[3];
  const dx = marker === 'start' ? points[0] - points[2] : points[2] - points[0];
  const dy = marker === 'start' ? points[1] - points[3] : points[3] - points[1];
  const length = Math.hypot(dx, dy) || 1;

  return {
    x,
    y,
    unitX: dx / length,
    unitY: dy / length,
    normalX: -dy / length,
    normalY: dx / length,
  };
};

const getLineMarkerPoints = (
  points: [number, number, number, number],
  marker: 'start' | 'end',
  markerStyle: LineMarkerStyle,
  strokeWidth: number,
): number[] | null => {
  const vector = getLineEndpointVector(points, marker);
  const markerSize = Math.max(8, strokeWidth * 2.6);
  const barHalf = Math.max(5, strokeWidth * 1.4);
  const arrowBaseX = vector.x + vector.unitX * markerSize;
  const arrowBaseY = vector.y + vector.unitY * markerSize;

  switch (markerStyle) {
    case 'arrow':
      return [
        vector.x + vector.normalX * markerSize * 0.7,
        vector.y + vector.normalY * markerSize * 0.7,
        vector.x,
        vector.y,
        vector.x - vector.normalX * markerSize * 0.7,
        vector.y - vector.normalY * markerSize * 0.7,
        arrowBaseX,
        arrowBaseY,
      ];
    case 'bar':
      return [
        vector.x + vector.normalX * barHalf,
        vector.y + vector.normalY * barHalf,
        vector.x - vector.normalX * barHalf,
        vector.y - vector.normalY * barHalf,
      ];
    case 'dot':
      return [vector.x, vector.y, Math.max(3.5, strokeWidth * 0.9)];
    default:
      return null;
  }
};

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
    case 'line':
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
  const { messages } = useLocale();
  const frameRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
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
  const [hoveredTextAnnotationId, setHoveredTextAnnotationId] = useState<string | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineEditPreview, setLineEditPreview] = useState<LineEditPreview | null>(null);
  const [lineToolbarReference, setLineToolbarReference] = useState<HTMLDivElement | null>(null);
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
  const renderedDocumentPosition = documentPosition;
  const viewportContentRect = useMemo(
    () =>
      imageBounds
        ? {
            x: renderedDocumentPosition.x + imageBounds.x,
            y: renderedDocumentPosition.y + imageBounds.y,
            width: imageBounds.width,
            height: imageBounds.height,
          }
        : {
            x: renderedDocumentPosition.x,
            y: renderedDocumentPosition.y,
            width: DOCUMENT_WIDTH,
            height: DOCUMENT_HEIGHT,
          },
    [imageBounds, renderedDocumentPosition.x, renderedDocumentPosition.y],
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
  const stageWidth = useMemo(
    () => Math.max(viewportSize.width, scaledWorkspaceWidth + WORKSPACE_PADDING * 2),
    [scaledWorkspaceWidth, viewportSize.width],
  );
  const stageHeight = useMemo(
    () => Math.max(viewportHeight, scaledWorkspaceHeight + WORKSPACE_PADDING * 2),
    [scaledWorkspaceHeight, viewportHeight],
  );
  const layerOffsetX = WORKSPACE_PADDING;
  const layerOffsetY = WORKSPACE_PADDING;
  const getViewportMetricsForZoom = useCallback((nextZoom: number): Omit<ViewportMetrics, 'scrollLeft' | 'scrollTop'> => {
    const nextCanvasScale = fitScale * nextZoom;
    const nextScaledWorkspaceWidth = Math.round(WORKSPACE_WIDTH * nextCanvasScale);
    const nextScaledWorkspaceHeight = Math.round(WORKSPACE_HEIGHT * nextCanvasScale);
    const nextStageWidth = Math.max(viewportSize.width, nextScaledWorkspaceWidth + WORKSPACE_PADDING * 2);
    const nextStageHeight = Math.max(viewportHeight, nextScaledWorkspaceHeight + WORKSPACE_PADDING * 2);

    return {
      zoom: nextZoom,
      canvasScale: nextCanvasScale,
      stageWidth: nextStageWidth,
      stageHeight: nextStageHeight,
      layerOffsetX: WORKSPACE_PADDING,
      layerOffsetY: WORKSPACE_PADDING,
    };
  }, [fitScale, viewportHeight, viewportSize.width]);
  const committedViewportMetrics = useMemo<ViewportMetrics>(() => ({
    zoom: displayZoom,
    canvasScale,
    stageWidth,
    stageHeight,
    layerOffsetX,
    layerOffsetY,
    scrollLeft: scrollPosition.left,
    scrollTop: scrollPosition.top,
  }), [canvasScale, displayZoom, layerOffsetX, layerOffsetY, scrollPosition.left, scrollPosition.top, stageHeight, stageWidth]);
  const contextMenuItems = useMemo(() => {
    const target = contextMenu.target;

    if (!target) {
      return [];
    }

    if (target.kind === 'empty-space') {
      return getContextMenuItems({ kind: 'empty-space' }, messages.contextMenu);
    }

    const annotation = draft.annotations.find((item) => item.id === target.annotationId);
    return annotation ? getContextMenuItems({ kind: 'annotation', annotation }, messages.contextMenu) : [];
  }, [contextMenu.target, draft.annotations, messages.contextMenu]);
  const editingLineAnnotation = useMemo(() => {
    if (!editingLineId) {
      return null;
    }

    const annotation = draft.annotations.find((item) => item.id === editingLineId);
    return annotation?.tool === 'line' && annotation.geometry.kind === 'line' ? annotation : null;
  }, [draft.annotations, editingLineId]);
  const editingLinePoints = useMemo(() => {
    if (!editingLineAnnotation) {
      return null;
    }

    const geometry = editingLineAnnotation.geometry;

    if (geometry.kind !== 'line') {
      return null;
    }

    return lineEditPreview?.annotationId === editingLineAnnotation.id
      ? lineEditPreview.points
      : geometry.points;
  }, [editingLineAnnotation, lineEditPreview]);

  const lineToolbarPosition = useMemo(() => {
    if (!editingLinePoints || readOnly) {
      return null;
    }

    const midpoint = getLineMidpoint(editingLinePoints);

    return {
      left:
        layerOffsetX -
        scrollPosition.left +
        (renderedDocumentPosition.x + midpoint.x) * canvasScale,
      top:
        layerOffsetY -
        scrollPosition.top +
        (renderedDocumentPosition.y + midpoint.y) * canvasScale,
    };
  }, [
    canvasScale,
    editingLinePoints,
    layerOffsetX,
    layerOffsetY,
    readOnly,
    renderedDocumentPosition.x,
    renderedDocumentPosition.y,
    scrollPosition.left,
    scrollPosition.top,
  ]);
  const zoomAnimationFrameRef = useRef<number | null>(null);
  const wheelZoomFrameRef = useRef<number | null>(null);
  const zoomPreviewCommitTimeoutRef = useRef<number | null>(null);
  const suppressZoomSyncAnimationRef = useRef(false);
  const zoomAnimationRef = useRef<{
    startTime: number;
    startZoom: number;
    targetZoom: number;
    startLeft: number;
    targetLeft: number;
    startTop: number;
    targetTop: number;
  } | null>(null);
  const zoomPreviewRef = useRef<ViewportMetrics | null>(null);
  const pendingWheelZoomRef = useRef<{
    normalizedDelta: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const viewportMetricsRef = useRef<ViewportMetrics | null>(null);
  const scrollPositionRef = useRef(scrollPosition);
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
    scrollPositionRef.current = scrollPosition;
  }, [scrollPosition]);

  const getContentScrollBounds = useCallback(
    (
      metrics: Pick<ViewportMetrics, 'canvasScale' | 'layerOffsetX' | 'layerOffsetY' | 'stageWidth' | 'stageHeight'>,
      viewportRect?: { width: number; height: number },
    ) => {
      const viewportWidth = viewportRect?.width ?? viewportSize.width;
      const viewportHeightValue = viewportRect?.height ?? viewportHeight;
      const contentLeft = viewportContentRect.x * metrics.canvasScale + metrics.layerOffsetX;
      const contentTop = viewportContentRect.y * metrics.canvasScale + metrics.layerOffsetY;
      const contentWidth = viewportContentRect.width * metrics.canvasScale;
      const contentHeight = viewportContentRect.height * metrics.canvasScale;
      const centeredLeft = contentLeft + contentWidth / 2 - viewportWidth / 2;
      const centeredTop = contentTop + contentHeight / 2 - viewportHeightValue / 2;

      return {
        // Intentionally remove all drag bounds and let the viewport move
        // freely in every direction.
        minLeft: Number.NEGATIVE_INFINITY,
        maxLeft: Number.POSITIVE_INFINITY,
        minTop: Number.NEGATIVE_INFINITY,
        maxTop: Number.POSITIVE_INFINITY,
      };
    },
    [viewportContentRect.height, viewportContentRect.width, viewportContentRect.x, viewportContentRect.y, viewportHeight, viewportSize.width],
  );

  const clampScrollPosition = useCallback(
    (
      nextScroll: { left: number; top: number },
      metrics: Pick<ViewportMetrics, 'canvasScale' | 'layerOffsetX' | 'layerOffsetY' | 'stageWidth' | 'stageHeight'>,
      viewportRect?: { width: number; height: number },
    ) => {
      const bounds = getContentScrollBounds(metrics, viewportRect);

      return {
        left: clamp(nextScroll.left, bounds.minLeft, bounds.maxLeft),
        top: clamp(nextScroll.top, bounds.minTop, bounds.maxTop),
      };
    },
    [getContentScrollBounds],
  );

  const getCenteredScrollForContentRect = useCallback(
    (
      metrics: Pick<ViewportMetrics, 'canvasScale' | 'layerOffsetX' | 'layerOffsetY' | 'stageWidth' | 'stageHeight'>,
      viewportRect?: { width: number; height: number },
    ) =>
      clampScrollPosition(
        {
          left:
            viewportContentRect.x * metrics.canvasScale +
            metrics.layerOffsetX +
            (viewportContentRect.width * metrics.canvasScale) / 2 -
            (viewportRect?.width ?? viewportSize.width) / 2,
          top:
            viewportContentRect.y * metrics.canvasScale +
            metrics.layerOffsetY +
            (viewportContentRect.height * metrics.canvasScale) / 2 -
            (viewportRect?.height ?? viewportHeight) / 2,
        },
        metrics,
      ),
    [clampScrollPosition, viewportContentRect.height, viewportContentRect.width, viewportContentRect.x, viewportContentRect.y, viewportHeight, viewportSize.width],
  );

  const applyViewportMetricsPreview = useCallback((snapshot: ViewportMetrics) => {
    const stage = stageRef.current;
    const layer = layerRef.current;

    if (!stage || !layer) {
      return;
    }

    stage.width(viewportSize.width);
    stage.height(viewportHeight);
    layer.position({
      x: snapshot.layerOffsetX - snapshot.scrollLeft,
      y: snapshot.layerOffsetY - snapshot.scrollTop,
    });
    layer.scale({
      x: snapshot.canvasScale,
      y: snapshot.canvasScale,
    });
    stage.draw();

    zoomPreviewRef.current = snapshot;
    viewportMetricsRef.current = snapshot;
    setCanvasViewportSnapshot(snapshot);
  }, [viewportHeight, viewportSize.width]);

  const clearZoomPreviewCommitTimeout = useCallback(() => {
    if (zoomPreviewCommitTimeoutRef.current !== null) {
      window.clearTimeout(zoomPreviewCommitTimeoutRef.current);
      zoomPreviewCommitTimeoutRef.current = null;
    }
  }, []);

  const commitZoomPreview = useCallback(() => {
    const preview = zoomPreviewRef.current;

    clearZoomPreviewCommitTimeout();

    if (!preview) {
      return;
    }

    zoomPreviewRef.current = null;
    viewportMetricsRef.current = preview;
    suppressZoomSyncAnimationRef.current = true;
    setDisplayZoom(preview.zoom);
    setScrollPosition({ left: preview.scrollLeft, top: preview.scrollTop });
    setZoom(preview.zoom);
  }, [clearZoomPreviewCommitTimeout, setZoom]);

  const scheduleZoomPreviewCommit = useCallback(() => {
    clearZoomPreviewCommitTimeout();
    zoomPreviewCommitTimeoutRef.current = window.setTimeout(() => {
      commitZoomPreview();
    }, 80);
  }, [clearZoomPreviewCommitTimeout, commitZoomPreview]);

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
    setEditingLineId(null);
    setLineEditPreview(null);
    zoomPreviewRef.current = null;
    clearZoomPreviewCommitTimeout();
    resetCanvasViewportSnapshot();
    setDisplayZoom(zoom);
  }, [clearZoomPreviewCommitTimeout, draft.asset?.id]);

  useEffect(() => {
    if (!editingLineId) {
      return;
    }

    if (selectedAnnotationId !== editingLineId || !editingLineAnnotation) {
      setEditingLineId(null);
      setLineEditPreview(null);
    }
  }, [editingLineAnnotation, editingLineId, selectedAnnotationId]);

  useEffect(() => {
    if (zoomPreviewRef.current) {
      return;
    }
    viewportMetricsRef.current = committedViewportMetrics;
    setCanvasViewportSnapshot(viewportMetricsRef.current);
  }, [committedViewportMetrics]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport || !draft.asset || hasInitializedViewRef.current) {
      return;
    }

    const centeredScroll = getCenteredScrollForContentRect(
      {
        canvasScale,
        layerOffsetX,
        layerOffsetY,
        stageWidth,
        stageHeight,
      },
      {
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      },
    );
    setScrollPosition(centeredScroll);
    hasInitializedViewRef.current = true;
  }, [
    canvasScale,
    draft.asset,
    getCenteredScrollForContentRect,
    layerOffsetX,
    layerOffsetY,
    stageHeight,
    stageWidth,
  ]);

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
      const currentMetrics = zoomPreviewRef.current ?? viewportMetricsRef.current ?? committedViewportMetrics;

      if (zoomPreviewRef.current) {
        commitZoomPreview();
      }

      if (!viewport) {
        setDisplayZoom(targetZoom);
        return;
      }

      stopZoomAnimation();

      const currentLeft = currentMetrics.scrollLeft;
      const currentTop = currentMetrics.scrollTop;
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
        setScrollPosition({ left: snapshot.left, top: snapshot.top });

        if (progress < 1) {
          zoomAnimationFrameRef.current = window.requestAnimationFrame(step);
          return;
        }

        stopZoomAnimation();
      };

      zoomAnimationFrameRef.current = window.requestAnimationFrame(step);
    },
    [commitZoomPreview, committedViewportMetrics, displayZoom, stopZoomAnimation],
  );

  useEffect(() => () => {
    stopZoomAnimation();
    clearZoomPreviewCommitTimeout();
    resetCanvasViewportSnapshot();

    if (wheelZoomFrameRef.current !== null) {
      window.cancelAnimationFrame(wheelZoomFrameRef.current);
      wheelZoomFrameRef.current = null;
    }
  }, [clearZoomPreviewCommitTimeout, stopZoomAnimation]);

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
      if (!panStateRef.current.active) {
        return;
      }

      const deltaX = event.clientX - panStateRef.current.startClientX;
      const deltaY = event.clientY - panStateRef.current.startClientY;

      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        didPanRef.current = true;
      }

      const currentMetrics = zoomPreviewRef.current ?? viewportMetricsRef.current ?? committedViewportMetrics;
      setScrollPosition(
        clampScrollPosition(
          {
            left: panStateRef.current.startScrollLeft - deltaX,
            top: panStateRef.current.startScrollTop - deltaY,
          },
          currentMetrics,
        ),
      );
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
  }, [clampScrollPosition, committedViewportMetrics]);

  useEffect(() => {
    onExportReady?.(() =>
      layerRef.current?.toDataURL({
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
    const viewport = zoomPreviewRef.current ?? viewportMetricsRef.current ?? committedViewportMetrics;

    if (!pointer || !viewport.canvasScale) {
      return null;
    }

    const logicalPoint = {
      x: (pointer.x + viewport.scrollLeft - viewport.layerOffsetX) / viewport.canvasScale,
      y: (pointer.y + viewport.scrollTop - viewport.layerOffsetY) / viewport.canvasScale,
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
    if (zoomPreviewRef.current) {
      commitZoomPreview();
    }

    if (zoomAnimationRef.current) {
      const interruptedZoom = Number(displayZoom.toFixed(2));
      stopZoomAnimation();
      setDisplayZoom(interruptedZoom);
      setZoom(interruptedZoom);
    }

    const currentMetrics = zoomPreviewRef.current ?? viewportMetricsRef.current ?? committedViewportMetrics;

    panStateRef.current = {
      active: true,
      startClientX: clientX,
      startClientY: clientY,
      startScrollLeft: currentMetrics.scrollLeft,
      startScrollTop: currentMetrics.scrollTop,
    };
    didPanRef.current = false;
    setIsPanning(true);
  };

  const handleMouseDownCapture: MouseEventHandler<HTMLDivElement> = (event) => {
    if (contextMenu.isOpen) {
      closeContextMenu();
    }

    if (zoomPreviewRef.current) {
      commitZoomPreview();
    }

    const shouldPan = event.button === 1 || (spacePressedRef.current && event.button === 0);

    if (!shouldPan) {
      return;
    }

    event.preventDefault();
    startPanning(event.clientX, event.clientY);
  };

  const applyZoomAtOrigin = useCallback((
    nextZoom: number,
    originX: number,
    originY: number,
    options?: { animate?: boolean },
  ) => {
    const currentMetrics = zoomPreviewRef.current ?? viewportMetricsRef.current ?? committedViewportMetrics;

    if (Math.abs(nextZoom - currentMetrics.zoom) < 0.001) {
      return;
    }

    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const pointerX = currentMetrics.scrollLeft + originX - rect.left;
    const pointerY = currentMetrics.scrollTop + originY - rect.top;
    const logicalX = (pointerX - currentMetrics.layerOffsetX) / currentMetrics.canvasScale;
    const logicalY = (pointerY - currentMetrics.layerOffsetY) / currentMetrics.canvasScale;
    const nextMetrics = getViewportMetricsForZoom(nextZoom);

    const targetScroll = clampScrollPosition(
      {
        left: logicalX * nextMetrics.canvasScale + nextMetrics.layerOffsetX - (originX - rect.left),
        top: logicalY * nextMetrics.canvasScale + nextMetrics.layerOffsetY - (originY - rect.top),
      },
      nextMetrics,
    );

    if (options?.animate === false) {
      stopZoomAnimation();
      applyViewportMetricsPreview({
        ...nextMetrics,
        scrollLeft: targetScroll.left,
        scrollTop: targetScroll.top,
      });
      scheduleZoomPreviewCommit();
      return;
    }

    if (zoomPreviewRef.current) {
      commitZoomPreview();
    }

    setZoom(nextZoom);
    startZoomAnimation({ targetZoom: nextZoom, targetScroll });
  }, [
    applyViewportMetricsPreview,
    committedViewportMetrics,
    commitZoomPreview,
    getViewportMetricsForZoom,
    scheduleZoomPreviewCommit,
    setZoom,
    startZoomAnimation,
    stopZoomAnimation,
    clampScrollPosition,
  ]);

  useEffect(() => {
    const activeAnimation = zoomAnimationRef.current;

    if (Math.abs(displayZoom - zoom) < 0.001) {
      if (suppressZoomSyncAnimationRef.current) {
        suppressZoomSyncAnimationRef.current = false;
      }
      return;
    }

    if (suppressZoomSyncAnimationRef.current) {
      return;
    }

    if (activeAnimation && Math.abs(activeAnimation.targetZoom - zoom) < 0.001) {
      return;
    }

    setDisplayZoom(zoom);

    if (Math.abs(zoom - MIN_ZOOM) < 0.001) {
      const nextMetrics = getViewportMetricsForZoom(zoom);
      setScrollPosition(getCenteredScrollForContentRect(nextMetrics));
    }
  }, [displayZoom, getCenteredScrollForContentRect, getViewportMetricsForZoom, zoom]);

  const flushWheelZoomFrame = useCallback(() => {
    wheelZoomFrameRef.current = null;

    const pendingWheelZoom = pendingWheelZoomRef.current;

    if (!pendingWheelZoom || !draft.asset) {
      return;
    }

    const deltaToApply = clamp(
      pendingWheelZoom.normalizedDelta,
      -MAX_WHEEL_DELTA_APPLY_PER_FRAME,
      MAX_WHEEL_DELTA_APPLY_PER_FRAME,
    );
    const remainingDelta = pendingWheelZoom.normalizedDelta - deltaToApply;

    pendingWheelZoomRef.current =
      Math.abs(remainingDelta) > 0.001
        ? {
            normalizedDelta: remainingDelta,
            clientX: pendingWheelZoom.clientX,
            clientY: pendingWheelZoom.clientY,
          }
        : null;

    const currentZoom = zoomPreviewRef.current?.zoom ?? displayZoom;
    const nextZoom = getNextCanvasZoomFromNormalizedDelta({
      currentZoom,
      normalizedDelta: deltaToApply,
      minZoom: 0.5,
      maxZoom: MAX_ZOOM,
    });

    applyZoomAtOrigin(nextZoom, pendingWheelZoom.clientX, pendingWheelZoom.clientY, { animate: false });

    if (pendingWheelZoomRef.current && wheelZoomFrameRef.current === null) {
      wheelZoomFrameRef.current = window.requestAnimationFrame(flushWheelZoomFrame);
    }
  }, [applyZoomAtOrigin, displayZoom, draft.asset]);

  useWheel(({ event, intentional, last }) => {
    // `useWheel` emits a synthetic `last` callback after an idle timeout to mark
    // gesture end. Reusing the previous wheel event there would replay the last
    // delta and cause a visible post-gesture zoom jump.
    if (last || !intentional || !draft.asset) {
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

    const normalizedDelta = getNormalizedCanvasWheelDelta({
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
    });
    const pendingWheelZoom = pendingWheelZoomRef.current;

    pendingWheelZoomRef.current = {
      normalizedDelta: clamp(
        (pendingWheelZoom?.normalizedDelta ?? 0) + normalizedDelta,
        -MAX_PENDING_WHEEL_DELTA,
        MAX_PENDING_WHEEL_DELTA,
      ),
      clientX: event.clientX,
      clientY: event.clientY,
    };

    if (wheelZoomFrameRef.current === null) {
      wheelZoomFrameRef.current = window.requestAnimationFrame(flushWheelZoomFrame);
    }
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
    const clickedCanvasSurface =
      clickedStage ||
      target.hasName('canvas-document-surface') ||
      target.hasName('canvas-document-image');

    if (activeTool === 'select' && event.evt.button === 0 && clickedCanvasSurface) {
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

    if (annotation.id !== editingLineId) {
      setEditingLineId(null);
      setLineEditPreview(null);
    }
    setSelectedAnnotation(annotation.id);
    openContextMenu(
      { kind: 'annotation', annotationId: annotation.id },
      getFramePosition(event.evt.clientX, event.evt.clientY),
    );
  };

  const startLineEditing = useCallback((annotationId: string) => {
    setActiveTool('select');
    setSelectedAnnotation(annotationId);
    setEditingLineId(annotationId);
    setLineEditPreview(null);
  }, [setActiveTool, setSelectedAnnotation]);

  const clearCanvasSelection = useCallback(() => {
    setEditingLineId(null);
    setLineEditPreview(null);
    setSelectedAnnotation(null);
  }, [setSelectedAnnotation]);

  const updateEditingLineStyle = useCallback((patch: Partial<Annotation['style']>) => {
    if (!editingLineAnnotation) {
      return;
    }

    updateAnnotation(editingLineAnnotation.id, (current) => {
      if (current.tool !== 'line' || current.geometry.kind !== 'line') {
        return;
      }

      current.style = {
        ...current.style,
        ...patch,
      };
    });
  }, [editingLineAnnotation, updateAnnotation]);

  const commitLinePoints = useCallback((annotationId: string, points: [number, number, number, number]) => {
    updateAnnotation(annotationId, (current) => {
      if (current.tool !== 'line' || current.geometry.kind !== 'line') {
        return;
      }

      current.geometry = {
        ...current.geometry,
        points,
      };
    });
    setLineEditPreview(null);
  }, [updateAnnotation]);

  const handleContextMenuAction = (actionId: ContextMenuActionId) => {
    const target = contextMenu.target;

    if (!target) {
      return;
    }

    if (actionId === 'add-text' && target.kind === 'empty-space') {
      startInlineTextCreate(target.point);
      return;
    }

    if (
      actionId === 'rectangle' ||
      actionId === 'line' ||
      actionId === 'arrow' ||
      actionId === 'highlight' ||
      actionId === 'marker'
    ) {
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

  const setViewportCenter = (nextZoom: number) => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    if (zoomPreviewRef.current) {
      commitZoomPreview();
    }

    const nextMetrics = getViewportMetricsForZoom(nextZoom);
    const targetScroll = getCenteredScrollForContentRect(
      nextMetrics,
      {
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      },
    );

    if (nextZoom === zoom) {
      setScrollPosition(targetScroll);
      return;
    }

    setZoom(nextZoom);
    startZoomAnimation({ targetZoom: nextZoom, targetScroll });
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
      activeTool === 'arrow' || activeTool === 'line'
        ? {
            kind: activeTool as 'arrow' | 'line',
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
      onClick: () => {
        if (annotation.id !== editingLineId) {
          setEditingLineId(null);
          setLineEditPreview(null);
        }
        setSelectedAnnotation(annotation.id);
      },
      onTap: () => {
        if (annotation.id !== editingLineId) {
          setEditingLineId(null);
          setLineEditPreview(null);
        }
        setSelectedAnnotation(annotation.id);
      },
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

      case 'line': {
        if (geometry.kind !== 'line') {
          return null;
        }

        const linePoints =
          lineEditPreview?.annotationId === annotation.id
            ? lineEditPreview.points
            : geometry.points;
        const isEditingLine = !readOnly && !isPreview && editingLineId === annotation.id;
        const lineStrokeWidth = annotation.style.strokeWidth ?? 4;
        const lineDashSize = annotation.style.lineDashSize ?? (annotation.style.lineDash === 'dashed' ? 6 : 0);
        const lineDash = lineDashSize > 0 ? [lineDashSize * 2, lineDashSize] : undefined;
        const lineStartMarker = annotation.style.lineStartMarker ?? 'none';
        const lineEndMarker = annotation.style.lineEndMarker ?? 'none';
        const handleRadius = 6 / Math.max(canvasScale, 0.75);
        const handleStrokeWidth = 2 / Math.max(canvasScale, 0.75);
        const startMarkerPoints =
          lineStartMarker !== 'none'
            ? getLineMarkerPoints(linePoints, 'start', lineStartMarker, lineStrokeWidth)
            : null;
        const endMarkerPoints =
          lineEndMarker !== 'none'
            ? getLineMarkerPoints(linePoints, 'end', lineEndMarker, lineStrokeWidth)
            : null;

        return (
          <Group
            key={annotation.id}
            x={renderedDocumentPosition.x}
            y={renderedDocumentPosition.y}
            {...commonProps}
            draggable={isEditingLine}
            onDblClick={() => startLineEditing(annotation.id)}
            onDblTap={() => startLineEditing(annotation.id)}
            onDragEnd={(event) => {
              if (!isEditingLine) {
                return;
              }

              const pos = event.target.position();
              const dx = pos.x - renderedDocumentPosition.x;
              const dy = pos.y - renderedDocumentPosition.y;
              const nextPoints = translateLinePoints(geometry.points, dx, dy);
              event.target.position({
                x: renderedDocumentPosition.x,
                y: renderedDocumentPosition.y,
              });
              commitLinePoints(annotation.id, nextPoints);
            }}
          >
            {isEditingLine ? (
              <KonvaLine
                points={linePoints}
                stroke="#60a5fa"
                strokeWidth={lineStrokeWidth + 6 / Math.max(canvasScale, 0.75)}
                opacity={0.2}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            ) : null}
            <KonvaLine
              points={linePoints}
              stroke={annotation.style.stroke}
              strokeWidth={lineStrokeWidth}
              lineCap="round"
              lineJoin="round"
              dash={lineDash}
              hitStrokeWidth={18}
            />
            {startMarkerPoints && lineStartMarker === 'arrow' ? (
              <KonvaLine
                points={startMarkerPoints}
                stroke={annotation.style.stroke}
                strokeWidth={lineStrokeWidth}
                lineCap="round"
                lineJoin="round"
                hitStrokeWidth={18}
              />
            ) : null}
            {endMarkerPoints && lineEndMarker === 'arrow' ? (
              <KonvaLine
                points={endMarkerPoints}
                stroke={annotation.style.stroke}
                strokeWidth={lineStrokeWidth}
                lineCap="round"
                lineJoin="round"
                hitStrokeWidth={18}
              />
            ) : null}
            {startMarkerPoints && lineStartMarker === 'bar' ? (
              <KonvaLine
                points={startMarkerPoints}
                stroke={annotation.style.stroke}
                strokeWidth={lineStrokeWidth}
                lineCap="round"
                hitStrokeWidth={18}
              />
            ) : null}
            {endMarkerPoints && lineEndMarker === 'bar' ? (
              <KonvaLine
                points={endMarkerPoints}
                stroke={annotation.style.stroke}
                strokeWidth={lineStrokeWidth}
                lineCap="round"
                hitStrokeWidth={18}
              />
            ) : null}
            {startMarkerPoints && lineStartMarker === 'dot' ? (
              <Circle
                x={startMarkerPoints[0]}
                y={startMarkerPoints[1]}
                radius={startMarkerPoints[2]}
                fill={annotation.style.stroke}
                listening={false}
              />
            ) : null}
            {endMarkerPoints && lineEndMarker === 'dot' ? (
              <Circle
                x={endMarkerPoints[0]}
                y={endMarkerPoints[1]}
                radius={endMarkerPoints[2]}
                fill={annotation.style.stroke}
                listening={false}
              />
            ) : null}
            {isEditingLine ? (
              <>
                <Circle
                  x={linePoints[0]}
                  y={linePoints[1]}
                  radius={handleRadius}
                  fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth={handleStrokeWidth}
                  draggable
                  onMouseDown={(event) => {
                    event.cancelBubble = true;
                  }}
                  onTouchStart={(event) => {
                    event.cancelBubble = true;
                  }}
                  onDragMove={(event) => {
                    const pos = event.target.position();
                    setLineEditPreview({
                      annotationId: annotation.id,
                      points: replaceLineHandle(linePoints, 'start', pos.x, pos.y),
                    });
                  }}
                  onDragEnd={(event) => {
                    const pos = event.target.position();
                    commitLinePoints(annotation.id, replaceLineHandle(linePoints, 'start', pos.x, pos.y));
                  }}
                />
                <Circle
                  x={linePoints[2]}
                  y={linePoints[3]}
                  radius={handleRadius}
                  fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth={handleStrokeWidth}
                  draggable
                  onMouseDown={(event) => {
                    event.cancelBubble = true;
                  }}
                  onTouchStart={(event) => {
                    event.cancelBubble = true;
                  }}
                  onDragMove={(event) => {
                    const pos = event.target.position();
                    setLineEditPreview({
                      annotationId: annotation.id,
                      points: replaceLineHandle(linePoints, 'end', pos.x, pos.y),
                    });
                  }}
                  onDragEnd={(event) => {
                    const pos = event.target.position();
                    commitLinePoints(annotation.id, replaceLineHandle(linePoints, 'end', pos.x, pos.y));
                  }}
                />
              </>
            ) : null}
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

    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((naturalRatio / fitScale).toFixed(2))));
  }, [draft.asset, fitScale, imageBounds]);

  return (
    <Card className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden p-4">
      <div ref={frameRef} className="relative min-h-[320px] flex-1">
        <div
          ref={viewportRef}
          className={cn(
            'min-h-[320px] h-full overflow-hidden rounded-2xl bg-white',
            isPanning
              ? 'cursor-grabbing'
              : isSpacePressed
                ? 'cursor-grab'
                : activeTool === 'select'
                  ? 'cursor-grab'
                : 'cursor-default',
          )}
          style={{ overflowAnchor: 'none' }}
          onMouseDownCapture={handleMouseDownCapture}
        >
          <div
            ref={stageContainerRef}
            className="relative will-change-transform"
            style={{
              width: `${viewportSize.width}px`,
              height: `${viewportHeight}px`,
            }}
          >
            <div className="pointer-events-none absolute inset-0 rounded-2xl" style={checkerboardStyle} />

            <Stage
              ref={stageRef}
              width={viewportSize.width}
              height={viewportHeight}
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
                  clearCanvasSelection();
                }
              }}
            >
              <Layer
                ref={layerRef}
                x={layerOffsetX - scrollPosition.left}
                y={layerOffsetY - scrollPosition.top}
                scaleX={canvasScale}
                scaleY={canvasScale}
              >
                <Rect
                  name="canvas-document-surface"
                  x={renderedDocumentPosition.x}
                  y={renderedDocumentPosition.y}
                  width={DOCUMENT_WIDTH}
                  height={DOCUMENT_HEIGHT}
                  fill="rgba(15,23,42,0.001)"
                  listening={!readOnly && activeTool === 'select'}
                  onClick={() => {
                    if (!readOnly && activeTool === 'select') {
                      clearCanvasSelection();
                    }
                  }}
                  onTap={() => {
                    if (!readOnly && activeTool === 'select') {
                      clearCanvasSelection();
                    }
                  }}
                />
                <Group
                  x={renderedDocumentPosition.x}
                  y={renderedDocumentPosition.y}
                  onClick={() => {
                    if (!readOnly && activeTool === 'select') {
                      clearCanvasSelection();
                    }
                  }}
                  onTap={() => {
                    if (!readOnly && activeTool === 'select') {
                      clearCanvasSelection();
                    }
                  }}
                >
                  {image && imageBounds ? (
                    <KonvaImage
                      name="canvas-document-image"
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

        {inlineTextEditor ? (
          <InlineTextEditor
            isOpen
            value={inlineTextEditor.value}
            frame={{
              x: inlineTextEditor.x,
              y: inlineTextEditor.y,
              width: inlineTextEditor.width,
              height: inlineTextEditor.height,
            }}
            documentPosition={renderedDocumentPosition}
            textStyle={inlineTextEditor.style ?? DEFAULT_TEXT_STYLE}
            fallbackViewport={committedViewportMetrics}
            onChange={updateInlineTextValue}
            onTextStyleChange={updateSelectedTextStyle}
            onSizeChange={updateInlineTextSize}
            onFrameChange={updateInlineTextFrame}
            onCommit={commitInlineTextEditor}
            onCancel={cancelInlineTextEditor}
          />
        ) : null}

        {lineToolbarPosition && editingLineAnnotation ? (
          <>
            <div
              ref={setLineToolbarReference}
              className="pointer-events-none absolute size-px"
              style={{
                left: lineToolbarPosition.left,
                top: lineToolbarPosition.top,
              }}
            />
            <FloatingLineStyleToolbar
              isOpen
              reference={lineToolbarReference}
              style={editingLineAnnotation.style}
              onChange={updateEditingLineStyle}
            />
          </>
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
      </div>
    </Card>
  );
}


