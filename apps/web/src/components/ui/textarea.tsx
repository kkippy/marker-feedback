import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={cn('min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-primary/20 focus:ring-4', className)} {...props} />; }
