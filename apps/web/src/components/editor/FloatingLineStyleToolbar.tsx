import { useEffect } from 'react';
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react-dom';
import type { AnnotationStyle } from '@marker/shared';
import { LineStyleControls } from './LineStyleControls';

export function FloatingLineStyleToolbar({
  isOpen,
  reference,
  style,
  onChange,
  showMarkers = true,
  showStrokeWidth = true,
  showDash = true,
  colorTarget = 'stroke',
}: {
  isOpen: boolean;
  reference: HTMLElement | null;
  style: AnnotationStyle;
  onChange: (patch: Partial<AnnotationStyle>) => void;
  showMarkers?: boolean;
  showStrokeWidth?: boolean;
  showDash?: boolean;
  colorTarget?: 'stroke' | 'fill';
}) {
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

  if (!isOpen || !reference) {
    return null;
  }

  return (
    <div ref={refs.setFloating} style={floatingStyles} className="pointer-events-auto z-50">
      <div className="rounded-[1.25rem] border border-slate-200 bg-white/96 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur">
        <LineStyleControls
          style={style}
          onChange={onChange}
          showMarkers={showMarkers}
          showStrokeWidth={showStrokeWidth}
          showDash={showDash}
          colorTarget={colorTarget}
        />
      </div>
    </div>
  );
}
