import type { AnnotationTool } from '@marker/shared';

const SINGLE_USE_CANVAS_TOOLS = new Set<AnnotationTool>([
  'line',
  'rectangle',
  'polygon',
  'arrow',
  'highlight',
  'marker',
]);

export const getNextToolAfterCanvasCreate = (tool: AnnotationTool): AnnotationTool =>
  SINGLE_USE_CANVAS_TOOLS.has(tool) ? 'select' : tool;
