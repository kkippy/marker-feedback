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
