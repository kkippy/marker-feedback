import { Copy, ImagePlus, Trash2 } from 'lucide-react';

export function FloatingImageCalloutToolbar({
  isOpen,
  style,
  replaceLabel,
  copyLabel,
  deleteLabel,
  onReplace,
  onCopy,
  onDelete,
}: {
  isOpen: boolean;
  style: { left: number; top: number };
  replaceLabel: string;
  copyLabel: string;
  deleteLabel: string;
  onReplace: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{
        left: style.left,
        top: style.top,
        transform: 'translateY(calc(-100% - 12px))',
      }}
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-[1.25rem] border border-slate-200 bg-white/96 p-1.5 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur">
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          onClick={onReplace}
        >
          <ImagePlus className="size-4" />
          {replaceLabel}
        </button>
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          aria-label={copyLabel}
          title={copyLabel}
          onClick={onCopy}
        >
          <Copy className="size-4" />
        </button>
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
          aria-label={deleteLabel}
          title={deleteLabel}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
