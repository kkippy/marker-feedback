export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface TextFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GetScaledFontSizeForResizeOptions {
  handle: ResizeHandle;
  startFrame: TextFrame;
  nextFrame: TextFrame;
  startFontSize: number;
  minFontSize: number;
  maxFontSize: number;
}

const CORNER_RESIZE_HANDLES = new Set<ResizeHandle>(['nw', 'ne', 'sw', 'se']);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface GetResizePreviewForHandleOptions {
  handle: ResizeHandle;
  startFrame: TextFrame;
  deltaX: number;
  deltaY: number;
  startFontSize: number;
  minimumWidth: number;
  minimumHeight: number;
  minFontSize: number;
  maxFontSize: number;
}

export const getScaledFontSizeForResize = ({
  handle,
  startFrame,
  nextFrame,
  startFontSize,
  minFontSize,
  maxFontSize,
}: GetScaledFontSizeForResizeOptions) => {
  if (!CORNER_RESIZE_HANDLES.has(handle) || startFrame.width <= 0 || startFrame.height <= 0) {
    return undefined;
  }

  const widthRatio = nextFrame.width / startFrame.width;
  const heightRatio = nextFrame.height / startFrame.height;
  const scaleRatio = Math.min(widthRatio, heightRatio);

  if (!Number.isFinite(scaleRatio) || scaleRatio <= 0) {
    return undefined;
  }

  return Number(clamp(startFontSize * scaleRatio, minFontSize, maxFontSize).toFixed(2));
};

export const getResizePreviewForHandle = ({
  handle,
  startFrame,
  deltaX,
  deltaY,
  startFontSize,
  minimumWidth,
  minimumHeight,
  minFontSize,
  maxFontSize,
}: GetResizePreviewForHandleOptions) => {
  let nextX = startFrame.x;
  let nextY = startFrame.y;
  let nextWidth = startFrame.width;
  let nextHeight = startFrame.height;

  if (handle === 'e' || handle === 'ne' || handle === 'se') {
    nextWidth = Math.max(minimumWidth, startFrame.width + deltaX);
  } else if (handle === 'w' || handle === 'nw' || handle === 'sw') {
    nextWidth = Math.max(minimumWidth, startFrame.width - deltaX);
    nextX = startFrame.x + (startFrame.width - nextWidth);
  }

  if (handle === 's' || handle === 'sw' || handle === 'se') {
    nextHeight = Math.max(minimumHeight, startFrame.height + deltaY);
  } else if (handle === 'n' || handle === 'nw' || handle === 'ne') {
    nextHeight = Math.max(minimumHeight, startFrame.height - deltaY);
    nextY = startFrame.y + (startFrame.height - nextHeight);
  }

  const frame = {
    x: Number(nextX.toFixed(2)),
    y: Number(nextY.toFixed(2)),
    width: Number(nextWidth.toFixed(2)),
    height: Number(nextHeight.toFixed(2)),
  };

  return {
    frame,
    fontSize: getScaledFontSizeForResize({
      handle,
      startFrame,
      nextFrame: frame,
      startFontSize,
      minFontSize,
      maxFontSize,
    }),
  };
};
