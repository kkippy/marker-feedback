import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEventHandler } from 'react';
import { useWheel } from '@use-gesture/react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Arrow, Circle, Group, Image as KonvaImage, Layer, Line as KonvaLine, Rect, Stage, Text } from 'react-konva';
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
import { BASE_TEXT_LINE_HEIGHT, getTextContentFrame } from '@/lib/textFrameLayout';
import { DEFAULT_TEXT_STYLE, useEditorStore } from '@/lib/useEditorStore';
import {
  toDocumentLocalPoint,
  toDocumentLocalPointFromViewport,
  toWorkspacePointFromViewport,
} from './annotationCoordinates';
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
import { FloatingImageCalloutToolbar } from './FloatingImageCalloutToolbar';
import { InlineTextEditor } from './InlineTextEditor';
import {
  RECT_RESIZE_HANDLES,
  getRectEdgeHandleFrame,
  getRectHandleCursor,
  getRectHandleDragOrigin,
  getRectHandlePosition,
  getRectResizePreviewForHandle,
  type RectResizeHandle,
} from './rectResizeGeometry';
import { getNextToolAfterCanvasCreate } from './singleUseCanvasTools';

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
const MIN_RECT_EDIT_WIDTH = 24;
const MIN_RECT_EDIT_HEIGHT = 24;
const HIGHLIGHT_FILL_ALPHA = 0.25;

interface LineEditPreview {
  annotationId: string;
  points: [number, number, number, number];
}

interface LineDragPreview {
  annotationId: string;
  dx: number;
  dy: number;
}

interface RectangleEditPreview {
  annotationId: string;
  geometry: RectGeometry;
}

interface RectResizeDragState {
  annotationId: string;
  handle: RectResizeHandle;
  startGeometry: RectGeometry;
  startPointer: { x: number; y: number };
}

type LineMarkerStyle = NonNullable<Annotation['style']['lineStartMarker']>;
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
        : tool === 'rectangle'
          ? {
              stroke: '#ef4444',
              fill: 'rgba(255,255,255,0)',
              strokeWidth: 3,
              lineDash: 'solid' as const,
              lineDashSize: 0,
            }
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

const normalizeHexColorValue = (value: string) => {
  const cleaned = value.trim().replace(/[^0-9a-fA-F]/g, '').slice(0, 6);

  if (!cleaned) {
    return '#000000';
  }

  if (cleaned.length === 3) {
    return `#${cleaned
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`.toLowerCase();
  }

  return `#${cleaned.padEnd(6, '0')}`.toLowerCase();
};

const hexToRgba = (value: string, alpha: number) => {
  const normalized = normalizeHexColorValue(value);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  return `rgba(${red},${green},${blue},${alpha})`;
};

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

const getLineBounds = (points: [number, number, number, number], padding = 12) => {
  const minX = Math.min(points[0], points[2]) - padding;
  const minY = Math.min(points[1], points[3]) - padding;
  const maxX = Math.max(points[0], points[2]) + padding;
  const maxY = Math.max(points[1], points[3]) + padding;

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

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

interface ExportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const expandBounds = (bounds: ExportBounds, padding: number): ExportBounds => ({
  x: bounds.x - padding,
  y: bounds.y - padding,
  width: bounds.width + padding * 2,
  height: bounds.height + padding * 2,
});

const unionBounds = (left: ExportBounds, right: ExportBounds): ExportBounds => {
  const minX = Math.min(left.x, right.x);
  const minY = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

const getAnnotationExportBounds = (annotation: Annotation): ExportBounds | null => {
  const strokeWidth = annotation.style.strokeWidth ?? 0;
  const strokePadding = Math.max(4, strokeWidth / 2);

  switch (annotation.tool) {
    case 'rectangle':
    case 'highlight':
    case 'blur':
      if (annotation.geometry.kind !== 'rect') {
        return null;
      }

      return expandBounds({
        x: annotation.geometry.x,
        y: annotation.geometry.y,
        width: annotation.geometry.width,
        height: annotation.geometry.height,
      }, strokePadding);

    case 'line':
      if (annotation.geometry.kind !== 'line') {
        return null;
      }

      return getLineBounds(annotation.geometry.points, Math.max(12, strokeWidth * 3));

    case 'arrow':
      if (annotation.geometry.kind !== 'arrow') {
        return null;
      }

      return getLineBounds(annotation.geometry.points, Math.max(16, strokeWidth * 4));

    case 'marker':
      if (annotation.geometry.kind !== 'marker') {
        return null;
      }

      return {
        x: annotation.geometry.x - 16,
        y: annotation.geometry.y - 16,
        width: 32,
        height: 32,
      };

    case 'text':
      if (annotation.geometry.kind !== 'text') {
        return null;
      }

      return {
        x: annotation.geometry.x,
        y: annotation.geometry.y,
        width: annotation.geometry.width,
        height: annotation.geometry.height,
      };

    case 'callout':
      return annotation.geometry.kind === 'callout'
        ? expandBounds(getCalloutBounds(annotation.geometry), strokePadding)
        : null;

    case 'image-callout':
      return annotation.geometry.kind === 'image-callout'
        ? expandBounds(getImageCalloutBounds(annotation.geometry), strokePadding)
        : null;

    default:
      return null;
  }
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
  onExportReady?: (exporter: () => Promise<string | undefined>) => void;
}) {
  const { messages } = useLocale();
  const frameRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const imageCalloutFileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
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
  const [hoveredTextAnnotationId, setHoveredTextAnnotationId] = useState<string | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingArrowId, setEditingArrowId] = useState<string | null>(null);
  const [editingRectangleId, setEditingRectangleId] = useState<string | null>(null);
  const [editingCalloutTargetId, setEditingCalloutTargetId] = useState<string | null>(null);
  const [editingImageCalloutPanelId, setEditingImageCalloutPanelId] = useState<string | null>(null);
  const [lineEditPreview, setLineEditPreview] = useState<LineEditPreview | null>(null);
  const [lineDragPreview, setLineDragPreview] = useState<LineDragPreview | null>(null);
  const [draggingLineHandleId, setDraggingLineHandleId] = useState<string | null>(null);
  const [arrowEditPreview, setArrowEditPreview] = useState<LineEditPreview | null>(null);
  const [arrowDragPreview, setArrowDragPreview] = useState<LineDragPreview | null>(null);
  const [draggingArrowHandleId, setDraggingArrowHandleId] = useState<string | null>(null);
  const [rectangleEditPreview, setRectangleEditPreview] = useState<RectangleEditPreview | null>(null);
  const [lineToolbarReference, setLineToolbarReference] = useState<HTMLDivElement | null>(null);
  const rectResizeDragStateRef = useRef<RectResizeDragState | null>(null);
  const [calloutColorToolbarReference, setCalloutColorToolbarReference] = useState<HTMLDivElement | null>(null);
  const [hoveredCalloutGroupId, setHoveredCalloutGroupId] = useState<string | null>(null);
  const [isDraggingCalloutGroup, setIsDraggingCalloutGroup] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
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
  const exportAnimationFrameRef = useRef<number | null>(null);
  const pendingExportRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    pixelRatio: number;
    resolve: (png: string | undefined) => void;
  } | null>(null);
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
  const exportDocumentBounds = useMemo(() => {
    if (!imageBounds) {
      return null;
    }

    const imageExportBounds: ExportBounds = {
      x: imageBounds.x,
      y: imageBounds.y,
      width: imageBounds.width,
      height: imageBounds.height,
    };

    return draft.annotations.reduce<ExportBounds>((bounds, annotation) => {
      const annotationBounds = getAnnotationExportBounds(annotation);
      return annotationBounds ? unionBounds(bounds, annotationBounds) : bounds;
    }, imageExportBounds);
  }, [draft.annotations, imageBounds]);
  const exportCrop = useMemo(() => {
    if (!draft.asset || !exportDocumentBounds) {
      return null;
    }

    const width = exportDocumentBounds.width * canvasScale;
    const height = exportDocumentBounds.height * canvasScale;

    if (width <= 0 || height <= 0) {
      return null;
    }

    return {
      x: layerOffsetX - scrollPosition.left + (documentPosition.x + exportDocumentBounds.x) * canvasScale,
      y: layerOffsetY - scrollPosition.top + (documentPosition.y + exportDocumentBounds.y) * canvasScale,
      width,
      height,
      pixelRatio: imageBounds.width > 0 ? draft.asset.width / (imageBounds.width * canvasScale) : 1,
    };
  }, [
    canvasScale,
    documentPosition.x,
    documentPosition.y,
    draft.asset,
    exportDocumentBounds,
    imageBounds?.width,
    layerOffsetX,
    layerOffsetY,
    scrollPosition.left,
    scrollPosition.top,
  ]);
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
  const editingLineOffset = useMemo(
    () =>
      lineDragPreview?.annotationId === editingLineId
        ? { x: lineDragPreview.dx, y: lineDragPreview.dy }
        : { x: 0, y: 0 },
    [editingLineId, lineDragPreview],
  );
  const editingArrowAnnotation = useMemo(() => {
    if (!editingArrowId) {
      return null;
    }

    const annotation = draft.annotations.find((item) => item.id === editingArrowId);
    return annotation?.tool === 'arrow' && annotation.geometry.kind === 'arrow' ? annotation : null;
  }, [draft.annotations, editingArrowId]);
  const editingArrowPoints = useMemo(() => {
    if (!editingArrowAnnotation) {
      return null;
    }

    const geometry = editingArrowAnnotation.geometry;

    if (geometry.kind !== 'arrow') {
      return null;
    }

    return arrowEditPreview?.annotationId === editingArrowAnnotation.id
      ? arrowEditPreview.points
      : geometry.points;
  }, [arrowEditPreview, editingArrowAnnotation]);
  const editingArrowOffset = useMemo(
    () =>
      arrowDragPreview?.annotationId === editingArrowId
        ? { x: arrowDragPreview.dx, y: arrowDragPreview.dy }
        : { x: 0, y: 0 },
    [arrowDragPreview, editingArrowId],
  );
  const editingRectangleAnnotation = useMemo(() => {
    if (!editingRectangleId) {
      return null;
    }

    const annotation = draft.annotations.find((item) => item.id === editingRectangleId);
    return annotation &&
      (annotation.tool === 'rectangle' || annotation.tool === 'highlight') &&
      annotation.geometry.kind === 'rect'
      ? annotation
      : null;
  }, [draft.annotations, editingRectangleId]);
  const editingRectangleGeometry = useMemo<RectGeometry | null>(() => {
    if (!editingRectangleAnnotation) {
      return null;
    }

    const geometry = editingRectangleAnnotation.geometry;

    if (geometry.kind !== 'rect') {
      return null;
    }

    return rectangleEditPreview?.annotationId === editingRectangleAnnotation.id
      ? rectangleEditPreview.geometry
      : geometry;
  }, [editingRectangleAnnotation, rectangleEditPreview]);

  const lineToolbarRect = useMemo(() => {
    if (!editingLinePoints || readOnly) {
      return null;
    }

    const bounds = getLineBounds(editingLinePoints);

    return {
      left:
        layerOffsetX -
        scrollPosition.left +
        (renderedDocumentPosition.x + editingLineOffset.x + bounds.x) * canvasScale,
      top:
        layerOffsetY -
        scrollPosition.top +
        (renderedDocumentPosition.y + editingLineOffset.y + bounds.y) * canvasScale,
      width: bounds.width * canvasScale,
      height: bounds.height * canvasScale,
    };
  }, [
    canvasScale,
    editingLineOffset.x,
    editingLineOffset.y,
    editingLinePoints,
    layerOffsetX,
    layerOffsetY,
    readOnly,
    renderedDocumentPosition.x,
    renderedDocumentPosition.y,
    scrollPosition.left,
    scrollPosition.top,
  ]);
  const arrowToolbarRect = useMemo(() => {
    if (!editingArrowPoints || readOnly) {
      return null;
    }

    const bounds = getLineBounds(editingArrowPoints);

    return {
      left:
        layerOffsetX -
        scrollPosition.left +
        (renderedDocumentPosition.x + editingArrowOffset.x + bounds.x) * canvasScale,
      top:
        layerOffsetY -
        scrollPosition.top +
        (renderedDocumentPosition.y + editingArrowOffset.y + bounds.y) * canvasScale,
      width: bounds.width * canvasScale,
      height: bounds.height * canvasScale,
    };
  }, [
    canvasScale,
    editingArrowOffset.x,
    editingArrowOffset.y,
    editingArrowPoints,
    layerOffsetX,
    layerOffsetY,
    readOnly,
    renderedDocumentPosition.x,
    renderedDocumentPosition.y,
    scrollPosition.left,
    scrollPosition.top,
  ]);
  const rectangleToolbarRect = useMemo(() => {
    if (!editingRectangleGeometry || readOnly) {
      return null;
    }

    const { x, y, width, height } = editingRectangleGeometry;

    return {
      left:
        layerOffsetX -
        scrollPosition.left +
        (renderedDocumentPosition.x + x) * canvasScale,
      top:
        layerOffsetY -
        scrollPosition.top +
        (renderedDocumentPosition.y + y) * canvasScale,
      width: width * canvasScale,
      height: height * canvasScale,
    };
  }, [
    canvasScale,
    editingRectangleGeometry,
    layerOffsetX,
    layerOffsetY,
    readOnly,
    renderedDocumentPosition.x,
    renderedDocumentPosition.y,
    scrollPosition.left,
    scrollPosition.top,
  ]);
  const embeddedAssetsById = useMemo(
    () => new Map(draft.embeddedAssets.map((asset) => [asset.id, asset])),
    [draft.embeddedAssets],
  );
  const selectedTextCallout = useMemo<{
    annotation: Annotation;
    geometry: CalloutGeometry;
  } | null>(() => {
    if (!selectedAnnotationId) {
      return null;
    }

    const annotation = draft.annotations.find((item) => item.id === selectedAnnotationId);

    if (!annotation || annotation.tool !== 'callout' || annotation.geometry.kind !== 'callout') {
      return null;
    }

    const geometry = {
      ...annotation.geometry,
      ...(draggingCalloutTargetFrame?.annotationId === annotation.id
        ? { target: draggingCalloutTargetFrame.target }
        : {}),
      ...(draggingCalloutTextFrame?.annotationId === annotation.id
        ? { text: draggingCalloutTextFrame.text }
        : {}),
    };

    return {
      annotation,
      geometry,
    };
  }, [draft.annotations, draggingCalloutTargetFrame, draggingCalloutTextFrame, selectedAnnotationId]);
  const editingCalloutTargetAnnotation = useMemo<{
    annotation: Annotation;
    target: RectGeometry;
  } | null>(() => {
    if (!editingCalloutTargetId) {
      return null;
    }

    const annotation = draft.annotations.find((item) => item.id === editingCalloutTargetId);

    if (!annotation) {
      return null;
    }

    if (annotation.tool === 'callout' && annotation.geometry.kind === 'callout') {
      return {
        annotation,
        target:
          draggingCalloutTargetFrame?.annotationId === annotation.id
            ? draggingCalloutTargetFrame.target
            : annotation.geometry.target,
      };
    }

    if (annotation.tool === 'image-callout' && annotation.geometry.kind === 'image-callout') {
      return {
        annotation,
        target:
          draggingCalloutTargetFrame?.annotationId === annotation.id
            ? draggingCalloutTargetFrame.target
            : annotation.geometry.target,
      };
    }

    return null;
  }, [draft.annotations, draggingCalloutTargetFrame, editingCalloutTargetId]);
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
      geometry: {
        ...annotation.geometry,
        ...(draggingCalloutTargetFrame?.annotationId === annotation.id
          ? { target: draggingCalloutTargetFrame.target }
          : {}),
        ...(draggingImageCalloutPanelFrame?.annotationId === annotation.id
          ? { panel: draggingImageCalloutPanelFrame.panel }
          : {}),
      },
    };
  }, [draft.annotations, draggingCalloutTargetFrame, draggingImageCalloutPanelFrame, selectedAnnotationId]);
  const editingImageCalloutPanel = useMemo<{
    annotation: Annotation;
    geometry: ImageCalloutGeometry;
  } | null>(() => {
    if (!editingImageCalloutPanelId) {
      return null;
    }

    const annotation = draft.annotations.find((item) => item.id === editingImageCalloutPanelId);

    if (!annotation || annotation.tool !== 'image-callout' || annotation.geometry.kind !== 'image-callout') {
      return null;
    }

    return {
      annotation,
      geometry: {
        ...annotation.geometry,
        ...(draggingCalloutTargetFrame?.annotationId === annotation.id
          ? { target: draggingCalloutTargetFrame.target }
          : {}),
        ...(draggingImageCalloutPanelFrame?.annotationId === annotation.id
          ? { panel: draggingImageCalloutPanelFrame.panel }
          : {}),
      },
    };
  }, [draft.annotations, draggingCalloutTargetFrame, draggingImageCalloutPanelFrame, editingImageCalloutPanelId]);
  const selectedCalloutColorToolbarRect = useMemo(() => {
    if (!editingCalloutTargetAnnotation) {
      return null;
    }

    return {
      left:
        (renderedDocumentPosition.x + editingCalloutTargetAnnotation.target.x) * canvasScale +
        layerOffsetX -
        scrollPosition.left,
      top:
        (renderedDocumentPosition.y + editingCalloutTargetAnnotation.target.y) * canvasScale +
        layerOffsetY -
        scrollPosition.top,
      width: editingCalloutTargetAnnotation.target.width * canvasScale,
      height: editingCalloutTargetAnnotation.target.height * canvasScale,
    };
  }, [
    canvasScale,
    editingCalloutTargetAnnotation,
    layerOffsetX,
    layerOffsetY,
    renderedDocumentPosition.x,
    renderedDocumentPosition.y,
    scrollPosition.left,
    scrollPosition.top,
  ]);
  const selectedImageCalloutToolbarStyle = useMemo(() => {
    if (!editingImageCalloutPanel) {
      return null;
    }

    const { panel } = editingImageCalloutPanel.geometry;

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
    editingImageCalloutPanel,
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
    setEditingRectangleId(null);
    setEditingCalloutTargetId(null);
    setEditingImageCalloutPanelId(null);
    setLineEditPreview(null);
    setLineDragPreview(null);
    setDraggingLineHandleId(null);
    setRectangleEditPreview(null);
    zoomPreviewRef.current = null;
    clearZoomPreviewCommitTimeout();
    resetCanvasViewportSnapshot();
    setHoveredCalloutGroupId(null);
    setIsDraggingCalloutGroup(false);
    setDraggingCalloutTargetFrame(null);
    setDraggingCalloutTextFrame(null);
    setDraggingImageCalloutPanelFrame(null);
    setEditingArrowId(null);
    setArrowEditPreview(null);
    setArrowDragPreview(null);
    setDraggingArrowHandleId(null);
    setPendingImageCalloutGeometry(null);
    imageCalloutDialogStateRef.current = {
      mode: null,
      pendingGeometry: null,
      replaceAnnotationId: null,
    };
    setDisplayZoom(zoom);
  }, [clearZoomPreviewCommitTimeout, draft.asset?.id]);

  useEffect(() => {
    if (!editingLineId) {
      return;
    }

    if (selectedAnnotationId !== editingLineId || !editingLineAnnotation) {
      setEditingLineId(null);
      setLineEditPreview(null);
      setLineDragPreview(null);
      setDraggingLineHandleId(null);
    }
  }, [editingLineAnnotation, editingLineId, selectedAnnotationId]);

  useEffect(() => {
    if (!editingArrowId) {
      return;
    }

    if (selectedAnnotationId !== editingArrowId || !editingArrowAnnotation) {
      setEditingArrowId(null);
      setArrowEditPreview(null);
      setArrowDragPreview(null);
      setDraggingArrowHandleId(null);
    }
  }, [editingArrowAnnotation, editingArrowId, selectedAnnotationId]);

  useEffect(() => {
    if (!editingRectangleId) {
      return;
    }

    if (selectedAnnotationId !== editingRectangleId || !editingRectangleAnnotation) {
      setEditingRectangleId(null);
      setRectangleEditPreview(null);
    }
  }, [editingRectangleAnnotation, editingRectangleId, selectedAnnotationId]);

  useEffect(() => {
    if (!editingCalloutTargetId) {
      return;
    }

    if (selectedAnnotationId !== editingCalloutTargetId || !editingCalloutTargetAnnotation) {
      setEditingCalloutTargetId(null);
    }
  }, [editingCalloutTargetAnnotation, editingCalloutTargetId, selectedAnnotationId]);

  useEffect(() => {
    if (!editingImageCalloutPanelId) {
      return;
    }

    if (selectedAnnotationId !== editingImageCalloutPanelId || !editingImageCalloutPanel) {
      setEditingImageCalloutPanelId(null);
    }
  }, [editingImageCalloutPanel, editingImageCalloutPanelId, selectedAnnotationId]);

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

  const deleteAnnotationById = useCallback((annotationId: string) => {
    commitDraft((nextDraft) => {
      nextDraft.annotations = nextDraft.annotations.filter((item) => item.id !== annotationId);
      const usedAssetIds = new Set(
        nextDraft.annotations
          .map((item) => item.imageAssetId)
          .filter((assetId): assetId is string => Boolean(assetId)),
      );
      nextDraft.embeddedAssets = nextDraft.embeddedAssets.filter((asset) => usedAssetIds.has(asset.id));
    });

    if (annotationId === editingLineId) {
      setEditingLineId(null);
      setLineEditPreview(null);
      setLineDragPreview(null);
      setDraggingLineHandleId(null);
    }

    if (annotationId === editingArrowId) {
      setEditingArrowId(null);
      setArrowEditPreview(null);
      setArrowDragPreview(null);
      setDraggingArrowHandleId(null);
    }

    if (annotationId === editingRectangleId) {
      setEditingRectangleId(null);
      setRectangleEditPreview(null);
    }

    if (annotationId === editingCalloutTargetId) {
      setEditingCalloutTargetId(null);
    }

    if (annotationId === editingImageCalloutPanelId) {
      setEditingImageCalloutPanelId(null);
    }

    if (inlineTextEditor?.annotationId === annotationId) {
      cancelInlineTextEditor();
    }

    if (selectedAnnotationId === annotationId) {
      setSelectedAnnotation(null);
    }
  }, [
    cancelInlineTextEditor,
    commitDraft,
    editingCalloutTargetId,
    editingArrowId,
    editingImageCalloutPanelId,
    editingLineId,
    editingRectangleId,
    inlineTextEditor,
    selectedAnnotationId,
    setSelectedAnnotation,
  ]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        (event.key === 'Delete' || event.key === 'Backspace')
      ) {
        if (!selectedAnnotationId) {
          return;
        }

        event.preventDefault();
        closeContextMenu();
        deleteAnnotationById(selectedAnnotationId);
        return;
      }

      if (event.code !== 'Space') {
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
  }, [clampScrollPosition, closeContextMenu, committedViewportMetrics, deleteAnnotationById, selectedAnnotationId]);

  useEffect(() => {
    onExportReady?.(async () => {
      if (!image || !layerRef.current || !exportCrop) {
        return undefined;
      }

      return new Promise((resolve) => {
        pendingExportRef.current = {
          ...exportCrop,
          resolve,
        };
        setIsExportingPng(true);
      });
    });
  }, [exportCrop, image, onExportReady]);

  useEffect(() => {
    if (!isExportingPng || !pendingExportRef.current) {
      return undefined;
    }

    exportAnimationFrameRef.current = window.requestAnimationFrame(() => {
      const pendingExport = pendingExportRef.current;

      pendingExportRef.current = null;
      exportAnimationFrameRef.current = null;

      const png = pendingExport
        ? layerRef.current?.toDataURL({
            x: pendingExport.x,
            y: pendingExport.y,
            width: pendingExport.width,
            height: pendingExport.height,
            pixelRatio: pendingExport.pixelRatio,
          })
        : undefined;

      pendingExport?.resolve(png);
      setIsExportingPng(false);
    });

    return () => {
      if (exportAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(exportAnimationFrameRef.current);
        exportAnimationFrameRef.current = null;
      }
    };
  }, [isExportingPng]);

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
  const getPointerFromClient = (clientX: number, clientY: number, restrictToDocument = false) => {
    const viewport = zoomPreviewRef.current ?? viewportMetricsRef.current ?? committedViewportMetrics;

    if (!viewport.canvasScale) {
      return null;
    }

    const logicalPoint = toWorkspacePointFromViewport({
      framePoint: getFramePosition(clientX, clientY),
      viewport,
    });

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

    return toDocumentLocalPointFromViewport({
      framePoint: getFramePosition(clientX, clientY),
      viewport,
      documentPosition: renderedDocumentPosition,
    });
  };
  const setCanvasCursor = useCallback((cursor: string) => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    stage.container().style.cursor = cursor;
  }, []);

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
      setActiveTool(getNextToolAfterCanvasCreate(activeTool));
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

    if (annotation.id !== editingLineId) {
      setEditingLineId(null);
      setLineEditPreview(null);
      setLineDragPreview(null);
    }
    if (annotation.id !== editingArrowId) {
      setEditingArrowId(null);
      setArrowEditPreview(null);
      setArrowDragPreview(null);
      setDraggingArrowHandleId(null);
    }
    if (annotation.id !== editingRectangleId) {
      setEditingRectangleId(null);
      setRectangleEditPreview(null);
    }
    if (annotation.id !== editingCalloutTargetId) {
      setEditingCalloutTargetId(null);
    }
    if (annotation.id !== editingImageCalloutPanelId) {
      setEditingImageCalloutPanelId(null);
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
    setDraggingLineHandleId(null);
    setEditingArrowId(null);
    setArrowEditPreview(null);
    setArrowDragPreview(null);
    setDraggingArrowHandleId(null);
    setEditingRectangleId(null);
    setRectangleEditPreview(null);
    setEditingLineId(annotationId);
    setLineEditPreview(null);
    setLineDragPreview(null);
  }, [setActiveTool, setSelectedAnnotation]);

  const startArrowEditing = useCallback((annotationId: string) => {
    setActiveTool('select');
    setSelectedAnnotation(annotationId);
    setEditingLineId(null);
    setLineEditPreview(null);
    setLineDragPreview(null);
    setDraggingLineHandleId(null);
    setEditingRectangleId(null);
    setRectangleEditPreview(null);
    setEditingArrowId(annotationId);
    setArrowEditPreview(null);
    setArrowDragPreview(null);
    setDraggingArrowHandleId(null);
  }, [setActiveTool, setSelectedAnnotation]);

  const startRectangleEditing = useCallback((annotationId: string) => {
    setActiveTool('select');
    setSelectedAnnotation(annotationId);
    setEditingLineId(null);
    setLineEditPreview(null);
    setLineDragPreview(null);
    setDraggingLineHandleId(null);
    setEditingArrowId(null);
    setArrowEditPreview(null);
    setArrowDragPreview(null);
    setDraggingArrowHandleId(null);
    setEditingRectangleId(annotationId);
    setRectangleEditPreview(null);
  }, [setActiveTool, setSelectedAnnotation]);

  const startCalloutTargetEditing = useCallback((annotationId: string) => {
    setActiveTool('select');
    setSelectedAnnotation(annotationId);
    setEditingLineId(null);
    setLineEditPreview(null);
    setLineDragPreview(null);
    setDraggingLineHandleId(null);
    setEditingArrowId(null);
    setArrowEditPreview(null);
    setArrowDragPreview(null);
    setDraggingArrowHandleId(null);
    setEditingRectangleId(null);
    setRectangleEditPreview(null);
    setEditingCalloutTargetId(annotationId);
    setEditingImageCalloutPanelId(null);
  }, [setActiveTool, setSelectedAnnotation]);

  const startImageCalloutPanelEditing = useCallback((annotationId: string) => {
    setActiveTool('select');
    setSelectedAnnotation(annotationId);
    setEditingLineId(null);
    setLineEditPreview(null);
    setLineDragPreview(null);
    setDraggingLineHandleId(null);
    setEditingArrowId(null);
    setArrowEditPreview(null);
    setArrowDragPreview(null);
    setDraggingArrowHandleId(null);
    setEditingRectangleId(null);
    setRectangleEditPreview(null);
    setEditingCalloutTargetId(null);
    setEditingImageCalloutPanelId(annotationId);
  }, [setActiveTool, setSelectedAnnotation]);

  const clearCanvasSelection = useCallback(() => {
    setEditingLineId(null);
    setDraggingLineHandleId(null);
    setEditingArrowId(null);
    setEditingRectangleId(null);
    setEditingCalloutTargetId(null);
    setEditingImageCalloutPanelId(null);
    setLineEditPreview(null);
    setLineDragPreview(null);
    setArrowEditPreview(null);
    setArrowDragPreview(null);
    setDraggingArrowHandleId(null);
    setRectangleEditPreview(null);
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

  const updateEditingArrowStyle = useCallback((patch: Partial<Annotation['style']>) => {
    if (!editingArrowAnnotation) {
      return;
    }

    updateAnnotation(editingArrowAnnotation.id, (current) => {
      if (current.tool !== 'arrow' || current.geometry.kind !== 'arrow') {
        return;
      }

      current.style = {
        ...current.style,
        ...patch,
      };
    });
  }, [editingArrowAnnotation, updateAnnotation]);

  const updateEditingRectangleStyle = useCallback((patch: Partial<Annotation['style']>) => {
    if (!editingRectangleAnnotation) {
      return;
    }

    updateAnnotation(editingRectangleAnnotation.id, (current) => {
      if (current.tool !== 'rectangle' || current.geometry.kind !== 'rect') {
        return;
      }

      current.style = {
        ...current.style,
        ...patch,
        fill: 'rgba(255,255,255,0)',
      };
    });
  }, [editingRectangleAnnotation, updateAnnotation]);
  const updateEditingHighlightStyle = useCallback((patch: Partial<Annotation['style']>) => {
    if (!editingRectangleAnnotation) {
      return;
    }

    updateAnnotation(editingRectangleAnnotation.id, (current) => {
      if (current.tool !== 'highlight' || current.geometry.kind !== 'rect') {
        return;
      }

      current.style = {
        ...current.style,
        ...patch,
        fill: patch.fill ? hexToRgba(patch.fill, HIGHLIGHT_FILL_ALPHA) : current.style.fill,
      };
    });
  }, [editingRectangleAnnotation, updateAnnotation]);
  const commitRectGeometry = useCallback((annotationId: string, geometry: RectGeometry) => {
    updateAnnotation(annotationId, (current) => {
      if (current.geometry.kind !== 'rect') {
        return;
      }

      current.geometry = geometry;
    });
    setRectangleEditPreview(null);
  }, [updateAnnotation]);
  const commitCalloutTargetGeometry = useCallback((annotationId: string, geometry: RectGeometry) => {
    updateAnnotation(annotationId, (current) => {
      if (current.tool === 'callout' && current.geometry.kind === 'callout') {
        current.geometry = {
          ...current.geometry,
          target: geometry,
        };
        return;
      }

      if (current.tool === 'image-callout' && current.geometry.kind === 'image-callout') {
        current.geometry = {
          ...current.geometry,
          target: geometry,
        };
      }
    });
    setDraggingCalloutTargetFrame(null);
  }, [updateAnnotation]);
  const commitImageCalloutPanelGeometry = useCallback((annotationId: string, geometry: RectGeometry) => {
    updateAnnotation(annotationId, (current) => {
      if (current.tool !== 'image-callout' || current.geometry.kind !== 'image-callout') {
        return;
      }

      current.geometry = {
        ...current.geometry,
        panel: geometry,
      };
    });
    setDraggingImageCalloutPanelFrame(null);
  }, [updateAnnotation]);
  const updateSelectedCalloutColor = useCallback((patch: Partial<Annotation['style']>) => {
    const annotationId = editingCalloutTargetAnnotation?.annotation.id;

    if (!annotationId) {
      return;
    }

    updateAnnotation(annotationId, (current) => {
      if (current.tool !== 'callout' && current.tool !== 'image-callout') {
        return;
      }

      current.style = {
        ...current.style,
        ...patch,
      };
    });
  }, [editingCalloutTargetAnnotation?.annotation.id, updateAnnotation]);

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
    setLineDragPreview(null);
    setDraggingLineHandleId(null);
  }, [updateAnnotation]);
  const commitArrowPoints = useCallback((annotationId: string, points: [number, number, number, number]) => {
    updateAnnotation(annotationId, (current) => {
      if (current.tool !== 'arrow' || current.geometry.kind !== 'arrow') {
        return;
      }

      current.geometry = {
        ...current.geometry,
        points,
      };
    });
    setArrowEditPreview(null);
    setArrowDragPreview(null);
    setDraggingArrowHandleId(null);
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
        deleteAnnotationById(annotation.id);
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

    deleteAnnotationById(selectedImageCallout.annotation.id);
  }, [deleteAnnotationById, selectedImageCallout]);

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
      if (preview.tool === 'callout' && preview.geometry.kind === 'callout') {
        startInlineCalloutCreate(preview.geometry);
      } else if (preview.tool === 'image-callout' && preview.geometry.kind === 'image-callout') {
        openImageCalloutPicker({
          mode: 'create',
          geometry: preview.geometry,
        });
      } else {
        addAnnotation(preview);
        setActiveTool(getNextToolAfterCanvasCreate(preview.tool));
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
      activeTool === 'arrow' || activeTool === 'line'
        ? {
            kind: activeTool as 'arrow' | 'line',
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
    const selected = !isExportingPng && annotation.id === selectedAnnotationId;
    const geometry = annotation.geometry;
    const commonProps = {
      onClick: () => {
        if (annotation.id !== editingLineId) {
          setEditingLineId(null);
          setLineEditPreview(null);
          setLineDragPreview(null);
          setDraggingLineHandleId(null);
        }
        if (annotation.id !== editingArrowId) {
          setEditingArrowId(null);
          setArrowEditPreview(null);
          setArrowDragPreview(null);
          setDraggingArrowHandleId(null);
        }
        if (annotation.id !== editingRectangleId) {
          setEditingRectangleId(null);
          setRectangleEditPreview(null);
        }
        if (annotation.id !== editingCalloutTargetId) {
          setEditingCalloutTargetId(null);
        }
        if (annotation.id !== editingImageCalloutPanelId) {
          setEditingImageCalloutPanelId(null);
        }
        setSelectedAnnotation(annotation.id);
      },
      onTap: () => {
        if (annotation.id !== editingLineId) {
          setEditingLineId(null);
          setLineEditPreview(null);
          setLineDragPreview(null);
          setDraggingLineHandleId(null);
        }
        if (annotation.id !== editingArrowId) {
          setEditingArrowId(null);
          setArrowEditPreview(null);
          setArrowDragPreview(null);
          setDraggingArrowHandleId(null);
        }
        if (annotation.id !== editingRectangleId) {
          setEditingRectangleId(null);
          setRectangleEditPreview(null);
        }
        if (annotation.id !== editingCalloutTargetId) {
          setEditingCalloutTargetId(null);
        }
        if (annotation.id !== editingImageCalloutPanelId) {
          setEditingImageCalloutPanelId(null);
        }
        setSelectedAnnotation(annotation.id);
      },
      onContextMenu: (event: KonvaEventObject<PointerEvent>) => openAnnotationContextMenu(annotation, event),
    };
    const renderRectResizeHandles = (
      annotationId: string,
      renderedGeometry: RectGeometry,
      options: {
        onPreview: (geometry: RectGeometry) => void;
        onCommit: (geometry: RectGeometry) => void;
      },
    ) => {
      const cornerHandleRadius = 6 / Math.max(canvasScale, 0.75);
      const handleStrokeWidth = 2 / Math.max(canvasScale, 0.75);
      const edgeHandleWidth = 18 / Math.max(canvasScale, 0.75);
      const edgeHandleHeight = 8 / Math.max(canvasScale, 0.75);

      return RECT_RESIZE_HANDLES.map((handle) => {
        const position = getRectHandlePosition(handle, renderedGeometry);
        const isEdgeHandle = handle.length === 1;

        return (
          isEdgeHandle ? (
            <Rect
              key={`${annotationId}-${handle}`}
              {...getRectEdgeHandleFrame(handle as Extract<RectResizeHandle, 'n' | 'e' | 's' | 'w'>, renderedGeometry, edgeHandleWidth, edgeHandleHeight)}
              cornerRadius={edgeHandleHeight / 2}
              fill="#ffffff"
              stroke="#3b82f6"
              strokeWidth={handleStrokeWidth}
              draggable
              onMouseEnter={() => {
                setCanvasCursor(getRectHandleCursor(handle));
              }}
              onMouseLeave={() => {
                setCanvasCursor('');
              }}
              onMouseDown={(event) => {
                event.cancelBubble = true;
              }}
              onTouchStart={(event) => {
                event.cancelBubble = true;
              }}
              onDragStart={(event) => {
                event.cancelBubble = true;
                rectResizeDragStateRef.current = {
                  annotationId,
                  handle,
                  startGeometry: renderedGeometry,
                  startPointer: getRectHandleDragOrigin(handle, renderedGeometry),
                };
              }}
              onDragMove={(event) => {
                event.cancelBubble = true;
                const dragState = rectResizeDragStateRef.current;

                if (!dragState || dragState.annotationId !== annotationId || dragState.handle !== handle) {
                  return;
                }

                const pointer = getPointerFromClient(event.evt.clientX, event.evt.clientY, true);

                if (!pointer) {
                  return;
                }

                const nextGeometry = getRectResizePreviewForHandle({
                  handle,
                  startGeometry: dragState.startGeometry,
                  deltaX: pointer.x - dragState.startPointer.x,
                  deltaY: pointer.y - dragState.startPointer.y,
                  minimumWidth: MIN_RECT_EDIT_WIDTH,
                  minimumHeight: MIN_RECT_EDIT_HEIGHT,
                });

                options.onPreview(nextGeometry);
                event.target.position(getRectHandlePosition(handle, nextGeometry));
              }}
              onDragEnd={(event) => {
                event.cancelBubble = true;
                const dragState = rectResizeDragStateRef.current;
                rectResizeDragStateRef.current = null;
                setCanvasCursor('');

                if (!dragState || dragState.annotationId !== annotationId || dragState.handle !== handle) {
                  return;
                }

                const pointer = getPointerFromClient(event.evt.clientX, event.evt.clientY, true);

                if (!pointer) {
                  return;
                }

                const nextGeometry = getRectResizePreviewForHandle({
                  handle,
                  startGeometry: dragState.startGeometry,
                  deltaX: pointer.x - dragState.startPointer.x,
                  deltaY: pointer.y - dragState.startPointer.y,
                  minimumWidth: MIN_RECT_EDIT_WIDTH,
                  minimumHeight: MIN_RECT_EDIT_HEIGHT,
                });

                event.target.position(getRectHandlePosition(handle, nextGeometry));
                options.onCommit(nextGeometry);
              }}
            />
          ) : (
            <Circle
              key={`${annotationId}-${handle}`}
              x={position.x}
              y={position.y}
              radius={cornerHandleRadius}
              fill="#ffffff"
              stroke="#3b82f6"
              strokeWidth={handleStrokeWidth}
              draggable
              onMouseEnter={() => {
                setCanvasCursor(getRectHandleCursor(handle));
              }}
              onMouseLeave={() => {
                setCanvasCursor('');
              }}
              onMouseDown={(event) => {
                event.cancelBubble = true;
              }}
              onTouchStart={(event) => {
                event.cancelBubble = true;
              }}
              onDragStart={(event) => {
                event.cancelBubble = true;
                rectResizeDragStateRef.current = {
                  annotationId,
                  handle,
                  startGeometry: renderedGeometry,
                  startPointer: getRectHandleDragOrigin(handle, renderedGeometry),
                };
              }}
              onDragMove={(event) => {
                event.cancelBubble = true;
                const dragState = rectResizeDragStateRef.current;

                if (!dragState || dragState.annotationId !== annotationId || dragState.handle !== handle) {
                  return;
                }

                const pointer = getPointerFromClient(event.evt.clientX, event.evt.clientY, true);

                if (!pointer) {
                  return;
                }

                const nextGeometry = getRectResizePreviewForHandle({
                  handle,
                  startGeometry: dragState.startGeometry,
                  deltaX: pointer.x - dragState.startPointer.x,
                  deltaY: pointer.y - dragState.startPointer.y,
                  minimumWidth: MIN_RECT_EDIT_WIDTH,
                  minimumHeight: MIN_RECT_EDIT_HEIGHT,
                });

                options.onPreview(nextGeometry);
                event.target.position(getRectHandlePosition(handle, nextGeometry));
              }}
              onDragEnd={(event) => {
                event.cancelBubble = true;
                const dragState = rectResizeDragStateRef.current;
                rectResizeDragStateRef.current = null;
                setCanvasCursor('');

                if (!dragState || dragState.annotationId !== annotationId || dragState.handle !== handle) {
                  return;
                }

                const pointer = getPointerFromClient(event.evt.clientX, event.evt.clientY, true);

                if (!pointer) {
                  return;
                }

                const nextGeometry = getRectResizePreviewForHandle({
                  handle,
                  startGeometry: dragState.startGeometry,
                  deltaX: pointer.x - dragState.startPointer.x,
                  deltaY: pointer.y - dragState.startPointer.y,
                  minimumWidth: MIN_RECT_EDIT_WIDTH,
                  minimumHeight: MIN_RECT_EDIT_HEIGHT,
                });

                event.target.position(getRectHandlePosition(handle, nextGeometry));
                options.onCommit(nextGeometry);
              }}
            />
          )
        );
      });
    };

    switch (annotation.tool) {
      case 'rectangle': {
        if (geometry.kind !== 'rect') {
          return null;
        }

        const isEditingRectangle = !readOnly && !isPreview && !isExportingPng && editingRectangleId === annotation.id;
        const renderedRectangleGeometry =
          rectangleEditPreview?.annotationId === annotation.id ? rectangleEditPreview.geometry : geometry;
        const rectangleStrokeWidth = annotation.style.strokeWidth ?? 3;
        const rectangleDashSize =
          annotation.style.lineDashSize ?? (annotation.style.lineDash === 'dashed' ? 6 : 0);
        const rectangleDash = rectangleDashSize > 0 ? [rectangleDashSize * 2, rectangleDashSize] : undefined;

        return (
          <Group
            key={annotation.id}
            x={renderedDocumentPosition.x + renderedRectangleGeometry.x}
            y={renderedDocumentPosition.y + renderedRectangleGeometry.y}
            draggable={!readOnly && activeTool === 'select' && !isPreview}
            {...commonProps}
            onDblClick={() => startRectangleEditing(annotation.id)}
            onDblTap={() => startRectangleEditing(annotation.id)}
            onDragMove={(event) => {
              if (!isEditingRectangle) {
                return;
              }

              const pos = event.target.position();
              setRectangleEditPreview({
                annotationId: annotation.id,
                geometry: {
                  ...renderedRectangleGeometry,
                  x: pos.x - renderedDocumentPosition.x,
                  y: pos.y - renderedDocumentPosition.y,
                },
              });
            }}
            onDragEnd={(event) => {
              const pos = event.target.position();
              commitRectGeometry(annotation.id, {
                ...renderedRectangleGeometry,
                x: pos.x - renderedDocumentPosition.x,
                y: pos.y - renderedDocumentPosition.y,
              });
            }}
          >
            {isEditingRectangle ? (
              <Rect
                width={renderedRectangleGeometry.width}
                height={renderedRectangleGeometry.height}
                stroke="#60a5fa"
                strokeWidth={rectangleStrokeWidth + 4 / Math.max(canvasScale, 0.75)}
                opacity={0.22}
                cornerRadius={8}
                listening={false}
              />
            ) : null}
            <Rect
              width={renderedRectangleGeometry.width}
              height={renderedRectangleGeometry.height}
              stroke={annotation.style.stroke}
              strokeWidth={rectangleStrokeWidth}
              fill="rgba(255,255,255,0)"
              dash={rectangleDash}
              cornerRadius={8}
            />
            {isEditingRectangle ? renderRectResizeHandles(annotation.id, renderedRectangleGeometry, {
              onPreview: (nextGeometry) => {
                setRectangleEditPreview({
                  annotationId: annotation.id,
                  geometry: nextGeometry,
                });
              },
              onCommit: (nextGeometry) => {
                commitRectGeometry(annotation.id, nextGeometry);
              },
            }) : null}
          </Group>
        );
      }

      case 'highlight':
      case 'blur': {
        if (geometry.kind !== 'rect') {
          return null;
        }

        const isEditingRectangle =
          annotation.tool === 'highlight' && !readOnly && !isPreview && !isExportingPng && editingRectangleId === annotation.id;
        const renderedRectangleGeometry =
          rectangleEditPreview?.annotationId === annotation.id ? rectangleEditPreview.geometry : geometry;

        return (
          <Group
            key={annotation.id}
            x={renderedDocumentPosition.x + renderedRectangleGeometry.x}
            y={renderedDocumentPosition.y + renderedRectangleGeometry.y}
            draggable={!readOnly && activeTool === 'select' && !isPreview}
            {...commonProps}
            onDblClick={annotation.tool === 'highlight' ? () => startRectangleEditing(annotation.id) : undefined}
            onDblTap={annotation.tool === 'highlight' ? () => startRectangleEditing(annotation.id) : undefined}
            onDragMove={(event) => {
              if (!isEditingRectangle) {
                return;
              }

              const pos = event.target.position();
              setRectangleEditPreview({
                annotationId: annotation.id,
                geometry: {
                  ...renderedRectangleGeometry,
                  x: pos.x - renderedDocumentPosition.x,
                  y: pos.y - renderedDocumentPosition.y,
                },
              });
            }}
            onDragEnd={(event) => {
              const pos = event.target.position();
              commitRectGeometry(annotation.id, {
                ...renderedRectangleGeometry,
                x: pos.x - renderedDocumentPosition.x,
                y: pos.y - renderedDocumentPosition.y,
              });
            }}
          >
            {isEditingRectangle ? (
              <Rect
                width={renderedRectangleGeometry.width}
                height={renderedRectangleGeometry.height}
                stroke="#60a5fa"
                strokeWidth={(annotation.style.strokeWidth ?? 2) + 4 / Math.max(canvasScale, 0.75)}
                opacity={0.22}
                cornerRadius={8}
                listening={false}
              />
            ) : null}
            <Rect
              width={renderedRectangleGeometry.width}
              height={renderedRectangleGeometry.height}
              stroke={annotation.style.stroke}
              strokeWidth={annotation.style.strokeWidth ?? 2}
              fill={annotation.style.fill}
              cornerRadius={8}
            />
            {isEditingRectangle ? renderRectResizeHandles(annotation.id, renderedRectangleGeometry, {
              onPreview: (nextGeometry) => {
                setRectangleEditPreview({
                  annotationId: annotation.id,
                  geometry: nextGeometry,
                });
              },
              onCommit: (nextGeometry) => {
                commitRectGeometry(annotation.id, nextGeometry);
              },
            }) : null}
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
        const isEditingLine = !readOnly && !isPreview && !isExportingPng && editingLineId === annotation.id;
        const dragOffset =
          lineDragPreview?.annotationId === annotation.id
            ? { x: lineDragPreview.dx, y: lineDragPreview.dy }
            : { x: 0, y: 0 };
        const isDraggingLineHandle = draggingLineHandleId === annotation.id;
        const lineStrokeWidth = annotation.style.strokeWidth ?? 4;
        const lineDashSize = annotation.style.lineDashSize ?? (annotation.style.lineDash === 'dashed' ? 6 : 0);
        const lineDash = lineDashSize > 0 ? [lineDashSize * 2, lineDashSize] : undefined;
        const lineStartMarker = annotation.style.lineStartMarker ?? 'none';
        const lineEndMarker = annotation.style.lineEndMarker ?? 'none';
        const handleRadius = 6 / Math.max(canvasScale, 0.75);
        const handleStrokeWidth = 2 / Math.max(canvasScale, 0.75);
        const handleHitStrokeWidth = 20 / Math.max(canvasScale, 0.75);
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
            x={renderedDocumentPosition.x + dragOffset.x}
            y={renderedDocumentPosition.y + dragOffset.y}
            {...commonProps}
            draggable={isEditingLine && !isDraggingLineHandle}
            onDblClick={() => startLineEditing(annotation.id)}
            onDblTap={() => startLineEditing(annotation.id)}
            onDragMove={(event) => {
              if (!isEditingLine || isDraggingLineHandle) {
                return;
              }

              const pos = event.target.position();
              setLineDragPreview({
                annotationId: annotation.id,
                dx: pos.x - renderedDocumentPosition.x,
                dy: pos.y - renderedDocumentPosition.y,
              });
            }}
            onDragEnd={(event) => {
              if (!isEditingLine || isDraggingLineHandle) {
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
                  hitStrokeWidth={handleHitStrokeWidth}
                  draggable
                  onMouseDown={(event) => {
                    event.cancelBubble = true;
                  }}
                  onTouchStart={(event) => {
                    event.cancelBubble = true;
                  }}
                  onDragStart={(event) => {
                    event.cancelBubble = true;
                    setDraggingLineHandleId(annotation.id);
                    setLineDragPreview(null);
                  }}
                  onDragMove={(event) => {
                    event.cancelBubble = true;
                    const pos = event.target.position();
                    setLineEditPreview({
                      annotationId: annotation.id,
                      points: replaceLineHandle(linePoints, 'start', pos.x, pos.y),
                    });
                  }}
                  onDragEnd={(event) => {
                    event.cancelBubble = true;
                    const pos = event.target.position();
                    setDraggingLineHandleId(null);
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
                  hitStrokeWidth={handleHitStrokeWidth}
                  draggable
                  onMouseDown={(event) => {
                    event.cancelBubble = true;
                  }}
                  onTouchStart={(event) => {
                    event.cancelBubble = true;
                  }}
                  onDragStart={(event) => {
                    event.cancelBubble = true;
                    setDraggingLineHandleId(annotation.id);
                    setLineDragPreview(null);
                  }}
                  onDragMove={(event) => {
                    event.cancelBubble = true;
                    const pos = event.target.position();
                    setLineEditPreview({
                      annotationId: annotation.id,
                      points: replaceLineHandle(linePoints, 'end', pos.x, pos.y),
                    });
                  }}
                  onDragEnd={(event) => {
                    event.cancelBubble = true;
                    const pos = event.target.position();
                    setDraggingLineHandleId(null);
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

        const isEditingArrow = !readOnly && !isPreview && !isExportingPng && editingArrowId === annotation.id;
        const arrowPoints =
          arrowEditPreview?.annotationId === annotation.id
            ? arrowEditPreview.points
            : geometry.points;
        const isDraggingArrowHandle = draggingArrowHandleId === annotation.id;
        const dragOffset =
          arrowDragPreview?.annotationId === annotation.id
            ? { x: arrowDragPreview.dx, y: arrowDragPreview.dy }
            : { x: 0, y: 0 };
        const arrowStrokeWidth = annotation.style.strokeWidth ?? 4;
        const handleRadius = 6 / Math.max(canvasScale, 0.75);
        const handleStrokeWidth = 2 / Math.max(canvasScale, 0.75);
        const handleHitStrokeWidth = 20 / Math.max(canvasScale, 0.75);

        return (
          <Group
            key={annotation.id}
            x={renderedDocumentPosition.x + dragOffset.x}
            y={renderedDocumentPosition.y + dragOffset.y}
            {...commonProps}
            draggable={isEditingArrow && !isDraggingArrowHandle}
            onDblClick={() => startArrowEditing(annotation.id)}
            onDblTap={() => startArrowEditing(annotation.id)}
            onDragMove={(event) => {
              if (!isEditingArrow || isDraggingArrowHandle) {
                return;
              }

              const pos = event.target.position();
              setArrowDragPreview({
                annotationId: annotation.id,
                dx: pos.x - renderedDocumentPosition.x,
                dy: pos.y - renderedDocumentPosition.y,
              });
            }}
            onDragEnd={(event) => {
              if (!isEditingArrow || isDraggingArrowHandle) {
                return;
              }

              const pos = event.target.position();
              const dx = pos.x - renderedDocumentPosition.x;
              const dy = pos.y - renderedDocumentPosition.y;
              const nextPoints = translateLinePoints(arrowPoints, dx, dy);
              event.target.position({
                x: renderedDocumentPosition.x,
                y: renderedDocumentPosition.y,
              });
              commitArrowPoints(annotation.id, nextPoints);
            }}
          >
            {isEditingArrow ? (
              <Arrow
                points={arrowPoints}
                stroke="#60a5fa"
                fill="#60a5fa"
                pointerLength={10}
                pointerWidth={10}
                strokeWidth={arrowStrokeWidth + 6 / Math.max(canvasScale, 0.75)}
                opacity={0.2}
                listening={false}
              />
            ) : null}
            <Arrow
              points={arrowPoints}
              stroke={annotation.style.stroke}
              fill={annotation.style.stroke}
              pointerLength={10}
              pointerWidth={10}
              strokeWidth={arrowStrokeWidth}
              hitStrokeWidth={18}
            />
            {isEditingArrow ? (
              <Circle
                x={arrowPoints[0]}
                y={arrowPoints[1]}
                radius={handleRadius}
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth={handleStrokeWidth}
                hitStrokeWidth={handleHitStrokeWidth}
                draggable
                onMouseDown={(event) => {
                  event.cancelBubble = true;
                }}
                onTouchStart={(event) => {
                  event.cancelBubble = true;
                }}
                onDragStart={(event) => {
                  event.cancelBubble = true;
                  setDraggingArrowHandleId(annotation.id);
                  setArrowDragPreview(null);
                }}
                onDragMove={(event) => {
                  event.cancelBubble = true;
                  const pos = event.target.position();
                  setArrowEditPreview({
                    annotationId: annotation.id,
                    points: replaceLineHandle(arrowPoints, 'start', pos.x, pos.y),
                  });
                }}
                onDragEnd={(event) => {
                  event.cancelBubble = true;
                  const pos = event.target.position();
                  setDraggingArrowHandleId(null);
                  commitArrowPoints(annotation.id, replaceLineHandle(arrowPoints, 'start', pos.x, pos.y));
                }}
              />
            ) : null}
          </Group>
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

        const isEditingCurrentText = !isExportingPng && inlineTextEditor?.annotationId === annotation.id;
        const isHoveredCurrentText = !isExportingPng && hoveredTextAnnotationId === annotation.id;
        const textBackgroundColor = annotation.style.textBackgroundColor ?? DEFAULT_TEXT_STYLE.textBackgroundColor;
        const textContentFrame = getTextContentFrame(geometry);

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
                x={textContentFrame.x}
                y={textContentFrame.y}
                text={annotation.label ?? ''}
                width={textContentFrame.width}
                height={textContentFrame.height}
                fill={annotation.style.textColor ?? DEFAULT_TEXT_STYLE.textColor}
                fontSize={annotation.style.fontSize ?? DEFAULT_TEXT_STYLE.fontSize}
                fontStyle={getTextFontStyle(annotation.style)}
                textDecoration={annotation.style.textDecoration ?? DEFAULT_TEXT_STYLE.textDecoration}
                lineHeight={BASE_TEXT_LINE_HEIGHT}
              />
            )}
          </Group>
        );
      }

      case 'callout': {
        if (geometry.kind !== 'callout') {
          return null;
        }

        const isEditingCurrentCallout = !isExportingPng && inlineTextEditor?.annotationId === annotation.id;
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
        const borderColor = annotation.style.stroke;
        const groupX = renderedDocumentPosition.x + calloutBounds.x;
        const groupY = renderedDocumentPosition.y + calloutBounds.y;
        const isEditingCalloutTarget =
          !readOnly && !isPreview && !isExportingPng && editingCalloutTargetId === annotation.id;

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
              onDblClick={(event) => {
                event.cancelBubble = true;
                if (!readOnly) {
                  startCalloutTargetEditing(annotation.id);
                }
              }}
              onDblTap={(event) => {
                event.cancelBubble = true;
                if (!readOnly) {
                  startCalloutTargetEditing(annotation.id);
                }
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
              {isEditingCalloutTarget ? renderRectResizeHandles(annotation.id, renderedGeometry.target, {
                onPreview: (nextGeometry) => {
                  setDraggingCalloutTargetFrame({
                    annotationId: annotation.id,
                    target: nextGeometry,
                  });
                },
                onCommit: (nextGeometry) => {
                  commitCalloutTargetGeometry(annotation.id, nextGeometry);
                },
              }) : null}
            </Group>
            <KonvaLine
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
        const borderColor = annotation.style.stroke;
        const groupX = renderedDocumentPosition.x + calloutBounds.x;
        const groupY = renderedDocumentPosition.y + calloutBounds.y;
        const embeddedAsset = annotation.imageAssetId ? embeddedAssetsById.get(annotation.imageAssetId) : undefined;
        const isEditingCalloutTarget =
          !readOnly && !isPreview && !isExportingPng && editingCalloutTargetId === annotation.id;
        const isEditingImageCalloutPanel =
          !readOnly && !isPreview && !isExportingPng && editingImageCalloutPanelId === annotation.id;

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
              onDblClick={(event) => {
                event.cancelBubble = true;
                if (!readOnly) {
                  startCalloutTargetEditing(annotation.id);
                }
              }}
              onDblTap={(event) => {
                event.cancelBubble = true;
                if (!readOnly) {
                  startCalloutTargetEditing(annotation.id);
                }
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
              {isEditingCalloutTarget ? renderRectResizeHandles(annotation.id, renderedGeometry.target, {
                onPreview: (nextGeometry) => {
                  setDraggingCalloutTargetFrame({
                    annotationId: annotation.id,
                    target: nextGeometry,
                  });
                },
                onCommit: (nextGeometry) => {
                  commitCalloutTargetGeometry(annotation.id, nextGeometry);
                },
              }) : null}
            </Group>
            <KonvaLine
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
              onDblClick={(event) => {
                event.cancelBubble = true;
                if (!readOnly) {
                  startImageCalloutPanelEditing(annotation.id);
                }
              }}
              onDblTap={(event) => {
                event.cancelBubble = true;
                if (!readOnly) {
                  startImageCalloutPanelEditing(annotation.id);
                }
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
              {isEditingImageCalloutPanel ? renderRectResizeHandles(annotation.id, renderedGeometry.panel, {
                onPreview: (nextGeometry) => {
                  setDraggingImageCalloutPanelFrame({
                    annotationId: annotation.id,
                    panel: nextGeometry,
                  });
                },
                onCommit: (nextGeometry) => {
                  commitImageCalloutPanelGeometry(annotation.id, nextGeometry);
                },
              }) : null}
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

    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((naturalRatio / fitScale).toFixed(2))));
  }, [draft.asset, fitScale, imageBounds]);

  return (
    <Card className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden p-4">
      <div ref={frameRef} className="relative min-h-[320px] flex-1">
        <div
          ref={viewportRef}
          className={cn(
            'min-h-[320px] h-full overflow-hidden rounded-2xl bg-white',
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
                {isExportingPng || !preview ? null : renderAnnotation(preview, true)}
                {isExportingPng || !pendingInlineCalloutGeometry ? null : (
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
                    <KonvaLine
                      points={getCalloutConnectorPoints(pendingInlineCalloutGeometry)}
                      stroke="#2563eb"
                      strokeWidth={3}
                      lineCap="round"
                      lineJoin="round"
                    />
                  </Group>
                )}
                {isExportingPng || !pendingImageCalloutGeometry ? null : (
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
                    <KonvaLine
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
                )}
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
            allowHeightShrink={inlineTextEditor.annotationTool === 'callout'}
            minimumHeight={inlineTextEditor.annotationTool === 'callout' ? CALLOUT_TEXT_HEIGHT : 24}
          />
        ) : null}

        {(lineToolbarRect && editingLineAnnotation) ||
        (arrowToolbarRect && editingArrowAnnotation) ||
        rectangleToolbarRect && editingRectangleAnnotation ? (
          <>
            <div
              ref={setLineToolbarReference}
              className="pointer-events-none absolute"
              style={{
                left: lineToolbarRect?.left ?? arrowToolbarRect?.left ?? rectangleToolbarRect?.left,
                top: lineToolbarRect?.top ?? arrowToolbarRect?.top ?? rectangleToolbarRect?.top,
                width: lineToolbarRect?.width ?? arrowToolbarRect?.width ?? rectangleToolbarRect?.width,
                height: lineToolbarRect?.height ?? arrowToolbarRect?.height ?? rectangleToolbarRect?.height,
              }}
            />
            <FloatingLineStyleToolbar
              isOpen
              reference={lineToolbarReference}
              style={
                editingLineAnnotation?.style ??
                editingArrowAnnotation?.style ??
                editingRectangleAnnotation?.style ??
                getDefaultStyle('line')
              }
              onChange={
                editingLineAnnotation
                  ? updateEditingLineStyle
                  : editingArrowAnnotation
                    ? updateEditingArrowStyle
                    : editingRectangleAnnotation?.tool === 'highlight'
                      ? updateEditingHighlightStyle
                      : updateEditingRectangleStyle
              }
              showMarkers={Boolean(editingLineAnnotation)}
              showStrokeWidth={Boolean(editingLineAnnotation || editingRectangleAnnotation?.tool === 'rectangle')}
              showDash={Boolean(editingLineAnnotation || editingRectangleAnnotation?.tool === 'rectangle')}
              colorTarget={editingRectangleAnnotation?.tool === 'highlight' ? 'fill' : 'stroke'}
            />
          </>
        ) : null}
        {selectedCalloutColorToolbarRect &&
        editingCalloutTargetAnnotation &&
        !readOnly &&
        activeTool === 'select' &&
        inlineTextEditor?.annotationId !== editingCalloutTargetAnnotation.annotation.id ? (
          <>
            <div
              ref={setCalloutColorToolbarReference}
              className="pointer-events-none absolute"
              style={{
                left: selectedCalloutColorToolbarRect.left,
                top: selectedCalloutColorToolbarRect.top,
                width: selectedCalloutColorToolbarRect.width,
                height: selectedCalloutColorToolbarRect.height,
              }}
            />
            <FloatingLineStyleToolbar
              isOpen
              reference={calloutColorToolbarReference}
              style={editingCalloutTargetAnnotation.annotation.style}
              onChange={updateSelectedCalloutColor}
              showMarkers={false}
              showStrokeWidth={false}
              showDash={false}
            />
          </>
        ) : null}
        {editingImageCalloutPanel && selectedImageCalloutToolbarStyle && !readOnly && activeTool === 'select' ? (
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
      </div>
    </Card>
  );
}


