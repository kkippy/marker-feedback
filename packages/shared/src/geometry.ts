import type { Annotation, AnnotationGeometry, RectGeometry } from './types';

export interface DragRectInput {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const normalizeRect = ({ x1, y1, x2, y2 }: DragRectInput): RectGeometry => ({
  kind: 'rect',
  x: Math.min(x1, x2),
  y: Math.min(y1, y2),
  width: Math.abs(x2 - x1),
  height: Math.abs(y2 - y1),
});

export const moveGeometry = (geometry: AnnotationGeometry, dx: number, dy: number): AnnotationGeometry => {
  switch (geometry.kind) {
    case 'rect':
      return { ...geometry, x: geometry.x + dx, y: geometry.y + dy };
    case 'text':
      return { ...geometry, x: geometry.x + dx, y: geometry.y + dy };
    case 'marker':
      return { ...geometry, x: geometry.x + dx, y: geometry.y + dy };
    case 'callout':
      return {
        ...geometry,
        target: {
          ...geometry.target,
          x: geometry.target.x + dx,
          y: geometry.target.y + dy
        },
        text: {
          ...geometry.text,
          x: geometry.text.x + dx,
          y: geometry.text.y + dy
        }
      };
    case 'image-callout':
      return {
        ...geometry,
        target: {
          ...geometry.target,
          x: geometry.target.x + dx,
          y: geometry.target.y + dy
        },
        panel: {
          ...geometry.panel,
          x: geometry.panel.x + dx,
          y: geometry.panel.y + dy
        }
      };
    case 'arrow':
      return {
        ...geometry,
        points: [
          geometry.points[0] + dx,
          geometry.points[1] + dy,
          geometry.points[2] + dx,
          geometry.points[3] + dy
        ]
      };
  }
};

export const getAnnotationBounds = (annotation: Annotation) => {
  const { geometry } = annotation;
  switch (geometry.kind) {
    case 'rect':
    case 'text':
      return { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height };
    case 'callout': {
      const left = Math.min(geometry.target.x, geometry.text.x);
      const top = Math.min(geometry.target.y, geometry.text.y);
      const right = Math.max(
        geometry.target.x + geometry.target.width,
        geometry.text.x + geometry.text.width
      );
      const bottom = Math.max(
        geometry.target.y + geometry.target.height,
        geometry.text.y + geometry.text.height
      );

      return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top
      };
    }
    case 'image-callout': {
      const left = Math.min(geometry.target.x, geometry.panel.x);
      const top = Math.min(geometry.target.y, geometry.panel.y);
      const right = Math.max(
        geometry.target.x + geometry.target.width,
        geometry.panel.x + geometry.panel.width
      );
      const bottom = Math.max(
        geometry.target.y + geometry.target.height,
        geometry.panel.y + geometry.panel.height
      );

      return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top
      };
    }
    case 'marker':
      return { x: geometry.x - 14, y: geometry.y - 14, width: 28, height: 28 };
    case 'arrow': {
      const [x1, y1, x2, y2] = geometry.points;
      return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1)
      };
    }
  }
};

export const isPointInsideAnnotation = (annotation: Annotation, x: number, y: number) => {
  const bounds = getAnnotationBounds(annotation);
  return x >= bounds.x && y >= bounds.y && x <= bounds.x + bounds.width && y <= bounds.y + bounds.height;
};
