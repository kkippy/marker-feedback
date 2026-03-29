import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContextMenuActionId, ContextMenuItem } from './contextMenuItems';
import { getContextMenuDockMotion } from './canvasContextMenuMotion';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const idleDockMotion = getContextMenuDockMotion(Number.POSITIVE_INFINITY);

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
  const itemRefs = useRef<Partial<Record<ContextMenuActionId, HTMLButtonElement | null>>>({});
  const wasOpenRef = useRef(false);
  const [position, setPosition] = useState({ x, y });
  const [transformOrigin, setTransformOrigin] = useState('20px 20px');
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const [isEntering, setIsEntering] = useState(isOpen);
  const [openSubmenuId, setOpenSubmenuId] = useState<ContextMenuActionId | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPointerPosition(null);
      setIsEntering(false);
      setOpenSubmenuId(null);
      wasOpenRef.current = false;
      return;
    }

    if (wasOpenRef.current) {
      return;
    }

    wasOpenRef.current = true;
    setIsEntering(true);
    const frameId = window.requestAnimationFrame(() => {
      setIsEntering(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

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
    const nextX = Math.min(Math.max(x, padding), maxX);
    const nextY = Math.min(Math.max(y, padding), maxY);
    const originX = clamp(x - nextX, 18, Math.max(18, menu.offsetWidth - 18));
    const originY = clamp(y - nextY, 18, Math.max(18, menu.offsetHeight - 18));

    setPosition({
      x: nextX,
      y: nextY,
    });
    setTransformOrigin(`${originX}px ${originY}px`);
  }, [isOpen, items.length, x, y]);

  const motionByItemId = useMemo(() => {
    if (!isOpen) {
      return Object.fromEntries(items.map((item) => [item.id, idleDockMotion])) as Record<
        ContextMenuActionId,
        typeof idleDockMotion
      >;
    }

    if (!pointerPosition || !menuRef.current) {
      return Object.fromEntries(items.map((item) => [item.id, idleDockMotion])) as Record<
        ContextMenuActionId,
        typeof idleDockMotion
      >;
    }

    const menuRect = menuRef.current.getBoundingClientRect();

    return items.reduce<Record<ContextMenuActionId, typeof idleDockMotion>>((accumulator, item) => {
      const itemElement = itemRefs.current[item.id];

      if (!itemElement) {
        accumulator[item.id] = idleDockMotion;
        return accumulator;
      }

      const itemRect = itemElement.getBoundingClientRect();
      const itemCenterX = itemRect.left - menuRect.left + itemRect.width / 2;
      const itemCenterY = itemRect.top - menuRect.top + itemRect.height / 2;
      const distance = Math.hypot(pointerPosition.x - itemCenterX, pointerPosition.y - itemCenterY);

      accumulator[item.id] = getContextMenuDockMotion(distance);
      return accumulator;
    }, {} as Record<ContextMenuActionId, typeof idleDockMotion>);
  }, [isOpen, items, pointerPosition]);

  if (!isOpen) {
    return null;
  }

  const style: CSSProperties = {
    left: position.x,
    top: position.y,
    transformOrigin,
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      data-state={isEntering ? 'opening' : 'open'}
      style={style}
      className={cn(
        'absolute z-30 w-max min-w-44 overflow-visible rounded-[22px] border border-white/70 bg-white/92 p-1.5 shadow-[0_20px_50px_rgba(15,23,42,0.16),0_8px_18px_rgba(15,23,42,0.10)] backdrop-blur-xl transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
        isEntering ? 'translate-y-2 scale-[0.92] opacity-0' : 'translate-y-0 scale-100 opacity-100',
      )}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointerPosition({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      }}
      onMouseLeave={() => setPointerPosition(null)}
    >
      {items.map((item) => (
        (() => {
          const motion = motionByItemId[item.id] ?? idleDockMotion;
          const itemStyle = {
            '--dock-item-scale': String(motion.itemScale),
            '--dock-icon-scale': String(motion.iconScale),
            '--dock-item-translate-y': `${motion.itemTranslateY}px`,
            '--dock-label-translate-x': `${motion.labelTranslateX}px`,
            '--dock-highlight-opacity': String(motion.highlightOpacity),
            transform: `translate3d(0, ${motion.itemTranslateY}px, 0) scale(${motion.itemScale})`,
          } as CSSProperties;

          const itemButton = (
            <button
              ref={(element) => {
                itemRefs.current[item.id] = element;
              }}
              type="button"
              role="menuitem"
              data-testid={`context-menu-item-${item.id}`}
              style={itemStyle}
              aria-haspopup={item.children ? 'menu' : undefined}
              aria-expanded={item.children ? openSubmenuId === item.id : undefined}
              className={cn(
                'relative flex w-full items-center gap-3 whitespace-nowrap rounded-2xl px-3.5 py-2.5 text-left text-[13px] font-medium tracking-[0.01em] transition-[background-color,color,box-shadow,transform] duration-200 ease-out will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70',
                item.danger
                  ? 'text-rose-600 hover:text-rose-700'
                  : 'text-slate-700 hover:text-slate-900',
              )}
              onClick={() => {
                if (!item.children) {
                  onSelect(item.id);
                }
              }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-200',
                  item.danger ? 'bg-rose-500/10' : 'bg-slate-900/[0.055]',
                )}
                style={{ opacity: motion.highlightOpacity }}
              />
              <span
                data-testid={`context-menu-item-icon-${item.id}`}
                className={cn(
                  'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-xl border transition-[transform,background-color,border-color] duration-200 ease-out',
                  item.danger
                    ? 'border-rose-200/80 bg-rose-50/90 text-rose-600'
                    : 'border-slate-200/80 bg-white/90 text-slate-600',
                )}
                style={{
                  transform: `scale(${motion.iconScale})`,
                }}
              >
                <item.icon className="size-4 shrink-0" />
              </span>
              <span
                className="relative z-10 pr-1 transition-transform duration-200 ease-out"
                style={{
                  transform: `translate3d(${motion.labelTranslateX}px, 0, 0)`,
                }}
              >
                {item.label}
              </span>
              {item.children ? (
                <ChevronRight className="relative z-10 ml-auto size-4 text-slate-400" />
              ) : null}
            </button>
          );

          if (!item.children?.length) {
            return <div key={item.id}>{itemButton}</div>;
          }

          return (
            <div
              key={item.id}
              className="relative"
              onMouseEnter={() => setOpenSubmenuId(item.id)}
              onMouseLeave={() => setOpenSubmenuId((current) => (current === item.id ? null : current))}
              onFocusCapture={() => setOpenSubmenuId(item.id)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setOpenSubmenuId((current) => (current === item.id ? null : current));
                }
              }}
            >
              {itemButton}
              <div
                className={cn(
                  'absolute left-full top-0 z-40 pl-2',
                  openSubmenuId === item.id ? 'pointer-events-auto' : 'pointer-events-none',
                )}
              >
                <div
                  role="menu"
                  className={cn(
                    'min-w-44 rounded-[22px] border border-white/70 bg-white/92 p-1.5 shadow-[0_20px_50px_rgba(15,23,42,0.16),0_8px_18px_rgba(15,23,42,0.10)] backdrop-blur-xl',
                    openSubmenuId === item.id ? 'block' : 'hidden',
                  )}
                >
                  {item.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      role="menuitem"
                      data-testid={`context-menu-item-${child.id}`}
                      className="group relative flex w-full items-center gap-3 whitespace-nowrap rounded-2xl px-3.5 py-2.5 text-left text-[13px] font-medium tracking-[0.01em] text-slate-700 transition-[background-color,color,box-shadow,transform] duration-200 ease-out hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
                      onClick={() => onSelect(child.id)}
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-2xl bg-slate-900/[0.055] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                      />
                      <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-600">
                        <child.icon className="size-4 shrink-0" />
                      </span>
                      <span className="relative z-10 pr-1">{child.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()
      ))}
    </div>
  );
}
