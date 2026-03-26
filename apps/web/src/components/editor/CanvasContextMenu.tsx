import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
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
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const menu = menuRef.current;
    const frame = menu?.parentElement;

    if (!menu || !frame) {
      setPosition({ x, y });
      return;
    }

    const padding = 12;
    const maxX = Math.max(padding, frame.clientWidth - menu.offsetWidth - padding);
    const maxY = Math.max(padding, frame.clientHeight - menu.offsetHeight - padding);

    setPosition({
      x: Math.min(Math.max(x, padding), maxX),
      y: Math.min(Math.max(y, padding), maxY),
    });
  }, [isOpen, items.length, x, y]);

  if (!isOpen) {
    return null;
  }

  const style: CSSProperties = {
    left: position.x,
    top: position.y,
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      style={style}
      className="absolute z-30 w-max min-w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={cn(
            'flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition',
            item.danger
              ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
          )}
          onClick={() => onSelect(item.id)}
        >
          <item.icon className="size-4 shrink-0" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
