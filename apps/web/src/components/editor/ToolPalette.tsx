import { useEffect, useRef, useState } from 'react';
import type { AnnotationTool } from '@marker/shared';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Hash,
  Highlighter,
  Image,
  MessageSquare,
  Minus,
  type LucideIcon,
  MousePointer2,
  ScanSearch,
  Square,
  Type,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/locale';
import { cn } from '@/lib/utils';

const primaryTools: AnnotationTool[] = [
  'select',
  'rectangle',
  'line',
  'arrow',
  'highlight',
  'text',
  'blur',
  'marker',
];

const calloutTools: AnnotationTool[] = ['callout', 'image-callout'];

const toolIcons: Record<AnnotationTool, LucideIcon> = {
  select: MousePointer2,
  rectangle: Square,
  line: Minus,
  arrow: ArrowRight,
  highlight: Highlighter,
  text: Type,
  blur: ScanSearch,
  marker: Hash,
  callout: MessageSquare,
  'image-callout': Image,
};

export function ToolPalette({
  activeTool,
  onToolChange,
}: {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
}) {
  const { messages } = useLocale();
  const ActiveIcon = toolIcons[activeTool];
  const [isOpen, setIsOpen] = useState(false);
  const [isCalloutSubmenuOpen, setIsCalloutSubmenuOpen] = useState(false);
  const rootRef = useRef<HTMLDetailsElement>(null);
  const isCalloutToolActive = calloutTools.includes(activeTool);
  const calloutGroupLabel = messages.tools.calloutGroup ?? messages.tools.labels.callout;

  useEffect(() => {
    if (!isOpen) {
      setIsCalloutSubmenuOpen(false);
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  return (
    <details ref={rootRef} className="group relative" open={isOpen}>
      <summary
        className="flex list-none items-center gap-2 rounded-full border border-dashed border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
        onClick={(event) => {
          event.preventDefault();
          setIsOpen((current) => !current);
        }}
      >
        <Badge className="border-slate-200 bg-slate-100 text-slate-500">{messages.tools.title}</Badge>
        <ActiveIcon className="size-4 text-slate-500" />
        <span>{messages.tools.labels[activeTool]}</span>
        <ChevronDown className={cn('size-4 text-slate-400 transition', isOpen && 'rotate-180')} />
      </summary>

      <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-soft">
        <div className="flex flex-col gap-2">
          {primaryTools.map((tool) => {
            const Icon = toolIcons[tool];

            return (
              <Button
                key={tool}
                type="button"
                onClick={() => {
                  onToolChange(tool);
                  setIsOpen(false);
                }}
                className={
                  tool === activeTool
                    ? 'justify-start gap-3 bg-blue-600 hover:bg-blue-500'
                    : 'justify-start gap-3 bg-slate-100 text-slate-700 hover:bg-slate-200'
                }
              >
                <Icon className="size-4" />
                {messages.tools.labels[tool]}
              </Button>
            );
          })}

          <div
            className="relative"
            onMouseEnter={() => setIsCalloutSubmenuOpen(true)}
            onMouseLeave={() => setIsCalloutSubmenuOpen(false)}
            onFocusCapture={() => setIsCalloutSubmenuOpen(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsCalloutSubmenuOpen(false);
              }
            }}
          >
            <Button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isCalloutSubmenuOpen}
              className={
                isCalloutToolActive
                  ? 'w-full justify-start gap-3 bg-blue-600 hover:bg-blue-500'
                  : 'w-full justify-start gap-3 bg-slate-100 text-slate-700 hover:bg-slate-200'
              }
            >
              <MessageSquare className="size-4" />
              <span className="flex-1 text-left">{calloutGroupLabel}</span>
              <ChevronRight className="size-4" />
            </Button>

            <div
              className={cn(
                'absolute left-full top-0 z-30 pl-2',
                isCalloutSubmenuOpen ? 'pointer-events-auto' : 'pointer-events-none',
              )}
            >
              <div
                className={cn(
                  'w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-soft',
                  isCalloutSubmenuOpen ? 'block' : 'hidden',
                )}
              >
                <div className="flex flex-col gap-2">
                  {calloutTools.map((tool) => {
                    const Icon = toolIcons[tool];

                    return (
                      <Button
                        key={tool}
                        type="button"
                        onClick={() => {
                          onToolChange(tool);
                          setIsCalloutSubmenuOpen(false);
                          setIsOpen(false);
                        }}
                        className={
                          tool === activeTool
                            ? 'w-full justify-start gap-3 bg-blue-600 hover:bg-blue-500'
                            : 'w-full justify-start gap-3 bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }
                      >
                        <Icon className="size-4" />
                        {messages.tools.labels[tool]}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
