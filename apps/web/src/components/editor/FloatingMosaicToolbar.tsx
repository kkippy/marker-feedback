import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react-dom';
import { MAX_MOSAIC_CELL_SIZE, MIN_MOSAIC_CELL_SIZE, normalizeMosaicCellSize } from './mosaicCanvas';

const SCRUB_PIXELS_PER_STEP = 8;
const DEFAULT_MOSAIC_VALUE = 12;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const formatValue = (value: number) => normalizeMosaicCellSize(value).toString();

function MosaicToolbarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      data-testid="mosaic-toolbar-icon"
      className={className}
    >
      <rect x="1.75" y="1.75" width="2.5" height="2.5" rx="0.9" fill="currentColor" opacity="0.92" />
      <rect x="6.75" y="1.75" width="2.5" height="2.5" rx="0.9" fill="currentColor" opacity="0.42" />
      <rect x="11.75" y="1.75" width="2.5" height="2.5" rx="0.9" fill="currentColor" opacity="0.92" />
      <rect x="1.75" y="6.75" width="2.5" height="2.5" rx="0.9" fill="currentColor" opacity="0.42" />
      <rect x="6.75" y="6.75" width="2.5" height="2.5" rx="0.9" fill="currentColor" opacity="0.92" />
      <rect x="11.75" y="6.75" width="2.5" height="2.5" rx="0.9" fill="currentColor" opacity="0.42" />
      <rect x="1.75" y="11.75" width="2.5" height="2.5" rx="0.9" fill="currentColor" opacity="0.92" />
      <rect x="6.75" y="11.75" width="2.5" height="2.5" rx="0.9" fill="currentColor" opacity="0.42" />
      <rect x="11.75" y="11.75" width="2.5" height="2.5" rx="0.9" fill="currentColor" opacity="0.92" />
    </svg>
  );
}

export function FloatingMosaicToolbar({
  isOpen,
  reference,
  label,
  scrubLabel,
  value,
  onChange,
}: {
  isOpen: boolean;
  reference: HTMLElement | null;
  label: string;
  scrubLabel: string;
  value?: number;
  onChange: (value: number) => void;
}) {
  const normalizedValue = normalizeMosaicCellSize(value);
  const scrubStateRef = useRef<{
    startClientX: number;
    startValue: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { refs, floatingStyles, update } = useFloating({
    placement: 'top',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(18),
      flip({
        fallbackPlacements: ['bottom'],
      }),
      shift({ padding: 8 }),
    ],
  });

  useEffect(() => {
    refs.setReference(reference);
  }, [reference, refs]);

  useEffect(() => {
    if (!isOpen || !reference) {
      return;
    }

    void update();
  }, [isOpen, reference, update]);

  useEffect(() => {
    const handlePointerMove = (event: Pick<PointerEvent, 'clientX' | 'shiftKey'> | Pick<MouseEvent, 'clientX' | 'shiftKey'>) => {
      const scrubState = scrubStateRef.current;

      if (!scrubState) {
        return;
      }

      const pointerX = Number.isFinite(event.clientX) ? event.clientX : scrubState.startClientX;
      const deltaX = pointerX - scrubState.startClientX;
      const speed = event.shiftKey ? 0.25 : 1;
      const nextValue = clamp(
        Math.round(scrubState.startValue + (deltaX / SCRUB_PIXELS_PER_STEP) * speed),
        MIN_MOSAIC_CELL_SIZE,
        MAX_MOSAIC_CELL_SIZE,
      );

      onChange(nextValue);
    };

    const handlePointerUp = () => {
      scrubStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [onChange]);

  if (!isOpen || !reference) {
    return null;
  }

  return (
    <div ref={refs.setFloating} style={floatingStyles} className="pointer-events-auto z-50">
      <div className="inline-flex items-center gap-2 rounded-[1.35rem] border border-slate-200 bg-white/96 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur">
        <div className="flex items-center rounded-full bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          {label}
        </div>
        <button
          type="button"
          aria-label={scrubLabel}
          title={scrubLabel}
          className={`flex min-w-[92px] cursor-ew-resize items-center justify-start gap-2 rounded-full px-2.5 py-2 text-sm font-semibold tabular-nums transition ${
            isDragging
              ? 'bg-white text-slate-900 shadow-[0_8px_22px_rgba(15,23,42,0.16)]'
              : 'bg-white text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] hover:bg-slate-50'
          }`}
          onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
            event.preventDefault();
            scrubStateRef.current = {
              startClientX: Number.isFinite(event.clientX) ? event.clientX : 0,
              startValue: normalizedValue,
            };
            setIsDragging(true);
          }}
          onDoubleClick={() => onChange(DEFAULT_MOSAIC_VALUE)}
          onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              onChange(normalizedValue - 1);
              return;
            }

            if (event.key === 'ArrowRight') {
              event.preventDefault();
              onChange(normalizedValue + 1);
              return;
            }

            if (event.key === 'Home') {
              event.preventDefault();
              onChange(MIN_MOSAIC_CELL_SIZE);
              return;
            }

            if (event.key === 'End') {
              event.preventDefault();
              onChange(MAX_MOSAIC_CELL_SIZE);
            }
          }}
        >
          <span
            data-testid="mosaic-toolbar-icon-tile"
            className="flex size-6 shrink-0 items-center justify-center rounded-[0.6rem] bg-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]"
          >
            <MosaicToolbarIcon className={`size-[0.95rem] ${isDragging ? 'text-slate-500' : 'text-slate-400'}`} />
          </span>
          <span data-testid="mosaic-toolbar-value" className="min-w-[2ch] text-right">
            {formatValue(normalizedValue)}
          </span>
        </button>
      </div>
    </div>
  );
}
