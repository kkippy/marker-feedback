import type { Annotation, AnnotationTool } from '@marker/shared';
import {
  ArrowRight,
  Copy,
  Highlighter,
  Hash,
  Image,
  MessageSquare,
  Minus,
  MousePointer2,
  PenTool,
  RefreshCw,
  ScanText,
  Square,
  Trash2,
  Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ContextMenuActionId =
  | 'add-text'
  | 'rectangle'
  | 'polygon'
  | 'line'
  | 'arrow'
  | 'highlight'
  | 'marker'
  | 'callout-group'
  | 'callout'
  | 'image-callout'
  | 'edit-text'
  | 'replace-image'
  | 'copy'
  | 'delete'
  | 'bring-to-front';

export interface ContextMenuItem {
  id: ContextMenuActionId;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  children?: ContextMenuItem[];
  tool?: Extract<
    AnnotationTool,
    'rectangle' | 'polygon' | 'line' | 'arrow' | 'highlight' | 'marker' | 'text' | 'callout' | 'image-callout'
  >;
}

export type ContextMenuTarget =
  | { kind: 'empty-space' }
  | { kind: 'annotation'; annotation: Annotation };

export interface ContextMenuLabels {
  addText: string;
  rectangle: string;
  polygon: string;
  line: string;
  arrow: string;
  highlight: string;
  marker: string;
  calloutGroup?: string;
  callout: string;
  imageCallout: string;
  editText: string;
  replaceImage: string;
  copy: string;
  delete: string;
  bringToFront: string;
}

const defaultLabels: ContextMenuLabels = {
  addText: 'Add text',
  rectangle: 'Rectangle',
  polygon: 'Irregular Area',
  line: 'Line',
  arrow: 'Arrow',
  highlight: 'Highlight',
  marker: 'Marker',
  calloutGroup: 'Callout',
  callout: 'Text callout',
  imageCallout: 'Image callout',
  editText: 'Edit text',
  replaceImage: 'Replace image',
  copy: 'Copy',
  delete: 'Delete',
  bringToFront: 'Bring to front',
};

const getCreationItems = (labels: ContextMenuLabels): ContextMenuItem[] => [
  { id: 'add-text', label: labels.addText, icon: Type, tool: 'text' },
  { id: 'rectangle', label: labels.rectangle, icon: Square, tool: 'rectangle' },
  { id: 'polygon', label: labels.polygon, icon: PenTool, tool: 'polygon' },
  { id: 'line', label: labels.line, icon: Minus, tool: 'line' },
  { id: 'arrow', label: labels.arrow, icon: ArrowRight, tool: 'arrow' },
  { id: 'highlight', label: labels.highlight, icon: Highlighter, tool: 'highlight' },
  { id: 'marker', label: labels.marker, icon: Hash, tool: 'marker' },
  {
    id: 'callout-group',
    label: labels.calloutGroup ?? 'Callout',
    icon: MessageSquare,
    children: [
      { id: 'callout', label: labels.callout, icon: MessageSquare, tool: 'callout' },
      { id: 'image-callout', label: labels.imageCallout, icon: Image, tool: 'image-callout' },
    ],
  },
];

const getObjectItems = (labels: ContextMenuLabels): ContextMenuItem[] => [
  { id: 'copy', label: labels.copy, icon: Copy },
  { id: 'delete', label: labels.delete, icon: Trash2, danger: true },
  { id: 'bring-to-front', label: labels.bringToFront, icon: MousePointer2 },
];

export const getContextMenuItems = (
  target: ContextMenuTarget,
  labels: ContextMenuLabels = defaultLabels,
): ContextMenuItem[] => {
  if (target.kind === 'empty-space') {
    return getCreationItems(labels);
  }

  if (target.annotation.tool === 'text' || target.annotation.tool === 'callout') {
    return [{ id: 'edit-text', label: labels.editText, icon: ScanText }, ...getObjectItems(labels)];
  }

  if (target.annotation.tool === 'image-callout') {
    return [{ id: 'replace-image', label: labels.replaceImage, icon: RefreshCw }, ...getObjectItems(labels)];
  }

  return getObjectItems(labels);
};
