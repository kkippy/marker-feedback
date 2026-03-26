import type { TextGeometry } from '@marker/shared';

export interface InlineTextOverlayInput {
  annotationGeometry: TextGeometry;
  documentPosition: { x: number; y: number };
  canvasScale: number;
  layerOffsetX: number;
  layerOffsetY: number;
  scrollLeft: number;
  scrollTop: number;
}

export interface InlineTextOverlayStyle {
  left: number;
  top: number;
  width: number;
  minHeight: number;
}

export const getInlineTextOverlayStyle = ({
  annotationGeometry,
  documentPosition,
  canvasScale,
  layerOffsetX,
  layerOffsetY,
  scrollLeft,
  scrollTop,
}: InlineTextOverlayInput): InlineTextOverlayStyle => ({
  left: (documentPosition.x + annotationGeometry.x) * canvasScale + layerOffsetX - scrollLeft,
  top: (documentPosition.y + annotationGeometry.y) * canvasScale + layerOffsetY - scrollTop,
  width: annotationGeometry.width * canvasScale,
  minHeight: annotationGeometry.height * canvasScale,
});
