import type { Annotation, AnnotationTool } from '@marker/shared';
import {
  ArrowRight,
  Copy,
  Highlighter,
  Hash,
  MousePointer2,
  ScanText,
  Square,
  Trash2,
  Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ContextMenuActionId =
  | 'add-text'
  | 'rectangle'
  | 'arrow'
  | 'highlight'
  | 'marker'
  | 'edit-text'
  | 'copy'
  | 'delete'
  | 'bring-to-front';

export interface ContextMenuItem {
  id: ContextMenuActionId;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  tool?: Extract<AnnotationTool, 'rectangle' | 'arrow' | 'highlight' | 'marker' | 'text'>;
}

export type ContextMenuTarget =
  | { kind: 'empty-space' }
  | { kind: 'annotation'; annotation: Annotation };

const creationItems: ContextMenuItem[] = [
  { id: 'add-text', label: 'Add text', icon: Type, tool: 'text' },
  { id: 'rectangle', label: 'Rectangle', icon: Square, tool: 'rectangle' },
  { id: 'arrow', label: 'Arrow', icon: ArrowRight, tool: 'arrow' },
  { id: 'highlight', label: 'Highlight', icon: Highlighter, tool: 'highlight' },
  { id: 'marker', label: 'Marker', icon: Hash, tool: 'marker' },
];

const objectItems: ContextMenuItem[] = [
  { id: 'copy', label: 'Copy', icon: Copy },
  { id: 'delete', label: 'Delete', icon: Trash2, danger: true },
  { id: 'bring-to-front', label: 'Bring to front', icon: MousePointer2 },
];

export const getContextMenuItems = (target: ContextMenuTarget): ContextMenuItem[] => {
  if (target.kind === 'empty-space') {
    return creationItems;
  }

  if (target.annotation.tool === 'text') {
    return [{ id: 'edit-text', label: 'Edit text', icon: ScanText }, ...objectItems];
  }

  return objectItems;
};
