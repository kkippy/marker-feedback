import type { CSSProperties } from 'react';
import { Textarea } from '@/components/ui/textarea';

export function InlineTextEditor({
  isOpen,
  value,
  style,
  onChange,
  onCommit,
  onCancel,
}: {
  isOpen: boolean;
  value: string;
  style: CSSProperties;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <Textarea
      autoFocus
      value={value}
      style={style}
      className="absolute z-40 min-h-0 resize-none rounded-xl border-blue-500 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-sm focus:ring-2"
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          onCommit();
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    />
  );
}
