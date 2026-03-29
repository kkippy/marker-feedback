import type { AnnotationTool } from '@marker/shared';
import {
  ArrowRight,
  ChevronDown,
  Hash,
  Highlighter,
  Image,
  MessageSquare,
  type LucideIcon,
  MousePointer2,
  ScanSearch,
  Square,
  Type,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/locale';

const tools: AnnotationTool[] = [
  'select',
  'rectangle',
  'arrow',
  'highlight',
  'text',
  'blur',
  'marker',
  'callout',
  'image-callout',
];

const toolIcons: Record<AnnotationTool, LucideIcon> = {
  select: MousePointer2,
  rectangle: Square,
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

  return (
    <details className="group relative">
      <summary className="flex list-none items-center gap-2 rounded-full border border-dashed border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <Badge className="border-slate-200 bg-slate-100 text-slate-500">{messages.tools.title}</Badge>
        <ActiveIcon className="size-4 text-slate-500" />
        <span>{messages.tools.labels[activeTool]}</span>
        <ChevronDown className="size-4 text-slate-400 transition group-open:rotate-180" />
      </summary>

      <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-soft">
        <div className="grid grid-cols-2 gap-2">
          {tools.map((tool) => {
            const Icon = toolIcons[tool];

            return (
              <Button
                key={tool}
                type="button"
                onClick={() => onToolChange(tool)}
                className={
                  tool === activeTool
                    ? 'justify-start bg-blue-600 hover:bg-blue-500'
                    : 'justify-start bg-slate-100 text-slate-700 hover:bg-slate-200'
                }
              >
                <Icon className="size-4" />
                {messages.tools.labels[tool]}
              </Button>
            );
          })}
        </div>
      </div>
    </details>
  );
}
