const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const getViewportScrollForWorkspacePoint = ({
  target,
  canvasScale,
  layerOffsetX,
  layerOffsetY,
  viewportWidth,
  viewportHeight,
  stageWidth,
  stageHeight,
}: {
  target: { x: number; y: number };
  canvasScale: number;
  layerOffsetX: number;
  layerOffsetY: number;
  viewportWidth: number;
  viewportHeight: number;
  stageWidth: number;
  stageHeight: number;
}) => {
  const rawLeft = target.x * canvasScale + layerOffsetX - viewportWidth / 2;
  const rawTop = target.y * canvasScale + layerOffsetY - viewportHeight / 2;

  return {
    left: clamp(rawLeft, 0, Math.max(0, stageWidth - viewportWidth)),
    top: clamp(rawTop, 0, Math.max(0, stageHeight - viewportHeight)),
  };
};
