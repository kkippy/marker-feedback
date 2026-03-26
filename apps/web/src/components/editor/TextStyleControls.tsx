import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnnotationStyle } from '@marker/shared';
import { Bold, Italic, Pipette, Type, Underline } from 'lucide-react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { cn } from '@/lib/utils';

const FONT_SIZE_OPTIONS = [14, 18, 24, 32];
const COLOR_OPTIONS = ['#0f172a', '#dc2626', '#ea580c', '#16a34a', '#2563eb', '#7c3aed'];
const BACKGROUND_OPTIONS = ['transparent', '#fef08a', '#fde68a', '#bfdbfe', '#ddd6fe', '#fecdd3'];

const normalizeHexColor = (value: string) => {
  const cleaned = value.trim().replace(/[^0-9a-fA-F]/g, '').slice(0, 6);

  if (!cleaned) {
    return '#000000';
  }

  if (cleaned.length === 3) {
    return `#${cleaned
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`.toLowerCase();
  }

  return `#${cleaned.padEnd(6, '0')}`.toLowerCase();
};

export function TextStyleControls({
  style,
  onChange,
  onCommit,
}: {
  style: AnnotationStyle;
  onChange: (patch: Partial<AnnotationStyle>) => void;
  onCommit?: () => void;
}) {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const fontSize = style.fontSize ?? 14;
  const fontWeight = style.fontWeight ?? 'normal';
  const fontStyle = style.fontStyle ?? 'normal';
  const textDecoration = style.textDecoration ?? 'none';
  const textColor = style.textColor ?? '#0f172a';
  const textBackgroundColor = style.textBackgroundColor ?? 'transparent';
  const normalizedTextColor = useMemo(() => normalizeHexColor(textColor), [textColor]);

  useEffect(() => {
    if (!isColorPickerOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!colorPickerRef.current?.contains(event.target as Node)) {
        setIsColorPickerOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isColorPickerOpen]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-slate-600">
        <Type className="size-4 text-slate-500" />
        <select
          aria-label="Text size"
          className="bg-transparent text-sm font-medium text-slate-700 outline-none"
          value={fontSize}
          onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
        >
          {FONT_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}px
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        aria-label="Bold text"
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-full border text-sm transition',
          fontWeight === 'bold'
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
        )}
        onClick={() => onChange({ fontWeight: fontWeight === 'bold' ? 'normal' : 'bold' })}
      >
        <Bold className="size-4" />
      </button>

      <button
        type="button"
        aria-label="Italic text"
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-full border text-sm transition',
          fontStyle === 'italic'
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
        )}
        onClick={() => onChange({ fontStyle: fontStyle === 'italic' ? 'normal' : 'italic' })}
      >
        <Italic className="size-4" />
      </button>

      <button
        type="button"
        aria-label="Underline text"
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-full border text-sm transition',
          textDecoration === 'underline'
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
        )}
        onClick={() => onChange({ textDecoration: textDecoration === 'underline' ? 'none' : 'underline' })}
      >
        <Underline className="size-4" />
      </button>

      <div className="flex items-center gap-1 rounded-full bg-white px-2 py-1">
        {COLOR_OPTIONS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Text color ${color}`}
            className={cn(
              'flex size-6 items-center justify-center rounded-full border transition',
              textColor === color ? 'border-slate-900' : 'border-transparent hover:border-slate-300',
            )}
            onClick={() => onChange({ textColor: color })}
          >
            <span
              className="size-3.5 rounded-full border border-black/5"
              style={{ backgroundColor: color }}
            />
          </button>
        ))}

        <div ref={colorPickerRef} className="relative">
          <button
            type="button"
            aria-label="Custom text color"
            className={cn(
              'flex size-6 items-center justify-center rounded-full border bg-white text-slate-600 transition',
              isColorPickerOpen ? 'border-slate-900' : 'border-slate-200 hover:border-slate-300',
            )}
            onClick={() => setIsColorPickerOpen((current) => !current)}
          >
            <Pipette className="size-3.5" />
          </button>

          {isColorPickerOpen ? (
            <div className="absolute right-0 top-full z-20 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <HexColorPicker color={normalizedTextColor} onChange={(color) => onChange({ textColor: color })} />
              <div className="mt-3 flex items-center gap-2">
                <span
                  className="size-8 rounded-lg border border-slate-200"
                  style={{ backgroundColor: normalizedTextColor }}
                  aria-hidden
                />
                <HexColorInput
                  aria-label="Custom text color hex value"
                  color={normalizedTextColor}
                  prefixed
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                  onChange={(color) => onChange({ textColor: normalizeHexColor(color) })}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
                      return;
                    }

                    event.preventDefault();
                    setIsColorPickerOpen(false);
                    onCommit?.();
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-full bg-white px-2 py-1">
        {BACKGROUND_OPTIONS.map((color) => {
          const isTransparent = color === 'transparent';
          const selected = textBackgroundColor === color;

          return (
            <button
              key={color}
              type="button"
              aria-label={isTransparent ? 'Clear text background' : `Text background ${color}`}
              className={cn(
                'flex size-6 items-center justify-center rounded-full border transition',
                selected ? 'border-slate-900' : 'border-transparent hover:border-slate-300',
              )}
              onClick={() => onChange({ textBackgroundColor: color })}
            >
              {isTransparent ? (
                <span className="text-xs font-semibold text-slate-400">×</span>
              ) : (
                <span
                  className="size-3.5 rounded-full border border-black/5"
                  style={{ backgroundColor: color }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
