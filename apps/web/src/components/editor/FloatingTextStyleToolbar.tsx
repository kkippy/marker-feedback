import { useEffect } from 'react';
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react-dom';
import type { AnnotationStyle } from '@marker/shared';
import { TextStyleControls } from './TextStyleControls';

export function FloatingTextStyleToolbar({
  isOpen,
  reference,
  style,
  onChange,
  onCommit,
}: {
  isOpen: boolean;
  reference: HTMLElement | null;
  style: AnnotationStyle;
  onChange: (patch: Partial<AnnotationStyle>) => void;
  onCommit?: () => void;
}) {
  const { refs, floatingStyles, update } = useFloating({
    placement: 'top-start',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(10),
      flip({
        fallbackPlacements: ['bottom-start'],
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

  if (!isOpen || !reference) {
    return null;
  }

  return (
    <div ref={refs.setFloating} style={floatingStyles} className="pointer-events-auto z-50">
      <div className="rounded-[1.25rem] border border-slate-200 bg-white/96 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur">
        <TextStyleControls style={style} onChange={onChange} onCommit={onCommit} />
      </div>
    </div>
  );
}
