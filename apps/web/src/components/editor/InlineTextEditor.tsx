import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { AnnotationStyle } from '@marker/shared';
import {
  BASE_TEXT_LINE_HEIGHT,
  TEXT_FRAME_HORIZONTAL_PADDING,
  TEXT_FRAME_VERTICAL_PADDING,
  getMinTextBoxHeight,
} from '@/lib/textFrameLayout';
import { FloatingTextStyleToolbar } from './FloatingTextStyleToolbar';
import type { ViewportMetrics } from './canvasViewportStore';
import { useCanvasViewportSnapshot } from './canvasViewportStore';
import { getInlineTextOverlayStyle } from './inlineTextOverlay';
import {
  RECT_RESIZE_HANDLES,
  getRectEdgeHandleFrame,
  getRectHandleCursor,
  getRectHandlePosition,
} from './rectResizeGeometry';
import { getResizePreviewForHandle, type ResizeHandle, type TextFrame } from './textResizeScaling';

const MIN_TEXT_WIDTH = 20;
const MAX_TEXT_WIDTH = 320;
const MIN_RESIZE_FONT_SIZE = 12;
const MAX_RESIZE_FONT_SIZE = 120;
const CORNER_HANDLE_SIZE = 12;
const EDGE_HANDLE_WIDTH = 18;
const EDGE_HANDLE_HEIGHT = 8;
const FRAME_DRAG_THICKNESS = 8;
const FRAME_SEGMENT_INSET = 18;
const DEFAULT_MIN_TEXT_HEIGHT = 24;

type InteractionState =
  | {
      kind: 'resize';
      handle: ResizeHandle;
      startClientX: number;
      startClientY: number;
      startFontSize: number;
      startFrame: { x: number; y: number; width: number; height: number };
    }
  | {
      kind: 'move';
      startClientX: number;
      startClientY: number;
      startFrame: { x: number; y: number; width: number; height: number };
    };

interface ResizePreviewState {
  frame: TextFrame;
  fontSize: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getCssFontWeight = (fontWeight: AnnotationStyle['fontWeight']) => (fontWeight === 'bold' ? 700 : 400);
const getCssFontStyle = (fontStyle: AnnotationStyle['fontStyle']) => (fontStyle === 'italic' ? 'italic' : 'normal');

export function InlineTextEditor({
  isOpen,
  value,
  frame,
  documentPosition,
  textStyle,
  fallbackViewport,
  onChange,
  onTextStyleChange,
  onSizeChange,
  onFrameChange,
  onCommit,
  onCancel,
  allowHeightShrink = false,
  minimumHeight = DEFAULT_MIN_TEXT_HEIGHT,
}: {
  isOpen: boolean;
  value: string;
  frame: { x: number; y: number; width: number; height: number };
  documentPosition: { x: number; y: number };
  textStyle: AnnotationStyle;
  fallbackViewport: ViewportMetrics;
  onChange: (value: string) => void;
  onTextStyleChange: (patch: Partial<AnnotationStyle>) => void;
  onSizeChange: (size: { width: number; height: number }) => void;
  onFrameChange: (
    frame: Partial<{ x: number; y: number; width: number; height: number }> & {
      boxMode?: AnnotationStyle['textBoxMode'];
      fontSize?: number;
    },
  ) => void;
  onCommit: () => void;
  onCancel: () => void;
  allowHeightShrink?: boolean;
  minimumHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const interactionStateRef = useRef<InteractionState | null>(null);
  const resizePreviewRef = useRef<ResizePreviewState | null>(null);
  const [resizePreview, setResizePreview] = useState<ResizePreviewState | null>(null);
  const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null);
  const textareaId = useId();
  const viewport = useCanvasViewportSnapshot(fallbackViewport);
  const fontSize = textStyle.fontSize ?? 14;
  const displayFontSize = resizePreview?.fontSize ?? fontSize;
  const fontWeight = textStyle.fontWeight ?? 'normal';
  const fontStyle = textStyle.fontStyle ?? 'normal';
  const textColor = textStyle.textColor ?? '#0f172a';
  const textDecoration = textStyle.textDecoration ?? 'none';
  const textBackgroundColor = textStyle.textBackgroundColor ?? 'transparent';
  const displayFrame = resizePreview?.frame ?? frame;
  const canvasScale = viewport.canvasScale;
  const textBoxMode = resizePreview ? 'manual' : (textStyle.textBoxMode ?? 'auto');
  const displayStyle = useMemo(() => {
    const baseStyle = getInlineTextOverlayStyle({
      annotationGeometry: {
        kind: 'text',
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
      },
      documentPosition,
      canvasScale: viewport.canvasScale,
      layerOffsetX: viewport.layerOffsetX,
      layerOffsetY: viewport.layerOffsetY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    });

    if (!resizePreview) {
      return baseStyle;
    }

    return {
      ...baseStyle,
      left: baseStyle.left + (displayFrame.x - frame.x) * canvasScale,
      top: baseStyle.top + (displayFrame.y - frame.y) * canvasScale,
    };
  }, [
    canvasScale,
    displayFrame.x,
    displayFrame.y,
    documentPosition,
    frame.height,
    frame.width,
    frame.x,
    frame.y,
    resizePreview,
    viewport.canvasScale,
    viewport.layerOffsetX,
    viewport.layerOffsetY,
    viewport.scrollLeft,
    viewport.scrollTop,
  ]);
  const scaledFontSize = useMemo(() => displayFontSize * canvasScale, [canvasScale, displayFontSize]);
  const scaledLineHeight = useMemo(
    () => displayFontSize * BASE_TEXT_LINE_HEIGHT * canvasScale,
    [canvasScale, displayFontSize],
  );
  const minTextHeight = useMemo(() => getMinTextBoxHeight(displayFontSize), [displayFontSize]);

  const updateResizePreview = useCallback((nextPreview: ResizePreviewState | null) => {
    resizePreviewRef.current = nextPreview;
    setResizePreview(nextPreview);
  }, []);

  const focusTextareaAtEnd = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.focus();
    const selectionStart = textarea.value.length;
    textarea.setSelectionRange(selectionStart, selectionStart);
  }, []);

  const handleEditorBoxRef = useCallback((node: HTMLDivElement | null) => {
    setReferenceElement((current) => (current === node ? current : node));
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    focusTextareaAtEnd();
  }, [focusTextareaAtEnd, isOpen]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const measure = measureRef.current;

    if (!textarea || !measure) {
      return;
    }

    if (resizePreview) {
      textarea.style.width = `${displayFrame.width * canvasScale}px`;
      textarea.style.height = `${displayFrame.height * canvasScale}px`;
      return;
    }

    const lines = (value || ' ').split('\n');
    let longestLineWidth = 0;

    for (const line of lines) {
      measure.textContent = line.length ? line : ' ';
      longestLineWidth = Math.max(longestLineWidth, Math.ceil(measure.getBoundingClientRect().width));
    }

    const currentWidthPx = displayFrame.width * canvasScale;
    const minWidthPx = MIN_TEXT_WIDTH * canvasScale;
    const maxWidthPx = MAX_TEXT_WIDTH * canvasScale;
    const nextWidthPx =
      textBoxMode === 'auto'
        ? clamp(longestLineWidth + TEXT_FRAME_HORIZONTAL_PADDING * 2 + 6, minWidthPx, maxWidthPx)
        : Math.max(currentWidthPx, minWidthPx);

    textarea.style.width = `${nextWidthPx}px`;
    textarea.style.height = '0px';

    const minimumHeightPx = Math.max(
      (allowHeightShrink ? minimumHeight : displayFrame.height) * canvasScale,
      minTextHeight * canvasScale,
    );
    const nextHeightPx = Math.max(Math.ceil(textarea.scrollHeight), minimumHeightPx);
    textarea.style.height = `${nextHeightPx}px`;

    onSizeChange({
      width: Number((nextWidthPx / canvasScale).toFixed(2)),
      height: Number((nextHeightPx / canvasScale).toFixed(2)),
    });
  }, [
    allowHeightShrink,
    canvasScale,
    displayFrame.height,
    displayFrame.width,
    minTextHeight,
    minimumHeight,
    onSizeChange,
    resizePreview,
    textBoxMode,
    value,
  ]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const interactionState = interactionStateRef.current;

      if (!interactionState) {
        return;
      }

      const deltaX = (event.clientX - interactionState.startClientX) / canvasScale;
      const deltaY = (event.clientY - interactionState.startClientY) / canvasScale;

      if (interactionState.kind === 'move') {
        onFrameChange({
          x: Number((interactionState.startFrame.x + deltaX).toFixed(2)),
          y: Number((interactionState.startFrame.y + deltaY).toFixed(2)),
        });
        return;
      }

      const minimumWidth = MIN_TEXT_WIDTH;
      const minimumHeight = minTextHeight;
      const nextPreview = getResizePreviewForHandle({
        handle: interactionState.handle,
        startFrame: interactionState.startFrame,
        deltaX,
        deltaY,
        startFontSize: interactionState.startFontSize,
        minimumWidth,
        minimumHeight,
        minFontSize: MIN_RESIZE_FONT_SIZE,
        maxFontSize: MAX_RESIZE_FONT_SIZE,
      });

      updateResizePreview({
        frame: nextPreview.frame,
        fontSize: nextPreview.fontSize ?? interactionState.startFontSize,
      });
    },
    [canvasScale, minTextHeight, onFrameChange, updateResizePreview],
  );

  const handlePointerUp = useCallback(() => {
    const interactionState = interactionStateRef.current;
    const nextPreview = resizePreviewRef.current;

    if (interactionState?.kind === 'resize' && nextPreview) {
      onFrameChange({
        ...nextPreview.frame,
        boxMode: 'manual',
        ...(nextPreview.fontSize !== interactionState.startFontSize ? { fontSize: nextPreview.fontSize } : {}),
      });
    }

    interactionStateRef.current = null;
    updateResizePreview(null);

    if (interactionState) {
      focusTextareaAtEnd();
    }
  }, [focusTextareaAtEnd, onFrameChange, updateResizePreview]);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  useEffect(() => {
    const handlePointerDownCapture = (event: PointerEvent) => {
      const editor = editorRef.current;
      const textarea = textareaRef.current;

      if (!editor || !textarea) {
        return;
      }

      const target = event.target;

      if (target instanceof Node && editor.contains(target)) {
        return;
      }

      if (document.activeElement === textarea) {
        textarea.blur();
        return;
      }

      if (document.activeElement instanceof Node && editor.contains(document.activeElement)) {
        onCommit();
      }
    };

    document.addEventListener('pointerdown', handlePointerDownCapture, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownCapture, true);
    };
  }, [onCommit]);

  const startResize = (handle: ResizeHandle) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    interactionStateRef.current = {
      kind: 'resize',
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFontSize: fontSize,
      startFrame: frame,
    };
  };

  const startMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    interactionStateRef.current = {
      kind: 'move',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFrame: frame,
    };
  };

  const handleTextareaBlur = (event: ReactFocusEvent<HTMLTextAreaElement>) => {
    const nextFocusedTarget = event.relatedTarget;

    if (nextFocusedTarget instanceof Node && editorRef.current?.contains(nextFocusedTarget)) {
      return;
    }

    onCommit();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div ref={editorRef} style={{ left: 0, top: 0 }} className="absolute z-40 overflow-visible">
        <FloatingTextStyleToolbar
          isOpen={isOpen}
          reference={referenceElement}
          style={textStyle}
          onChange={onTextStyleChange}
          onCommit={onCommit}
        />

        <div
          ref={handleEditorBoxRef}
          style={{
            left: displayStyle.left,
            top: displayStyle.top,
            width: displayFrame.width * canvasScale,
            height: displayFrame.height * canvasScale,
          }}
          className="absolute overflow-visible"
        >
          <label htmlFor={textareaId} className="sr-only">
            Text editor
          </label>
          <textarea
            id={textareaId}
            ref={textareaRef}
            autoFocus
            value={value}
            style={{
              width: '100%',
              height: '100%',
              fontSize: scaledFontSize,
              fontWeight: getCssFontWeight(fontWeight),
              fontStyle: getCssFontStyle(fontStyle),
              color: textColor,
              lineHeight: `${scaledLineHeight}px`,
              textDecoration,
              backgroundColor: textBackgroundColor === 'transparent' ? 'transparent' : textBackgroundColor,
              padding: `${TEXT_FRAME_VERTICAL_PADDING * canvasScale}px ${TEXT_FRAME_HORIZONTAL_PADDING * canvasScale}px`,
              boxSizing: 'border-box',
              borderStyle: 'solid',
              borderRadius: `${8 * canvasScale}px`,
            }}
            className="resize-none overflow-hidden rounded-lg border border-solid border-blue-500/80 bg-transparent caret-blue-600 shadow-none outline-none"
            onChange={(event) => onChange(event.target.value)}
            onBlur={handleTextareaBlur}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) {
                return;
              }

              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onCommit();
                return;
              }

              if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
              }
            }}
          />

          <button
            type="button"
            aria-label="Move text box top border"
            tabIndex={-1}
            className="absolute cursor-move bg-transparent"
            style={{
              left: FRAME_SEGMENT_INSET,
              right: FRAME_SEGMENT_INSET,
              top: -FRAME_DRAG_THICKNESS / 2,
              height: FRAME_DRAG_THICKNESS,
            }}
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={startMove}
          />
          <button
            type="button"
            aria-label="Move text box bottom border"
            tabIndex={-1}
            className="absolute cursor-move bg-transparent"
            style={{
              left: FRAME_SEGMENT_INSET,
              right: FRAME_SEGMENT_INSET,
              bottom: -FRAME_DRAG_THICKNESS / 2,
              height: FRAME_DRAG_THICKNESS,
            }}
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={startMove}
          />
          <button
            type="button"
            aria-label="Move text box left border"
            tabIndex={-1}
            className="absolute cursor-move bg-transparent"
            style={{
              left: -FRAME_DRAG_THICKNESS / 2,
              top: FRAME_SEGMENT_INSET,
              bottom: FRAME_SEGMENT_INSET,
              width: FRAME_DRAG_THICKNESS,
            }}
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={startMove}
          />
          <button
            type="button"
            aria-label="Move text box right border"
            tabIndex={-1}
            className="absolute cursor-move bg-transparent"
            style={{
              right: -FRAME_DRAG_THICKNESS / 2,
              top: FRAME_SEGMENT_INSET,
              bottom: FRAME_SEGMENT_INSET,
              width: FRAME_DRAG_THICKNESS,
            }}
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={startMove}
          />

          {RECT_RESIZE_HANDLES.map((handle) => {
            const isEdgeHandle = handle.length === 1;
            const edgeFrame = isEdgeHandle
              ? getRectEdgeHandleFrame(
                  handle as Extract<ResizeHandle, 'n' | 'e' | 's' | 'w'>,
                  displayFrame,
                  EDGE_HANDLE_WIDTH,
                  EDGE_HANDLE_HEIGHT,
                )
              : null;
            const cornerPosition = !isEdgeHandle ? getRectHandlePosition(handle, displayFrame) : null;

            return (
              <button
                key={handle}
                type="button"
                aria-label={`Resize text box ${handle}`}
                tabIndex={-1}
                className="absolute appearance-none border border-blue-500 bg-white p-0 shadow-sm"
                style={{
                  width: isEdgeHandle ? edgeFrame?.width : CORNER_HANDLE_SIZE,
                  height: isEdgeHandle ? edgeFrame?.height : CORNER_HANDLE_SIZE,
                  left: isEdgeHandle ? edgeFrame?.x : cornerPosition?.x,
                  top: isEdgeHandle ? edgeFrame?.y : cornerPosition?.y,
                  transform: isEdgeHandle
                    ? `translate(-${edgeFrame?.offsetX}px, -${edgeFrame?.offsetY}px)`
                    : 'translate(-50%, -50%)',
                  borderRadius: isEdgeHandle ? EDGE_HANDLE_HEIGHT / 2 : CORNER_HANDLE_SIZE / 2,
                  cursor: getRectHandleCursor(handle),
                }}
                onMouseDown={(event) => event.preventDefault()}
                onPointerDown={startResize(handle)}
              />
            );
          })}
        </div>
      </div>

      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none fixed left-[-9999px] top-[-9999px] whitespace-pre opacity-0"
        style={{
          fontSize: scaledFontSize,
          fontWeight: getCssFontWeight(fontWeight),
          fontStyle: getCssFontStyle(fontStyle),
          color: textColor,
          lineHeight: `${scaledLineHeight}px`,
        }}
      />
    </>
  );
}
