import type { RectGeometry } from '@marker/shared';
import type { ResizeHandle } from './textResizeScaling';

export type RectResizeHandle = ResizeHandle;

export const RECT_RESIZE_HANDLES: RectResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const round = (value: number) => Number(value.toFixed(2));

export const getRectHandlePosition = (
  handle: RectResizeHandle,
  geometry: Pick<RectGeometry, 'width' | 'height'>,
) => {
  const centerX = geometry.width / 2;
  const centerY = geometry.height / 2;

  switch (handle) {
    case 'nw':
      return { x: 0, y: 0 };
    case 'n':
      return { x: centerX, y: 0 };
    case 'ne':
      return { x: geometry.width, y: 0 };
    case 'e':
      return { x: geometry.width, y: centerY };
    case 'se':
      return { x: geometry.width, y: geometry.height };
    case 's':
      return { x: centerX, y: geometry.height };
    case 'sw':
      return { x: 0, y: geometry.height };
    case 'w':
      return { x: 0, y: centerY };
  }
};

export const getRectEdgeHandleFrame = (
  handle: Extract<RectResizeHandle, 'n' | 'e' | 's' | 'w'>,
  geometry: Pick<RectGeometry, 'width' | 'height'>,
  edgeHandleWidth: number,
  edgeHandleHeight: number,
) => {
  const position = getRectHandlePosition(handle, geometry);
  const isVertical = handle === 'e' || handle === 'w';
  const width = isVertical ? edgeHandleHeight : edgeHandleWidth;
  const height = isVertical ? edgeHandleWidth : edgeHandleHeight;

  return {
    x: position.x,
    y: position.y,
    width,
    height,
    offsetX: width / 2,
    offsetY: height / 2,
  };
};

export const getRectHandleDragOrigin = (
  handle: RectResizeHandle,
  geometry: RectGeometry,
) => {
  const position = getRectHandlePosition(handle, geometry);

  return {
    x: geometry.x + position.x,
    y: geometry.y + position.y,
  };
};

export const getRectHandleCursor = (handle: RectResizeHandle) => {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
  }
};

interface GetRectResizePreviewForHandleOptions {
  handle: RectResizeHandle;
  startGeometry: RectGeometry;
  deltaX: number;
  deltaY: number;
  minimumWidth: number;
  minimumHeight: number;
}

export const getRectResizePreviewForHandle = ({
  handle,
  startGeometry,
  deltaX,
  deltaY,
  minimumWidth,
  minimumHeight,
}: GetRectResizePreviewForHandleOptions): RectGeometry => {
  let nextX = startGeometry.x;
  let nextY = startGeometry.y;
  let nextWidth = startGeometry.width;
  let nextHeight = startGeometry.height;

  if (handle === 'e' || handle === 'ne' || handle === 'se') {
    nextWidth = Math.max(minimumWidth, startGeometry.width + deltaX);
  } else if (handle === 'w' || handle === 'nw' || handle === 'sw') {
    nextWidth = Math.max(minimumWidth, startGeometry.width - deltaX);
    nextX = startGeometry.x + (startGeometry.width - nextWidth);
  }

  if (handle === 's' || handle === 'sw' || handle === 'se') {
    nextHeight = Math.max(minimumHeight, startGeometry.height + deltaY);
  } else if (handle === 'n' || handle === 'nw' || handle === 'ne') {
    nextHeight = Math.max(minimumHeight, startGeometry.height - deltaY);
    nextY = startGeometry.y + (startGeometry.height - nextHeight);
  }

  return {
    kind: 'rect',
    x: round(nextX),
    y: round(nextY),
    width: round(nextWidth),
    height: round(nextHeight),
  };
};
