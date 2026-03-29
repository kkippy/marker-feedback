import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEventHandler } from 'react';
import { useWheel } from '@use-gesture/react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Arrow, Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from 'react-konva';
import {
  createId,
  normalizeRect,
  type Annotation,
  type AnnotationGeometry,
  type CalloutGeometry,
  type EmbeddedImageAsset,
  type ImageCalloutGeometry,
  type RectGeometry,
  type TextGeometry,
} from '@marker/shared';
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
import { FloatingImageCalloutToolbar } from './FloatingImageCalloutToolbar';
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
const CALLOUT_TEXT_WIDTH = 180;
const CALLOUT_TEXT_HEIGHT = 44;
const CALLOUT_GAP = 36;
const IMAGE_CALLOUT_PANEL_WIDTH = 180;
const IMAGE_CALLOUT_PANEL_MIN_HEIGHT = 96;
const IMAGE_CALLOUT_PANEL_MAX_HEIGHT = 180;
const IMAGE_CALLOUT_PLACEHOLDER_HEIGHT = 120;
const IMAGE_CALLOUT_PANEL_PADDING = 2;
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
      : tool === 'callout'
        ? {
            ...DEFAULT_TEXT_STYLE,
            stroke: '#2563eb',
            fill: 'rgba(255,255,255,0)',
            strokeWidth: 3,
            textBackgroundColor: '#ffffff',
            textBoxMode: 'manual' as const,
          }
        : tool === 'image-callout'
          ? {
              stroke: '#2563eb',
              fill: 'rgba(255,255,255,0)',
              strokeWidth: 3,
            }
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
    case 'callout':
      return {
        ...geometry,
        target: {
          ...geometry.target,
          x: geometry.target.x + COPY_OFFSET,
          y: geometry.target.y + COPY_OFFSET,
        },
        text: {
          ...geometry.text,
          x: geometry.text.x + COPY_OFFSET,
          y: geometry.text.y + COPY_OFFSET,
        },
      };
    case 'image-callout':
      return {
        ...geometry,
        target: {
          ...geometry.target,
          x: geometry.target.x + COPY_OFFSET,
          y: geometry.target.y + COPY_OFFSET,
        },
        panel: {
          ...geometry.panel,
          x: geometry.panel.x + COPY_OFFSET,
          y: geometry.panel.y + COPY_OFFSET,
        },
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

const measureImageDataUrl = (imageDataUrl: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = reject;
    image.src = imageDataUrl;
  });

const fitImageIntoFrame = (
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
) => {
  const scale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: (frameWidth - width) / 2,
    y: (frameHeight - height) / 2,
    width,
    height,
  };
};

const createCalloutTextFrame = (target: RectGeometry): TextGeometry => {
  const preferredRightX = target.x + target.width + CALLOUT_GAP;
  const fallbackLeftX = Math.max(0, target.x - CALLOUT_TEXT_WIDTH - CALLOUT_GAP);
  const x =
    preferredRightX + CALLOUT_TEXT_WIDTH <= DOCUMENT_WIDTH ? preferredRightX : fallbackLeftX;
  const y = clamp(target.y - 4, 0, Math.max(0, DOCUMENT_HEIGHT - CALLOUT_TEXT_HEIGHT));

  return {
    kind: 'text',
    x,
    y,
    width: CALLOUT_TEXT_WIDTH,
    height: CALLOUT_TEXT_HEIGHT,
  };
};

const createCalloutGeometry = (target: RectGeometry): CalloutGeometry => ({
  kind: 'callout',
  target,
  text: createCalloutTextFrame(target),
});

const getCalloutEdgePoint = (
  source: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number; width: number; height: number },
) => {
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;
  const deltaX = targetCenterX - sourceCenterX;
  const deltaY = targetCenterY - sourceCenterY;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return {
      x: deltaX >= 0 ? source.x + source.width : source.x,
      y: sourceCenterY,
    };
  }

  return {
    x: sourceCenterX,
    y: deltaY >= 0 ? source.y + source.height : source.y,
  };
};

const getCalloutConnectorPoints = (geometry: CalloutGeometry | ImageCalloutGeometry) => {
  const panel = geometry.kind === 'callout' ? geometry.text : geometry.panel;
  const start = getCalloutEdgePoint(geometry.target, panel);
  const end = getCalloutEdgePoint(panel, geometry.target);

  return [start.x, start.y, end.x, end.y];
};

const getCalloutBounds = (geometry: CalloutGeometry) => {
  const left = Math.min(geometry.target.x, geometry.text.x);
  const top = Math.min(geometry.target.y, geometry.text.y);
  const right = Math.max(
    geometry.target.x + geometry.target.width,
    geometry.text.x + geometry.text.width,
  );
  const bottom = Math.max(
    geometry.target.y + geometry.target.height,
    geometry.text.y + geometry.text.height,
  );

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

const getRelativeCalloutGeometry = (geometry: CalloutGeometry, origin: { x: number; y: number }): CalloutGeometry => ({
  ...geometry,
  target: {
    ...geometry.target,
    x: geometry.target.x - origin.x,
    y: geometry.target.y - origin.y,
  },
  text: {
    ...geometry.text,
    x: geometry.text.x - origin.x,
    y: geometry.text.y - origin.y,
  },
});

const getImageCalloutPanelHeight = (imageWidth?: number, imageHeight?: number) => {
  if (!imageWidth || !imageHeight) {
    return IMAGE_CALLOUT_PLACEHOLDER_HEIGHT;
  }

  return clamp(
    Math.round((IMAGE_CALLOUT_PANEL_WIDTH * imageHeight) / imageWidth),
    IMAGE_CALLOUT_PANEL_MIN_HEIGHT,
    IMAGE_CALLOUT_PANEL_MAX_HEIGHT,
  );
};

const createImageCalloutPanelFrame = (
  target: RectGeometry,
  imageDimensions?: { width: number; height: number },
): RectGeometry => {
  const panelHeight = getImageCalloutPanelHeight(imageDimensions?.width, imageDimensions?.height);
  const preferredRightX = target.x + target.width + CALLOUT_GAP;
  const fallbackLeftX = Math.max(0, target.x - IMAGE_CALLOUT_PANEL_WIDTH - CALLOUT_GAP);
  const x =
    preferredRightX + IMAGE_CALLOUT_PANEL_WIDTH <= DOCUMENT_WIDTH ? preferredRightX : fallbackLeftX;
  const y = clamp(target.y - 4, 0, Math.max(0, DOCUMENT_HEIGHT - panelHeight));

  return {
    kind: 'rect',
    x,
    y,
    width: IMAGE_CALLOUT_PANEL_WIDTH,
    height: panelHeight,
  };
};

const createImageCalloutGeometry = (
  target: RectGeometry,
  imageDimensions?: { width: number; height: number },
): ImageCalloutGeometry => ({
  kind: 'image-callout',
  target,
  panel: createImageCalloutPanelFrame(target, imageDimensions),
});

const applyImageDimensionsToCalloutGeometry = (
  geometry: ImageCalloutGeometry,
  imageDimensions?: { width: number; height: number },
): ImageCalloutGeometry => {
  const panelHeight = getImageCalloutPanelHeight(imageDimensions?.width, imageDimensions?.height);

  return {
    ...geometry,
    panel: {
      ...geometry.panel,
      height: panelHeight,
      y: clamp(geometry.panel.y, 0, Math.max(0, DOCUMENT_HEIGHT - panelHeight)),
    },
  };
};

const getImageCalloutBounds = (geometry: ImageCalloutGeometry) => {
  const left = Math.min(geometry.target.x, geometry.panel.x);
  const top = Math.min(geometry.target.y, geometry.panel.y);
  const right = Math.max(
    geometry.target.x + geometry.target.width,
    geometry.panel.x + geometry.panel.width,
  );
  const bottom = Math.max(
    geometry.target.y + geometry.target.height,
    geometry.panel.y + geometry.panel.height,
  );

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

const getRelativeImageCalloutGeometry = (
  geometry: ImageCalloutGeometry,
  origin: { x: number; y: number },
): ImageCalloutGeometry => ({
  ...geometry,
  target: {
    ...geometry.target,
    x: geometry.target.x - origin.x,
    y: geometry.target.y - origin.y,
  },
  panel: {
    ...geometry.panel,
    x: geometry.panel.x - origin.x,
    y: geometry.panel.y - origin.y,
  },
});

function ImageCalloutPanel({
  src,
  panel,
}: {
  src?: string;
  panel: RectGeometry;
}) {
  const image = useLoadedImage(src);

  if (!image) {
    return (
      <>
        <Rect
          width={panel.width}
          height={panel.height}
          fill="#f8fafc"
          cornerRadius={12}
        />
        <Text
          x={14}
          y={panel.height / 2 - 8}
          width={Math.max(0, panel.width - 28)}
          text={src ? 'Loading image...' : 'Image unavailable'}
          fontSize={12}
          fill="#64748b"
          align="center"
        />
      </>
    );
  }

  const fit = fitImageIntoFrame(
    image.width,
    image.height,
    Math.max(0, panel.width - IMAGE_CALLOUT_PANEL_PADDING * 2),
    Math.max(0, panel.height - IMAGE_CALLOUT_PANEL_PADDING * 2),
  );

  return (
    <KonvaImage
      image={image}
      x={IMAGE_CALLOUT_PANEL_PADDING + fit.x}
      y={IMAGE_CALLOUT_PANEL_PADDING + fit.y}
      width={fit.width}
      height={fit.height}
      cornerRadius={11}
    />
  );
}

interface ImageCalloutDialogState {
  mode: 'create' | 'replace' | null;
  pendingGeometry: ImageCalloutGeometry | null;
  replaceAnnotationId: string | null;
}

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
  const imageCalloutFileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<any>(null);
  const hasInitializedViewRef = useRef(false);
  const imageCalloutDialogStateRef = useRef<ImageCalloutDialogState>({
    mode: null,
    pendingGeometry: null,
    replaceAnnotationId: null,
  });
  const draft = useEditorStore((state) => state.draft);
  const activeTool = useEditorStore((state) => state.activeTool);
  const selectedAnnotationId = useEditorStore((state) => state.selectedAnnotationId);
  const zoom = useEditorStore((state) => state.zoom);
  const contextMenu = useEditorStore((state) => state.contextMenu);
  const inlineTextEditor = useEditorStore((state) => state.inlineTextEditor);
  const setZoom = useEditorStore((state) => state.setZoom);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const addAnnotation = useEditorStore((state) => state.addAnnotation);
  const addImageCalloutAnnotation = useEditorStore((state) => state.addImageCalloutAnnotation);
  const updateAnnotation = useEditorStore((state) => state.updateAnnotation);
  const commitDraft = useEditorStore((state) => state.commitDraft);
  const setAssetPosition = useEditorStore((state) => state.setAssetPosition);
  const setSelectedAnnotation = useEditorStore((state) => state.setSelectedAnnotation);
  const openContextMenu = useEditorStore((state) => state.openContextMenu);
  const closeContextMenu = useEditorStore((state) => state.closeContextMenu);
  const startInlineTextCreate = useEditorStore((state) => state.startInlineTextCreate);
  const startInlineCalloutCreate = useEditorStore((state) => state.startInlineCalloutCreate);
  const startInlineTextEdit = useEditorStore((state) => state.startInlineTextEdit);
  const startInlineCalloutEdit = useEditorStore((state) => state.startInlineCalloutEdit);
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
  const [hoveredCalloutGroupId, setHoveredCalloutGroupId] = useState<string | null>(null);
  const [isDraggingCalloutGroup, setIsDraggingCalloutGroup] = useState(false);
  const [draggingCalloutTargetFrame, setDraggingCalloutTargetFrame] = useState<{
    annotationId: string;
    target: RectGeometry;
  } | null>(null);
  const [draggingCalloutTextFrame, setDraggingCalloutTextFrame] = useState<{
    annotationId: string;
    text: TextGeometry;
  } | null>(null);
  const [draggingImageCalloutPanelFrame, setDraggingImageCalloutPanelFrame] = useState<{
    annotationId: string;
    panel: RectGeometry;
  } | null>(null);
  const [pendingImageCalloutGeometry, setPendingImageCalloutGeometry] = useState<ImageCalloutGeometry | null>(null);
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
      return getContextMenuItems({ kind: 'empty-space' }, messages.contextMenu);
    }

    const annotation = draft.annotations.find((item) => item.id === target.annotationId);
    return annotation ? getContextMenuItems({ kind: 'annotation', annotation }, messages.contextMenu) : [];
  }, [contextMenu.target, draft.annotations, messages.contextMenu]);
  const embeddedAssetsById = useMemo(
    () => new Map(draft.embeddedAssets.map((asset) => [asset.id, asset])),
    [draft.embeddedAssets],
  );
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
  const selectedImageCallout = useMemo<{
    annotation: Annotation;
    geometry: ImageCalloutGeometry;
  } | null>(() => {
    if (!selectedAnnotationId) {
      return null;
    }

    const annotation = draft.annotations.find((item) => item.id === selectedAnnotationId);

    if (!annotation || annotation.tool !== 'image-callout' || annotation.geometry.kind !== 'image-callout') {
      return null;
    }

    return {
      annotation,
      geometry: annotation.geometry,
    };
  }, [draft.annotations, selectedAnnotationId]);
  const selectedImageCalloutToolbarStyle = useMemo(() => {
    if (!selectedImageCallout) {
      return null;
    }

    const { panel } = selectedImageCallout.geometry;

    return {
      left: (renderedDocumentPosition.x + panel.x) * canvasScale + layerOffsetX - scrollPosition.left,
      top: (renderedDocumentPosition.y + panel.y) * canvasScale + layerOffsetY - scrollPosition.top,
    };
  }, [
    canvasScale,
    layerOffsetX,
    layerOffsetY,
    renderedDocumentPosition.x,
    renderedDocumentPosition.y,
    scrollPosition.left,
    scrollPosition.top,
    selectedImageCallout,
  ]);
  const pendingInlineCalloutGeometry = useMemo<CalloutGeometry | null>(() => {
    if (
      !inlineTextEditor ||
      inlineTextEditor.annotationTool !== 'callout' ||
      inlineTextEditor.mode !== 'create' ||
      !inlineTextEditor.calloutTarget
    ) {
      return null;
    }

    return {
      kind: 'callout',
      target: inlineTextEditor.calloutTarget,
      text: {
        kind: 'text',
        x: inlineTextEditor.x,
        y: inlineTextEditor.y,
        width: inlineTextEditor.width,
        height: inlineTextEditor.height,
      },
    };
  }, [inlineTextEditor]);
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
    setHoveredCalloutGroupId(null);
    setIsDraggingCalloutGroup(false);
    setDraggingCalloutTargetFrame(null);
    setDraggingCalloutTextFrame(null);
    setDraggingImageCalloutPanelFrame(null);
    setPendingImageCalloutGeometry(null);
    imageCalloutDialogStateRef.current = {
      mode: null,
      pendingGeometry: null,
      replaceAnnotationId: null,
    };
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

  const resetImageCalloutDialogState = () => {
    setPendingImageCalloutGeometry(null);
    imageCalloutDialogStateRef.current = {
      mode: null,
      pendingGeometry: null,
      replaceAnnotationId: null,
    };
  };

  const openImageCalloutPicker = ({
    mode,
    geometry,
    annotationId,
  }: {
    mode: 'create' | 'replace';
    geometry: ImageCalloutGeometry;
    annotationId?: string;
  }) => {
    const input = imageCalloutFileRef.current;

    setPendingImageCalloutGeometry(mode === 'create' ? geometry : null);
    imageCalloutDialogStateRef.current = {
      mode,
      pendingGeometry: geometry,
      replaceAnnotationId: annotationId ?? null,
    };

    if (!input) {
      return;
    }

    input.value = '';
    input.click();
  };

  const handleImageCalloutFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const dialogState = imageCalloutDialogStateRef.current;
    const geometry = dialogState.pendingGeometry;
    const asset = draft.asset;

    if (!file || !geometry || !asset) {
      resetImageCalloutDialogState();
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imageDataUrl = reader.result as string;
        const dimensions = await measureImageDataUrl(imageDataUrl);
        const embeddedAsset: EmbeddedImageAsset = {
          id: createId('embedded-asset'),
          imageDataUrl,
          width: dimensions.width,
          height: dimensions.height,
          createdAt: new Date().toISOString(),
        };

        if (dialogState.mode === 'replace' && dialogState.replaceAnnotationId) {
          commitDraft((nextDraft) => {
            nextDraft.embeddedAssets.push(embeddedAsset);
            const annotation = nextDraft.annotations.find(
              (item) => item.id === dialogState.replaceAnnotationId,
            );

            if (!annotation || annotation.geometry.kind !== 'image-callout') {
              return;
            }

            annotation.imageAssetId = embeddedAsset.id;
            annotation.geometry = applyImageDimensionsToCalloutGeometry(
              annotation.geometry,
              dimensions,
            );
          });
        } else {
          const annotation: Annotation = {
            id: createId('annotation'),
            assetId: asset.id,
            tool: 'image-callout',
            geometry: applyImageDimensionsToCalloutGeometry(geometry, dimensions),
            imageAssetId: embeddedAsset.id,
            style: {
              stroke: '#2563eb',
              fill: 'rgba(255,255,255,0)',
              strokeWidth: 3,
            },
            createdAt: new Date().toISOString(),
          };

          addImageCalloutAnnotation(annotation, embeddedAsset);
          setActiveTool('select');
        }
      } finally {
        resetImageCalloutDialogState();
      }
    };
    reader.readAsDataURL(file);
  };

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

    if (activeTool === 'callout') {
      setDragStart(pointer);
      return;
    }

    if (activeTool === 'image-callout') {
      setDragStart(pointer);
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

    if (
      actionId === 'rectangle' ||
      actionId === 'arrow' ||
      actionId === 'highlight' ||
      actionId === 'marker' ||
      actionId === 'callout' ||
      actionId === 'image-callout'
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
        if (annotation.tool === 'callout') {
          startInlineCalloutEdit(annotation.id);
          return;
        }
        startInlineTextEdit(annotation.id);
        return;
      case 'replace-image':
        if (annotation.tool === 'image-callout' && annotation.geometry.kind === 'image-callout') {
          closeContextMenu();
          openImageCalloutPicker({
            mode: 'replace',
            geometry: annotation.geometry,
            annotationId: annotation.id,
          });
          return;
        }
        closeContextMenu();
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
          const usedAssetIds = new Set(
            nextDraft.annotations
              .map((item) => item.imageAssetId)
              .filter((assetId): assetId is string => Boolean(assetId)),
          );
          nextDraft.embeddedAssets = nextDraft.embeddedAssets.filter((asset) => usedAssetIds.has(asset.id));
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

  const handleReplaceImageCallout = useCallback(() => {
    if (
      !selectedImageCallout
    ) {
      return;
    }

    openImageCalloutPicker({
      mode: 'replace',
      geometry: selectedImageCallout.geometry,
      annotationId: selectedImageCallout.annotation.id,
    });
  }, [selectedImageCallout]);

  const handleCopySelectedImageCallout = useCallback(() => {
    if (!selectedImageCallout) {
      return;
    }

    commitDraft((nextDraft) => {
      const current = nextDraft.annotations.find((item) => item.id === selectedImageCallout.annotation.id);

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
  }, [commitDraft, selectedImageCallout]);

  const handleDeleteSelectedImageCallout = useCallback(() => {
    if (!selectedImageCallout) {
      return;
    }

    commitDraft((nextDraft) => {
      nextDraft.annotations = nextDraft.annotations.filter(
        (item) => item.id !== selectedImageCallout.annotation.id,
      );
      const usedAssetIds = new Set(
        nextDraft.annotations
          .map((item) => item.imageAssetId)
          .filter((assetId): assetId is string => Boolean(assetId)),
      );
      nextDraft.embeddedAssets = nextDraft.embeddedAssets.filter((asset) =>
        usedAssetIds.has(asset.id),
      );
    });
    setSelectedAnnotation(null);
  }, [commitDraft, selectedImageCallout, setSelectedAnnotation]);

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
      if (preview.tool === 'callout' && preview.geometry.kind === 'callout') {
        startInlineCalloutCreate(preview.geometry);
      } else if (preview.tool === 'image-callout' && preview.geometry.kind === 'image-callout') {
        openImageCalloutPicker({
          mode: 'create',
          geometry: preview.geometry,
        });
      } else {
        addAnnotation(preview);
      }
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
        : activeTool === 'callout'
          ? createCalloutGeometry(normalizeRect({ x1: dragStart.x, y1: dragStart.y, x2: pointer.x, y2: pointer.y }))
          : activeTool === 'image-callout'
            ? createImageCalloutGeometry(normalizeRect({ x1: dragStart.x, y1: dragStart.y, x2: pointer.x, y2: pointer.y }))
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

      case 'callout': {
        if (geometry.kind !== 'callout') {
          return null;
        }

        const isEditingCurrentCallout = inlineTextEditor?.annotationId === annotation.id;
        const renderedGeometry =
          isEditingCurrentCallout
            ? {
                ...geometry,
                text: {
                  kind: 'text' as const,
                  x: inlineTextEditor.x,
                  y: inlineTextEditor.y,
                  width: inlineTextEditor.width,
                  height: inlineTextEditor.height,
                },
              }
            : {
                ...geometry,
                ...(draggingCalloutTargetFrame?.annotationId === annotation.id
                  ? { target: draggingCalloutTargetFrame.target }
                  : {}),
                ...(draggingCalloutTextFrame?.annotationId === annotation.id
                  ? { text: draggingCalloutTextFrame.text }
                  : {}),
              };
        const calloutBounds = getCalloutBounds(renderedGeometry);
        const relativeGeometry = getRelativeCalloutGeometry(renderedGeometry, calloutBounds);
        const connectorPoints = getCalloutConnectorPoints(relativeGeometry);
        const textBackgroundColor = annotation.style.textBackgroundColor ?? '#ffffff';
        const borderColor = selected ? '#2563eb' : '#94a3b8';
        const groupX = renderedDocumentPosition.x + calloutBounds.x;
        const groupY = renderedDocumentPosition.y + calloutBounds.y;

        return (
          <Group
            key={annotation.id}
            x={groupX}
            y={groupY}
            draggable={!readOnly && activeTool === 'select' && !isPreview}
            {...commonProps}
            onMouseEnter={() => {
              if (!readOnly && activeTool === 'select' && !isEditingCurrentCallout) {
                setHoveredCalloutGroupId(annotation.id);
              }
            }}
            onMouseLeave={() => {
              if (hoveredCalloutGroupId === annotation.id) {
                setHoveredCalloutGroupId(null);
              }
            }}
            onDragStart={() => {
              setIsDraggingCalloutGroup(true);
              setHoveredCalloutGroupId(annotation.id);
            }}
            onDragEnd={(event) => {
              const pos = event.target.position();
              const deltaX = pos.x - groupX;
              const deltaY = pos.y - groupY;
              setIsDraggingCalloutGroup(false);
              setHoveredCalloutGroupId(null);
              setDraggingCalloutTargetFrame(null);
              setDraggingCalloutTextFrame(null);

              updateAnnotation(annotation.id, (current) => {
                if (current.geometry.kind === 'callout') {
                  current.geometry = {
                    ...current.geometry,
                    target: {
                      ...current.geometry.target,
                      x: current.geometry.target.x + deltaX,
                      y: current.geometry.target.y + deltaY,
                    },
                    text: {
                      ...current.geometry.text,
                      x: current.geometry.text.x + deltaX,
                      y: current.geometry.text.y + deltaY,
                    },
                  };
                }
              });
            }}
          >
            <Group
              x={relativeGeometry.target.x}
              y={relativeGeometry.target.y}
              draggable={!readOnly && activeTool === 'select' && selected && !isPreview}
              onDragStart={(event) => {
                event.cancelBubble = true;
                setSelectedAnnotation(annotation.id);
              }}
              onDragMove={(event) => {
                const position = event.target.position();
                setDraggingCalloutTargetFrame({
                  annotationId: annotation.id,
                  target: {
                    ...renderedGeometry.target,
                    x: calloutBounds.x + position.x,
                    y: calloutBounds.y + position.y,
                  },
                });
              }}
              onDragEnd={(event) => {
                event.cancelBubble = true;
                const position = event.target.position();
                setDraggingCalloutTargetFrame(null);
                updateAnnotation(annotation.id, (current) => {
                  if (current.geometry.kind === 'callout') {
                    current.geometry = {
                      ...current.geometry,
                      target: {
                        ...current.geometry.target,
                        x: calloutBounds.x + position.x,
                        y: calloutBounds.y + position.y,
                      },
                    };
                  }
                });
              }}
            >
              <Rect
                width={relativeGeometry.target.width}
                height={relativeGeometry.target.height}
                stroke={annotation.style.stroke}
                strokeWidth={(annotation.style.strokeWidth ?? 3) + (selected ? 1 : 0)}
                fill={annotation.style.fill ?? 'rgba(255,255,255,0)'}
                cornerRadius={10}
              />
            </Group>
            <Line
              points={connectorPoints}
              stroke={annotation.style.stroke}
              strokeWidth={(annotation.style.strokeWidth ?? 3) + (selected ? 1 : 0)}
              lineCap="round"
              lineJoin="round"
              hitStrokeWidth={12}
            />
            {isEditingCurrentCallout ? null : (
              <Group
                x={relativeGeometry.text.x}
                y={relativeGeometry.text.y}
                draggable={!readOnly && activeTool === 'select' && selected && !isPreview}
                onDragStart={(event) => {
                  event.cancelBubble = true;
                  setSelectedAnnotation(annotation.id);
                }}
                onDblClick={(event) => {
                  event.cancelBubble = true;
                  if (!readOnly) {
                    startInlineCalloutEdit(annotation.id);
                  }
                }}
                onDblTap={(event) => {
                  event.cancelBubble = true;
                  if (!readOnly) {
                    startInlineCalloutEdit(annotation.id);
                  }
                }}
                onDragMove={(event) => {
                  const position = event.target.position();
                  setDraggingCalloutTextFrame({
                    annotationId: annotation.id,
                    text: {
                      ...renderedGeometry.text,
                      x: calloutBounds.x + position.x,
                      y: calloutBounds.y + position.y,
                    },
                  });
                }}
                onDragEnd={(event) => {
                  event.cancelBubble = true;
                  const position = event.target.position();
                  setDraggingCalloutTextFrame(null);
                  updateAnnotation(annotation.id, (current) => {
                    if (current.geometry.kind === 'callout') {
                      current.geometry = {
                        ...current.geometry,
                        text: {
                          ...current.geometry.text,
                          x: calloutBounds.x + position.x,
                          y: calloutBounds.y + position.y,
                        },
                      };
                    }
                  });
                }}
              >
                <Rect
                  width={relativeGeometry.text.width}
                  height={relativeGeometry.text.height}
                  fill={textBackgroundColor}
                  stroke={borderColor}
                  strokeWidth={selected || isPreview ? 2 : 1}
                  cornerRadius={12}
                  shadowColor="rgba(15,23,42,0.14)"
                  shadowBlur={isPreview ? 0 : 10}
                  shadowOffsetX={0}
                  shadowOffsetY={isPreview ? 0 : 4}
                  shadowOpacity={isPreview ? 0 : 0.9}
                />
                <Text
                  x={12}
                  y={10}
                  width={Math.max(0, renderedGeometry.text.width - 24)}
                  height={Math.max(0, renderedGeometry.text.height - 20)}
                  text={annotation.label ?? ''}
                  fill={annotation.style.textColor ?? DEFAULT_TEXT_STYLE.textColor}
                  fontSize={annotation.style.fontSize ?? DEFAULT_TEXT_STYLE.fontSize}
                  fontStyle={getTextFontStyle(annotation.style)}
                  textDecoration={annotation.style.textDecoration ?? DEFAULT_TEXT_STYLE.textDecoration}
                  lineHeight={1.45}
                />
              </Group>
            )}
          </Group>
        );
      }

      case 'image-callout': {
        if (geometry.kind !== 'image-callout') {
          return null;
        }

        const renderedGeometry = {
          ...geometry,
          ...(draggingCalloutTargetFrame?.annotationId === annotation.id
            ? { target: draggingCalloutTargetFrame.target }
            : {}),
          ...(draggingImageCalloutPanelFrame?.annotationId === annotation.id
            ? { panel: draggingImageCalloutPanelFrame.panel }
            : {}),
        };
        const calloutBounds = getImageCalloutBounds(renderedGeometry);
        const relativeGeometry = getRelativeImageCalloutGeometry(renderedGeometry, calloutBounds);
        const connectorPoints = getCalloutConnectorPoints(relativeGeometry);
        const borderColor = selected ? '#2563eb' : '#94a3b8';
        const groupX = renderedDocumentPosition.x + calloutBounds.x;
        const groupY = renderedDocumentPosition.y + calloutBounds.y;
        const embeddedAsset = annotation.imageAssetId ? embeddedAssetsById.get(annotation.imageAssetId) : undefined;

        return (
          <Group
            key={annotation.id}
            x={groupX}
            y={groupY}
            draggable={!readOnly && activeTool === 'select' && !isPreview}
            {...commonProps}
            onMouseEnter={() => {
              if (!readOnly && activeTool === 'select') {
                setHoveredCalloutGroupId(annotation.id);
              }
            }}
            onMouseLeave={() => {
              if (hoveredCalloutGroupId === annotation.id) {
                setHoveredCalloutGroupId(null);
              }
            }}
            onDragStart={() => {
              setIsDraggingCalloutGroup(true);
              setHoveredCalloutGroupId(annotation.id);
            }}
            onDragEnd={(event) => {
              const pos = event.target.position();
              const deltaX = pos.x - groupX;
              const deltaY = pos.y - groupY;
              setIsDraggingCalloutGroup(false);
              setHoveredCalloutGroupId(null);
              setDraggingCalloutTargetFrame(null);
              setDraggingImageCalloutPanelFrame(null);

              updateAnnotation(annotation.id, (current) => {
                if (current.geometry.kind === 'image-callout') {
                  current.geometry = {
                    ...current.geometry,
                    target: {
                      ...current.geometry.target,
                      x: current.geometry.target.x + deltaX,
                      y: current.geometry.target.y + deltaY,
                    },
                    panel: {
                      ...current.geometry.panel,
                      x: current.geometry.panel.x + deltaX,
                      y: current.geometry.panel.y + deltaY,
                    },
                  };
                }
              });
            }}
          >
            <Group
              x={relativeGeometry.target.x}
              y={relativeGeometry.target.y}
              draggable={!readOnly && activeTool === 'select' && selected && !isPreview}
              onDragStart={(event) => {
                event.cancelBubble = true;
                setSelectedAnnotation(annotation.id);
              }}
              onDragMove={(event) => {
                const position = event.target.position();
                setDraggingCalloutTargetFrame({
                  annotationId: annotation.id,
                  target: {
                    ...renderedGeometry.target,
                    x: calloutBounds.x + position.x,
                    y: calloutBounds.y + position.y,
                  },
                });
              }}
              onDragEnd={(event) => {
                event.cancelBubble = true;
                const position = event.target.position();
                setDraggingCalloutTargetFrame(null);
                updateAnnotation(annotation.id, (current) => {
                  if (current.geometry.kind === 'image-callout') {
                    current.geometry = {
                      ...current.geometry,
                      target: {
                        ...current.geometry.target,
                        x: calloutBounds.x + position.x,
                        y: calloutBounds.y + position.y,
                      },
                    };
                  }
                });
              }}
            >
              <Rect
                width={relativeGeometry.target.width}
                height={relativeGeometry.target.height}
                stroke={annotation.style.stroke}
                strokeWidth={(annotation.style.strokeWidth ?? 3) + (selected ? 1 : 0)}
                fill={annotation.style.fill ?? 'rgba(255,255,255,0)'}
                cornerRadius={10}
              />
            </Group>
            <Line
              points={connectorPoints}
              stroke={annotation.style.stroke}
              strokeWidth={(annotation.style.strokeWidth ?? 3) + (selected ? 1 : 0)}
              lineCap="round"
              lineJoin="round"
              hitStrokeWidth={12}
            />
            <Group
              x={relativeGeometry.panel.x}
              y={relativeGeometry.panel.y}
              draggable={!readOnly && activeTool === 'select' && selected && !isPreview}
              onDragStart={(event) => {
                event.cancelBubble = true;
                setSelectedAnnotation(annotation.id);
              }}
              onDragMove={(event) => {
                const position = event.target.position();
                setDraggingImageCalloutPanelFrame({
                  annotationId: annotation.id,
                  panel: {
                    ...renderedGeometry.panel,
                    x: calloutBounds.x + position.x,
                    y: calloutBounds.y + position.y,
                  },
                });
              }}
              onDragEnd={(event) => {
                event.cancelBubble = true;
                const position = event.target.position();
                setDraggingImageCalloutPanelFrame(null);
                updateAnnotation(annotation.id, (current) => {
                  if (current.geometry.kind === 'image-callout') {
                    current.geometry = {
                      ...current.geometry,
                      panel: {
                        ...current.geometry.panel,
                        x: calloutBounds.x + position.x,
                        y: calloutBounds.y + position.y,
                      },
                    };
                  }
                });
              }}
            >
              <Rect
                width={relativeGeometry.panel.width}
                height={relativeGeometry.panel.height}
                fill="#ffffff"
                stroke={borderColor}
                strokeWidth={selected || isPreview ? 2 : 1}
                cornerRadius={12}
                shadowColor="rgba(15,23,42,0.14)"
                shadowBlur={isPreview ? 0 : 10}
                shadowOffsetX={0}
                shadowOffsetY={isPreview ? 0 : 4}
                shadowOpacity={isPreview ? 0 : 0.9}
              />
              <ImageCalloutPanel src={embeddedAsset?.imageDataUrl} panel={relativeGeometry.panel} />
            </Group>
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
            isPanning || isDraggingCalloutGroup
              ? 'cursor-grabbing'
              : hoveredCalloutGroupId && activeTool === 'select'
                ? 'cursor-move'
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
                {pendingInlineCalloutGeometry ? (
                  <Group x={renderedDocumentPosition.x} y={renderedDocumentPosition.y}>
                    <Rect
                      x={pendingInlineCalloutGeometry.target.x}
                      y={pendingInlineCalloutGeometry.target.y}
                      width={pendingInlineCalloutGeometry.target.width}
                      height={pendingInlineCalloutGeometry.target.height}
                      stroke="#2563eb"
                      strokeWidth={3}
                      cornerRadius={10}
                      fill="rgba(255,255,255,0)"
                    />
                    <Line
                      points={getCalloutConnectorPoints(pendingInlineCalloutGeometry)}
                      stroke="#2563eb"
                      strokeWidth={3}
                      lineCap="round"
                      lineJoin="round"
                    />
                  </Group>
                ) : null}
                {pendingImageCalloutGeometry ? (
                  <Group x={renderedDocumentPosition.x} y={renderedDocumentPosition.y}>
                    <Rect
                      x={pendingImageCalloutGeometry.target.x}
                      y={pendingImageCalloutGeometry.target.y}
                      width={pendingImageCalloutGeometry.target.width}
                      height={pendingImageCalloutGeometry.target.height}
                      stroke="#2563eb"
                      strokeWidth={3}
                      cornerRadius={10}
                      fill="rgba(255,255,255,0)"
                    />
                    <Line
                      points={getCalloutConnectorPoints(pendingImageCalloutGeometry)}
                      stroke="#2563eb"
                      strokeWidth={3}
                      lineCap="round"
                      lineJoin="round"
                    />
                    <Rect
                      x={pendingImageCalloutGeometry.panel.x}
                      y={pendingImageCalloutGeometry.panel.y}
                      width={pendingImageCalloutGeometry.panel.width}
                      height={pendingImageCalloutGeometry.panel.height}
                      fill="#ffffff"
                      stroke="#2563eb"
                      strokeWidth={2}
                      cornerRadius={12}
                      shadowColor="rgba(15,23,42,0.14)"
                      shadowBlur={10}
                      shadowOffsetX={0}
                      shadowOffsetY={4}
                      shadowOpacity={0.9}
                    />
                    <Text
                      x={pendingImageCalloutGeometry.panel.x + 14}
                      y={pendingImageCalloutGeometry.panel.y + pendingImageCalloutGeometry.panel.height / 2 - 8}
                      width={Math.max(0, pendingImageCalloutGeometry.panel.width - 28)}
                      text="Select image"
                      fontSize={12}
                      fill="#64748b"
                      align="center"
                    />
                  </Group>
                ) : null}
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
            allowHeightShrink={inlineTextEditor.annotationTool === 'callout'}
            minimumHeight={inlineTextEditor.annotationTool === 'callout' ? CALLOUT_TEXT_HEIGHT : 24}
          />
        ) : null}

        {selectedImageCallout && selectedImageCalloutToolbarStyle && !readOnly && activeTool === 'select' ? (
          <FloatingImageCalloutToolbar
            isOpen
            style={selectedImageCalloutToolbarStyle}
            replaceLabel={messages.contextMenu.replaceImage}
            copyLabel={messages.contextMenu.copy}
            deleteLabel={messages.contextMenu.delete}
            onReplace={handleReplaceImageCallout}
            onCopy={handleCopySelectedImageCallout}
            onDelete={handleDeleteSelectedImageCallout}
          />
        ) : null}

        <input
          ref={imageCalloutFileRef}
          className="hidden"
          type="file"
          accept="image/*"
          onChange={handleImageCalloutFileChange}
        />

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


