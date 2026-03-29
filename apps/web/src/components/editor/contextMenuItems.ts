import type { Annotation, AnnotationTool } from '@marker/shared';
import {
  ArrowRight,
  Copy,
  Highlighter,
  Hash,
  Minus,
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
  | 'line'
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
  tool?: Extract<AnnotationTool, 'rectangle' | 'line' | 'arrow' | 'highlight' | 'marker' | 'text'>;
}

export type ContextMenuTarget =
  | { kind: 'empty-space' }
  | { kind: 'annotation'; annotation: Annotation };

export interface ContextMenuLabels {
  addText: string;
  rectangle: string;
  line: string;
  arrow: string;
  highlight: string;
  marker: string;
  editText: string;
  copy: string;
  delete: string;
  bringToFront: string;
}

const defaultLabels: ContextMenuLabels = {
  addText: 'Add text',
  rectangle: 'Rectangle',
  line: 'Line',
  arrow: 'Arrow',
  highlight: 'Highlight',
  marker: 'Marker',
  editText: 'Edit text',
  copy: 'Copy',
  delete: 'Delete',
  bringToFront: 'Bring to front',
};

const getCreationItems = (labels: ContextMenuLabels): ContextMenuItem[] => [
  { id: 'add-text', label: labels.addText, icon: Type, tool: 'text' },
  { id: 'rectangle', label: labels.rectangle, icon: Square, tool: 'rectangle' },
  { id: 'line', label: labels.line, icon: Minus, tool: 'line' },
  { id: 'arrow', label: labels.arrow, icon: ArrowRight, tool: 'arrow' },
  { id: 'highlight', label: labels.highlight, icon: Highlighter, tool: 'highlight' },
  { id: 'marker', label: labels.marker, icon: Hash, tool: 'marker' },
];

const getObjectItems = (labels: ContextMenuLabels): ContextMenuItem[] => [
  { id: 'copy', label: labels.copy, icon: Copy },
  { id: 'delete', label: labels.delete, icon: Trash2, danger: true },
  { id: 'bring-to-front', label: labels.bringToFront, icon: MousePointer2 },
];

export const getContextMenuItems = (target: ContextMenuTarget, labels: ContextMenuLabels = defaultLabels): ContextMenuItem[] => {
  if (target.kind === 'empty-space') {
    return getCreationItems(labels);
  }

  if (target.annotation.tool === 'text') {
    return [{ id: 'edit-text', label: labels.editText, icon: ScanText }, ...getObjectItems(labels)];
  }

  return getObjectItems(labels);
};
