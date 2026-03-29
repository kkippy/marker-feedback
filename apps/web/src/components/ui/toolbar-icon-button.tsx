import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ToolbarIconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="group relative">
      <Button
        type="button"
        aria-label={label}
        className={cn('h-10 min-w-11 rounded-xl px-3', className)}
        {...props}
      >
        {children}
      </Button>

      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100">
        <div className="rounded-xl border border-slate-200/70 bg-white/96 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur whitespace-nowrap">
          {label}
        </div>
      </div>
    </div>
  );
}
