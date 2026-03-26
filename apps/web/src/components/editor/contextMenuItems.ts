import type { Annotation, AnnotationTool } from '@marker/shared';

export type ContextMenuActionId =
  | 'add-text'
  | 'rectangle'
  | 'arrow'
  | 'highlight'
  | 'marker'
  | 'edit'
  | 'edit-text'
  | 'copy'
  | 'delete'
  | 'bring-to-front';

export interface ContextMenuItem {
  id: ContextMenuActionId;
  label: string;
  tool?: Extract<AnnotationTool, 'rectangle' | 'arrow' | 'highlight' | 'marker' | 'text'>;
}

export type ContextMenuTarget =
  | { kind: 'empty-space' }
  | { kind: 'annotation'; annotation: Annotation };

const creationItems: ContextMenuItem[] = [
  { id: 'add-text', label: 'Add text', tool: 'text' },
  { id: 'rectangle', label: 'Rectangle', tool: 'rectangle' },
  { id: 'arrow', label: 'Arrow', tool: 'arrow' },
  { id: 'highlight', label: 'Highlight', tool: 'highlight' },
  { id: 'marker', label: 'Marker', tool: 'marker' },
];

const objectItems: ContextMenuItem[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'copy', label: 'Copy' },
  { id: 'delete', label: 'Delete' },
  { id: 'bring-to-front', label: 'Bring to front' },
];

export const getContextMenuItems = (target: ContextMenuTarget): ContextMenuItem[] => {
  if (target.kind === 'empty-space') {
    return creationItems;
  }

  if (target.annotation.tool === 'text') {
    return [objectItems[0], { id: 'edit-text', label: 'Edit text' }, ...objectItems.slice(1)];
  }

  return objectItems;
};
