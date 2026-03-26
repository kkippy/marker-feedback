import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import type { ContextMenuActionId, ContextMenuItem } from './contextMenuItems';

export function CanvasContextMenu({
  isOpen,
  x,
  y,
  items,
  onSelect,
}: {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onSelect: (actionId: ContextMenuActionId) => void;
}) {
  if (!isOpen) {
    return null;
  }

  const style: CSSProperties = {
    left: x,
    top: y,
  };

  return (
    <div
      role="menu"
      style={style}
      className="absolute z-30 min-w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
    >
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          className="flex w-full justify-start rounded-lg bg-transparent px-3 py-2 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
