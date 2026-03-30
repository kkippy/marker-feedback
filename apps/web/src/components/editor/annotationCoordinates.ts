export const toDocumentLocalPoint = ({
  workspacePoint,
  documentPosition,
}: {
  workspacePoint: { x: number; y: number };
  documentPosition: { x: number; y: number };
}) => ({
  x: workspacePoint.x - documentPosition.x,
  y: workspacePoint.y - documentPosition.y,
});

export const toWorkspacePointFromViewport = ({
  framePoint,
  viewport,
}: {
  framePoint: { x: number; y: number };
  viewport: {
    canvasScale: number;
    scrollLeft: number;
    scrollTop: number;
    layerOffsetX: number;
    layerOffsetY: number;
  };
}) => ({
  x: (framePoint.x + viewport.scrollLeft - viewport.layerOffsetX) / viewport.canvasScale,
  y: (framePoint.y + viewport.scrollTop - viewport.layerOffsetY) / viewport.canvasScale,
});

export const toDocumentLocalPointFromViewport = ({
  framePoint,
  viewport,
  documentPosition,
}: {
  framePoint: { x: number; y: number };
  viewport: {
    canvasScale: number;
    scrollLeft: number;
    scrollTop: number;
    layerOffsetX: number;
    layerOffsetY: number;
  };
  documentPosition: { x: number; y: number };
}) =>
  toDocumentLocalPoint({
    workspacePoint: toWorkspacePointFromViewport({ framePoint, viewport }),
    documentPosition,
  });
