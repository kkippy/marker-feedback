import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { AnnotationStyle } from '@marker/shared';

const BASE_LINE_HEIGHT = 1.45;
const MIN_TEXT_WIDTH = 20;
const MAX_TEXT_WIDTH = 320;
const RESIZE_HANDLE_OFFSET = -5;
const RESIZE_HANDLE_SIZE = 10;
const FRAME_DRAG_THICKNESS = 8;
const FRAME_SEGMENT_INSET = 18;

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type InteractionState =
  | {
      kind: 'resize';
      handle: ResizeHandle;
      startClientX: number;
      startClientY: number;
      startFrame: { x: number; y: number; width: number; height: number };
    }
  | {
      kind: 'move';
      startClientX: number;
      startClientY: number;
      startFrame: { x: number; y: number; width: number; height: number };
    };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getCssFontWeight = (fontWeight: AnnotationStyle['fontWeight']) => (fontWeight === 'bold' ? 700 : 400);
const getCssFontStyle = (fontStyle: AnnotationStyle['fontStyle']) => (fontStyle === 'italic' ? 'italic' : 'normal');

export function InlineTextEditor({
  isOpen,
  value,
  style,
  frame,
  textStyle,
  canvasScale,
  onChange,
  onSizeChange,
  onFrameChange,
  onCommit,
  onCancel,
}: {
  isOpen: boolean;
  value: string;
  style: CSSProperties;
  frame: { x: number; y: number; width: number; height: number };
  textStyle: AnnotationStyle;
  canvasScale: number;
  onChange: (value: string) => void;
  onSizeChange: (size: { width: number; height: number }) => void;
  onFrameChange: (
    frame: Partial<{ x: number; y: number; width: number; height: number }> & {
      boxMode?: AnnotationStyle['textBoxMode'];
    },
  ) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const interactionStateRef = useRef<InteractionState | null>(null);
  const fontSize = textStyle.fontSize ?? 14;
  const fontWeight = textStyle.fontWeight ?? 'normal';
  const fontStyle = textStyle.fontStyle ?? 'normal';
  const textColor = textStyle.textColor ?? '#0f172a';
  const textDecoration = textStyle.textDecoration ?? 'none';
  const textBackgroundColor = textStyle.textBackgroundColor ?? 'transparent';
  const textBoxMode = textStyle.textBoxMode ?? 'auto';
  const scaledFontSize = useMemo(() => fontSize * canvasScale, [canvasScale, fontSize]);
  const scaledLineHeight = useMemo(() => fontSize * BASE_LINE_HEIGHT * canvasScale, [canvasScale, fontSize]);
  const minTextHeight = useMemo(() => Math.ceil(fontSize * BASE_LINE_HEIGHT), [fontSize]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const measure = measureRef.current;

    if (!textarea || !measure) {
      return;
    }

    const lines = (value || ' ').split('\n');
    let longestLineWidth = 0;

    for (const line of lines) {
      measure.textContent = line.length ? line : ' ';
      longestLineWidth = Math.max(longestLineWidth, Math.ceil(measure.getBoundingClientRect().width));
    }

    const currentWidthPx = frame.width * canvasScale;
    const minWidthPx = MIN_TEXT_WIDTH * canvasScale;
    const maxWidthPx = MAX_TEXT_WIDTH * canvasScale;
    const nextWidthPx =
      textBoxMode === 'auto'
        ? clamp(longestLineWidth + 6, minWidthPx, maxWidthPx)
        : Math.max(currentWidthPx, minWidthPx);

    textarea.style.width = `${nextWidthPx}px`;
    textarea.style.height = '0px';

    const minimumHeightPx = Math.max(frame.height * canvasScale, minTextHeight * canvasScale);
    const nextHeightPx = Math.max(Math.ceil(textarea.scrollHeight), minimumHeightPx);
    textarea.style.height = `${nextHeightPx}px`;

    onSizeChange({
      width: Number((nextWidthPx / canvasScale).toFixed(2)),
      height: Number((nextHeightPx / canvasScale).toFixed(2)),
    });
  }, [canvasScale, fontSize, frame.height, frame.width, minTextHeight, onSizeChange, textBoxMode, value]);

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
      let nextX = interactionState.startFrame.x;
      let nextY = interactionState.startFrame.y;
      let nextWidth = interactionState.startFrame.width;
      let nextHeight = interactionState.startFrame.height;

      if (interactionState.handle === 'e' || interactionState.handle === 'ne' || interactionState.handle === 'se') {
        nextWidth = Math.max(minimumWidth, interactionState.startFrame.width + deltaX);
      } else if (interactionState.handle === 'w' || interactionState.handle === 'nw' || interactionState.handle === 'sw') {
        nextWidth = Math.max(minimumWidth, interactionState.startFrame.width - deltaX);
        nextX = interactionState.startFrame.x + (interactionState.startFrame.width - nextWidth);
      }

      if (interactionState.handle === 's' || interactionState.handle === 'sw' || interactionState.handle === 'se') {
        nextHeight = Math.max(minimumHeight, interactionState.startFrame.height + deltaY);
      } else if (interactionState.handle === 'n' || interactionState.handle === 'nw' || interactionState.handle === 'ne') {
        nextHeight = Math.max(minimumHeight, interactionState.startFrame.height - deltaY);
        nextY = interactionState.startFrame.y + (interactionState.startFrame.height - nextHeight);
      }

      onFrameChange({
        x: Number(nextX.toFixed(2)),
        y: Number(nextY.toFixed(2)),
        width: Number(nextWidth.toFixed(2)),
        height: Number(nextHeight.toFixed(2)),
        boxMode: 'manual',
      });
    },
    [canvasScale, minTextHeight, onFrameChange],
  );

  const handlePointerUp = useCallback(() => {
    interactionStateRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const startResize = (handle: ResizeHandle) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    interactionStateRef.current = {
      kind: 'resize',
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
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

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        style={{
          left: style.left,
          top: style.top,
          width: frame.width * canvasScale,
          height: frame.height * canvasScale,
        }}
        className="absolute z-40 overflow-visible"
      >
        <textarea
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
          }}
          className="resize-none overflow-hidden rounded-sm border border-dashed border-blue-500/80 bg-transparent p-0 caret-blue-600 shadow-none outline-none"
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
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

        {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((handle) => (
          <button
            key={handle}
            type="button"
            aria-label={`Resize text box ${handle}`}
            className={`
              absolute rounded-full border border-blue-500 bg-white shadow-sm
              ${handle === 'nw' ? 'cursor-nwse-resize' : ''}
              ${handle === 'n' ? 'cursor-ns-resize' : ''}
              ${handle === 'ne' ? 'cursor-nesw-resize' : ''}
              ${handle === 'e' ? 'cursor-ew-resize' : ''}
              ${handle === 's' ? 'cursor-ns-resize' : ''}
              ${handle === 'sw' ? 'cursor-nesw-resize' : ''}
              ${handle === 'w' ? 'cursor-ew-resize' : ''}
              ${handle === 'se' ? 'cursor-nwse-resize' : ''}
            `}
            style={{
              width: RESIZE_HANDLE_SIZE,
              height: RESIZE_HANDLE_SIZE,
              left:
                handle === 'nw' || handle === 'w' || handle === 'sw'
                  ? RESIZE_HANDLE_OFFSET
                  : handle === 'n' || handle === 's'
                    ? `calc(50% - ${RESIZE_HANDLE_SIZE / 2}px)`
                    : undefined,
              right:
                handle === 'ne' || handle === 'e' || handle === 'se'
                  ? RESIZE_HANDLE_OFFSET
                  : undefined,
              top:
                handle === 'nw' || handle === 'n' || handle === 'ne'
                  ? RESIZE_HANDLE_OFFSET
                  : handle === 'e' || handle === 'w'
                    ? `calc(50% - ${RESIZE_HANDLE_SIZE / 2}px)`
                    : undefined,
              bottom:
                handle === 'sw' || handle === 's' || handle === 'se'
                  ? RESIZE_HANDLE_OFFSET
                  : undefined,
            }}
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={startResize(handle)}
          />
        ))}
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
