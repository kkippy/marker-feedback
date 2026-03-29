import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { AnnotationStyle } from '@marker/shared';
import { ChevronDown, Pipette } from 'lucide-react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { Input } from '@/components/ui/input';
import { useLocale } from '@/lib/locale';
import { cn } from '@/lib/utils';
import { getContextMenuDockMotion } from './canvasContextMenuMotion';

const COLOR_OPTIONS = ['#0f172a', '#dc2626', '#ea580c', '#16a34a', '#2563eb'];
const MIN_STROKE_WIDTH = 1;
const MAX_STROKE_WIDTH = 24;
const MIN_DASH_SIZE = 0;
const MAX_DASH_SIZE = 24;
const NUMERIC_STEP = 0.5;
const DRAG_PIXELS_PER_STEP = 8;
const idleDockMotion = getContextMenuDockMotion(Number.POSITIVE_INFINITY);

type NumericControlType = 'strokeWidth' | 'lineDashSize';
type MarkerStyle = NonNullable<AnnotationStyle['lineStartMarker']>;
type MarkerMenuTarget = 'start' | 'end' | null;

const MARKER_OPTIONS: MarkerStyle[] = ['none', 'arrow', 'bar', 'dot'];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

const normalizeNumericValue = (value: number, min: number, max: number) =>
  clamp(Math.round(value / NUMERIC_STEP) * NUMERIC_STEP, min, max);

const formatNumericValue = (value: number) => {
  const normalized = Math.max(0, Number(value.toFixed(1)));
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
};

const getNumericBounds = (type: NumericControlType) =>
  type === 'strokeWidth'
    ? { min: MIN_STROKE_WIDTH, max: MAX_STROKE_WIDTH }
    : { min: MIN_DASH_SIZE, max: MAX_DASH_SIZE };

function StrokeWidthIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M6 3.5L3.5 8L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 3.5L12.5 8L10 12.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function DashPatternIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="2.2 2"
      />
    </svg>
  );
}

function MarkerPreview({
  marker,
  direction,
  active = false,
}: {
  marker: MarkerStyle;
  direction: 'start' | 'end';
  active?: boolean;
}) {
  const stroke = active ? 'currentColor' : '#475569';
  const fill = active ? 'currentColor' : '#475569';
  const lineStartX = direction === 'start' ? 24 : 8;
  const lineEndX = direction === 'start' ? 8 : 24;
  const markerX = direction === 'start' ? 8 : 24;
  const centerY = 16;

  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
      <line
        x1={lineStartX}
        y1={centerY}
        x2={lineEndX}
        y2={centerY}
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {marker === 'arrow' ? (
        direction === 'start' ? (
          <path d="M14 11L8 16L14 21" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ) : (
          <path d="M18 11L24 16L18 21" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        )
      ) : null}
      {marker === 'bar' ? (
        <line
          x1={markerX}
          y1="10"
          x2={markerX}
          y2="22"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ) : null}
      {marker === 'dot' ? <circle cx={markerX} cy={centerY} r="3.5" fill={fill} /> : null}
    </svg>
  );
}

function MarkerDropdown({
  direction,
  menuLabel,
  value,
  isOpen,
  pointerPosition,
  optionLabel,
  onOpenChange,
  onPointerPositionChange,
  onChange,
}: {
  direction: 'start' | 'end';
  menuLabel: string;
  value: MarkerStyle;
  isOpen: boolean;
  pointerPosition: { x: number; y: number } | null;
  optionLabel: (value: MarkerStyle) => string;
  onOpenChange: (open: boolean) => void;
  onPointerPositionChange: (point: { x: number; y: number } | null) => void;
  onChange: (nextValue: MarkerStyle) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Partial<Record<MarkerStyle, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.parentElement?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, onOpenChange]);

  const motionByMarker = useMemo(() => {
    if (!isOpen || !pointerPosition || !menuRef.current) {
      return Object.fromEntries(MARKER_OPTIONS.map((option) => [option, idleDockMotion])) as Record<
        MarkerStyle,
        typeof idleDockMotion
      >;
    }

    const menuRect = menuRef.current.getBoundingClientRect();

    return MARKER_OPTIONS.reduce<Record<MarkerStyle, typeof idleDockMotion>>((accumulator, option) => {
      const itemElement = itemRefs.current[option];

      if (!itemElement) {
        accumulator[option] = idleDockMotion;
        return accumulator;
      }

      const itemRect = itemElement.getBoundingClientRect();
      const itemCenterX = itemRect.left - menuRect.left + itemRect.width / 2;
      const itemCenterY = itemRect.top - menuRect.top + itemRect.height / 2;
      const distance = Math.hypot(pointerPosition.x - itemCenterX, pointerPosition.y - itemCenterY);

      accumulator[option] = getContextMenuDockMotion(distance);
      return accumulator;
    }, {} as Record<MarkerStyle, typeof idleDockMotion>);
  }, [isOpen, pointerPosition]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={menuLabel}
        title={menuLabel}
        className={cn(
          'flex h-8 items-center gap-0.5 rounded-full border px-2 text-slate-700 transition',
          isOpen ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-300',
        )}
        onPointerDown={(event) => {
          event.preventDefault();
          onOpenChange(!isOpen);
        }}
      >
        <MarkerPreview marker={value} direction={direction} active={isOpen} />
        <ChevronDown className="size-3.5" />
      </button>

      {isOpen ? (
        <div
          ref={menuRef}
          className="absolute left-1/2 top-full z-20 mt-2 flex -translate-x-1/2 flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur"
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onPointerPositionChange({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            });
          }}
          onMouseLeave={() => onPointerPositionChange(null)}
        >
          {MARKER_OPTIONS.map((option) => {
            const motion = motionByMarker[option] ?? idleDockMotion;
            const itemStyle = {
              transform: `translate3d(0, ${motion.itemTranslateY}px, 0) scale(${motion.itemScale})`,
            } as CSSProperties;

            return (
              <button
                key={option}
                ref={(element) => {
                  itemRefs.current[option] = element;
                }}
                type="button"
                aria-label={`${menuLabel}: ${optionLabel(option)}`}
                title={`${menuLabel}: ${optionLabel(option)}`}
                style={itemStyle}
                className={cn(
                  'relative flex size-11 items-center justify-center rounded-xl transition-[transform,background-color,color] duration-200 ease-out',
                  option === value ? 'bg-orange-400 text-white' : 'bg-white text-slate-600 hover:bg-slate-100',
                )}
                onPointerDown={(event) => {
                  event.preventDefault();
                  onChange(option);
                  onOpenChange(false);
                }}
              >
                <span
                  className="pointer-events-none absolute inset-0 rounded-xl bg-slate-900/[0.055] transition-opacity duration-200"
                  style={{ opacity: option === value ? 0 : motion.highlightOpacity }}
                />
                <span
                  className="relative z-10 transition-transform duration-200 ease-out"
                  style={{ transform: `scale(${motion.iconScale})` }}
                >
                  <MarkerPreview marker={option} direction={direction} active={option === value} />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function NumericScrubInput({
  label,
  scrubLabel,
  icon,
  type,
  value,
  inputValue,
  onInputValueChange,
  onChange,
}: {
  label: string;
  scrubLabel: string;
  icon: ReactNode;
  type: NumericControlType;
  value: number;
  inputValue: string;
  onInputValueChange: (nextValue: string) => void;
  onChange: (nextValue: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrubStateRef = useRef<{ startClientX: number; startValue: number } | null>(null);
  const latestValueRef = useRef(value);
  const latestOnChangeRef = useRef(onChange);
  const latestOnInputValueChangeRef = useRef(onInputValueChange);
  const isFocusedRef = useRef(false);
  const [isFocused, setIsFocused] = useState(false);
  const { min, max } = getNumericBounds(type);
  const formattedValue = formatNumericValue(value);
  const displayValue = isFocused ? inputValue : inputValue || formattedValue;

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      const nextFormattedValue = formattedValue;

      if (inputValue !== nextFormattedValue) {
        onInputValueChange(nextFormattedValue);
      }
    }
  }, [formattedValue, inputValue, onInputValueChange]);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    latestOnChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    latestOnInputValueChangeRef.current = onInputValueChange;
  }, [onInputValueChange]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const scrubState = scrubStateRef.current;

      if (!scrubState) {
        return;
      }

      const deltaX = event.clientX - scrubState.startClientX;
      const rawValue = scrubState.startValue + (deltaX / DRAG_PIXELS_PER_STEP) * NUMERIC_STEP;
      const nextValue = normalizeNumericValue(rawValue, min, max);
      onChange(nextValue);
      onInputValueChange(formatNumericValue(nextValue));
    };

    const handlePointerUp = () => {
      scrubStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [max, min, onChange, onInputValueChange]);

  const commitInput = (rawValue: string) => {
    const parsed = Number.parseFloat(rawValue.trim());
    const nextValue = Number.isFinite(parsed) ? normalizeNumericValue(parsed, min, max) : normalizeNumericValue(value, min, max);
    onChange(nextValue);
    onInputValueChange(formatNumericValue(nextValue));
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!isFocusedRef.current) {
        return;
      }

      const inputElement = inputRef.current;

      if (!inputElement || inputElement.contains(event.target as Node)) {
        return;
      }

      const rawValue = inputElement.value;
      const parsed = Number.parseFloat(rawValue.trim());
      const fallbackValue = latestValueRef.current;
      const nextValue = Number.isFinite(parsed)
        ? normalizeNumericValue(parsed, min, max)
        : normalizeNumericValue(fallbackValue, min, max);

      latestOnChangeRef.current(nextValue);
      latestOnInputValueChangeRef.current(formatNumericValue(nextValue));
      inputElement.blur();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [max, min]);

  const adjustValue = (direction: 1 | -1) => {
    const nextValue = normalizeNumericValue(value + direction * NUMERIC_STEP, min, max);
    onChange(nextValue);
    onInputValueChange(formatNumericValue(nextValue));
  };

  useEffect(() => {
    const inputElement = inputRef.current;

    if (!inputElement) {
      return undefined;
    }

    const handleWheel = (event: WheelEvent) => {
      if (document.activeElement !== inputElement) {
        return;
      }

      event.preventDefault();
      adjustValue(event.deltaY < 0 ? 1 : -1);
    };

    inputElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => inputElement.removeEventListener('wheel', handleWheel);
  }, [adjustValue]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      commitInput(event.currentTarget.value);
      event.currentTarget.blur();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onInputValueChange(formatNumericValue(value));
      event.currentTarget.blur();
    }
  };

  return (
    <div className="flex items-center gap-[0.275rem] rounded-full border border-slate-200 bg-white px-2 py-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <button
        type="button"
        aria-label={scrubLabel}
        title={scrubLabel}
        className="flex size-7 cursor-ew-resize items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        onPointerDown={(event) => {
          event.preventDefault();
          scrubStateRef.current = {
            startClientX: event.clientX,
            startValue: value,
          };
        }}
      >
        {icon}
      </button>

      <Input
        ref={inputRef}
        aria-label={label}
        inputMode="decimal"
        value={displayValue}
        size={3}
        style={{ width: `${Math.max(displayValue.length, 3)}ch` }}
        className="h-8 min-w-[3ch] shrink-0 border-0 bg-transparent !px-0 py-0 text-center text-sm font-medium tabular-nums text-slate-900 focus:ring-0"
        onChange={(event) => {
          const nextValue = event.target.value.replace(/[^\d.]/g, '');
          if (!nextValue.trim()) {
            onInputValueChange('');
            return;
          }

          onInputValueChange(nextValue);

          const parsed = Number.parseFloat(nextValue);
          if (Number.isFinite(parsed)) {
            onChange(normalizeNumericValue(parsed, min, max));
          }
        }}
        onFocus={() => {
          isFocusedRef.current = true;
          setIsFocused(true);
          inputRef.current?.select();
        }}
        onBlur={(event) => {
          isFocusedRef.current = false;
          setIsFocused(false);
          commitInput(event.currentTarget.value);
        }}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

export function LineStyleControls({
  style,
  onChange,
  showMarkers = true,
  showStrokeWidth = true,
  showDash = true,
}: {
  style: AnnotationStyle;
  onChange: (patch: Partial<AnnotationStyle>) => void;
  showMarkers?: boolean;
  showStrokeWidth?: boolean;
  showDash?: boolean;
}) {
  const { locale } = useLocale();
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [openMarkerMenu, setOpenMarkerMenu] = useState<MarkerMenuTarget>(null);
  const [markerMenuPointer, setMarkerMenuPointer] = useState<{ x: number; y: number } | null>(null);
  const [strokeWidthInput, setStrokeWidthInput] = useState(formatNumericValue(style.strokeWidth ?? 4));
  const [dashSizeInput, setDashSizeInput] = useState(formatNumericValue(style.lineDashSize ?? (style.lineDash === 'dashed' ? 6 : 0)));
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const stroke = style.stroke ?? '#0f172a';
  const strokeWidth = style.strokeWidth ?? 4;
  const dashSize = style.lineDashSize ?? (style.lineDash === 'dashed' ? 6 : 0);
  const startMarker = style.lineStartMarker ?? 'none';
  const endMarker = style.lineEndMarker ?? 'none';
  const normalizedStroke = useMemo(() => normalizeHexColor(stroke), [stroke]);
  const labels = useMemo(
    () =>
      locale === 'zh-CN'
        ? {
            width: '\u5bbd\u5ea6',
            widthScrub: '\u5de6\u53f3\u62d6\u52a8\u8c03\u6574\u7ebf\u5bbd',
            dash: '\u865a\u7ebf',
            dashScrub: '\u5de6\u53f3\u62d6\u52a8\u8c03\u6574\u865a\u7ebf\u7a0b\u5ea6',
            start: '\u8d77\u70b9',
            startMenu: '\u8bbe\u7f6e\u7ebf\u6bb5\u8d77\u70b9\u6837\u5f0f',
            end: '\u7ec8\u70b9',
            endMenu: '\u8bbe\u7f6e\u7ebf\u6bb5\u7ec8\u70b9\u6837\u5f0f',
            customColor: '\u81ea\u5b9a\u4e49\u7ebf\u6761\u989c\u8272',
            customColorHex: '\u81ea\u5b9a\u4e49\u7ebf\u6761\u989c\u8272\u5341\u516d\u8fdb\u5236\u503c',
            lineColor: (color: string) => `\u7ebf\u6761\u989c\u8272 ${color}`,
            markerOption: {
              none: '\u65e0',
              arrow: '\u7bad\u5934',
              bar: '\u7eb5\u6760',
              dot: '\u5706\u70b9',
            } satisfies Record<MarkerStyle, string>,
          }
        : {
            width: 'Width',
            widthScrub: 'Drag left or right to adjust line width',
            dash: 'Dash',
            dashScrub: 'Drag left or right to adjust dash pattern',
            start: 'Start',
            startMenu: 'Set line start style',
            end: 'End',
            endMenu: 'Set line end style',
            customColor: 'Custom line color',
            customColorHex: 'Custom line color hex value',
            lineColor: (color: string) => `Line color ${color}`,
            markerOption: {
              none: 'None',
              arrow: 'Arrow',
              bar: 'Bar',
              dot: 'Dot',
            } satisfies Record<MarkerStyle, string>,
          },
    [locale],
  );
  const createPressHandlers = (callback: () => void) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      callback();
    },
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) {
        callback();
      }
    },
  });

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

  const updateStrokeWidth = (nextValue: number) => {
    onChange({ strokeWidth: nextValue });
  };

  const updateDashSize = (nextValue: number) => {
    onChange({
      lineDashSize: nextValue,
      lineDash: nextValue > 0 ? 'dashed' : 'solid',
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="flex items-center gap-1 rounded-full bg-white px-2 py-1">
        {COLOR_OPTIONS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={labels.lineColor(color)}
            title={labels.lineColor(color)}
            className={cn(
              'flex size-7 items-center justify-center rounded-full border transition',
              stroke === color ? 'border-slate-900' : 'border-transparent hover:border-slate-300',
            )}
            {...createPressHandlers(() => onChange({ stroke: color }))}
          >
            <span className="size-4 rounded-full border border-black/5" style={{ backgroundColor: color }} />
          </button>
        ))}

        <div ref={colorPickerRef} className="relative">
          <button
            type="button"
            aria-label={labels.customColor}
            title={labels.customColor}
            className={cn(
              'flex size-7 items-center justify-center rounded-full border bg-white text-slate-600 transition',
              isColorPickerOpen ? 'border-slate-900' : 'border-slate-200 hover:border-slate-300',
            )}
            {...createPressHandlers(() => setIsColorPickerOpen((current) => !current))}
          >
            <Pipette className="size-4" />
          </button>

          {isColorPickerOpen ? (
            <div className="absolute right-0 top-full z-20 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <HexColorPicker color={normalizedStroke} onChange={(color) => onChange({ stroke: color })} />
              <div className="mt-3 flex items-center gap-2">
                <span
                  className="size-8 rounded-lg border border-slate-200"
                  style={{ backgroundColor: normalizedStroke }}
                  aria-hidden
                />
                <HexColorInput
                  aria-label={labels.customColorHex}
                  color={normalizedStroke}
                  prefixed
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                  onChange={(color) => onChange({ stroke: normalizeHexColor(color) })}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {showStrokeWidth ? (
        <NumericScrubInput
          label={labels.width}
          scrubLabel={labels.widthScrub}
          icon={<StrokeWidthIcon />}
          type="strokeWidth"
          value={strokeWidth}
          inputValue={strokeWidthInput}
          onInputValueChange={setStrokeWidthInput}
          onChange={updateStrokeWidth}
        />
      ) : null}

      {showDash ? (
        <NumericScrubInput
          label={labels.dash}
          scrubLabel={labels.dashScrub}
          icon={<DashPatternIcon />}
          type="lineDashSize"
          value={dashSize}
          inputValue={dashSizeInput}
          onInputValueChange={setDashSizeInput}
          onChange={updateDashSize}
        />
      ) : null}

      {showMarkers ? (
        <>
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1">
            <span className="text-xs font-medium text-slate-500" title={labels.startMenu}>{labels.start}</span>
            <MarkerDropdown
              direction="start"
              menuLabel={labels.startMenu}
              value={startMarker}
              isOpen={openMarkerMenu === 'start'}
              pointerPosition={openMarkerMenu === 'start' ? markerMenuPointer : null}
              optionLabel={(value) => labels.markerOption[value]}
              onOpenChange={(open) => {
                setOpenMarkerMenu(open ? 'start' : null);
                setMarkerMenuPointer(null);
              }}
              onPointerPositionChange={setMarkerMenuPointer}
              onChange={(nextValue) => onChange({ lineStartMarker: nextValue })}
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1">
            <span className="text-xs font-medium text-slate-500" title={labels.endMenu}>{labels.end}</span>
            <MarkerDropdown
              direction="end"
              menuLabel={labels.endMenu}
              value={endMarker}
              isOpen={openMarkerMenu === 'end'}
              pointerPosition={openMarkerMenu === 'end' ? markerMenuPointer : null}
              optionLabel={(value) => labels.markerOption[value]}
              onOpenChange={(open) => {
                setOpenMarkerMenu(open ? 'end' : null);
                setMarkerMenuPointer(null);
              }}
              onPointerPositionChange={setMarkerMenuPointer}
              onChange={(nextValue) => onChange({ lineEndMarker: nextValue })}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
