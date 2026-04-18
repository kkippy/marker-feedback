import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AnnotationTool } from '@marker/shared';
import { Download, MessageSquareMore, RotateCcw, Save, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ToolbarIconButton } from '@/components/ui/toolbar-icon-button';
import { useLocale } from '@/lib/locale';
import { LocalePreferenceButton } from './LocalePreferenceButton';

function useDismissibleLayer<T extends HTMLElement>(isOpen: boolean, onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, onClose]);

  return ref;
}

function DiscussionPanel({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useDismissibleLayer<HTMLDivElement>(isOpen, () => setIsOpen(false));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={title}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
          isOpen
            ? 'border-slate-300 bg-white text-slate-700'
            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <MessageSquareMore className="size-4 text-slate-500" />
        <span>{title}</span>
        <Badge className="border-slate-200 bg-white text-slate-600">{count}</Badge>
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-[min(30rem,calc(100vw-3rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="h-[min(70dvh,42rem)] min-h-[28rem]">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

export function TopBar(props: {
  annotationCount: number;
  threadCount: number;
  zoom: number;
  activeTool?: AnnotationTool;
  currentProjectName?: string;
  discussionPanel?: ReactNode;
  secondaryActions?: ReactNode;
  showSaveDraft?: boolean;
  showCreateShare?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSaveDraft: () => void;
  onCreateShare: () => void;
  onExport: () => void;
  onReset: () => void;
}) {
  const { messages } = useLocale();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{messages.topBar.annotations(props.annotationCount)}</Badge>
        <Badge>{messages.topBar.threads(props.threadCount)}</Badge>
        <Badge>{messages.topBar.zoom(Math.round(props.zoom * 100))}</Badge>

        <LocalePreferenceButton />

        {props.discussionPanel ? (
          <DiscussionPanel title={messages.comments.title} count={props.threadCount}>
            {props.discussionPanel}
          </DiscussionPanel>
        ) : null}

        {props.currentProjectName ? (
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600">
            {messages.topBar.currentProject(props.currentProjectName)}
          </span>
        ) : null}

        {props.activeTool ? (
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600">
            {messages.topBar.currentMode(messages.tools.labels[props.activeTool])}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {props.secondaryActions}

        <ToolbarIconButton
          label={messages.topBar.zoomOutAriaLabel}
          className="bg-slate-100 text-slate-700 hover:bg-slate-200"
          onClick={props.onZoomOut}
        >
          -
        </ToolbarIconButton>
        <ToolbarIconButton
          label={messages.topBar.zoomInAriaLabel}
          className="bg-slate-100 text-slate-700 hover:bg-slate-200"
          onClick={props.onZoomIn}
        >
          +
        </ToolbarIconButton>
        <ToolbarIconButton
          label={messages.topBar.reset}
          className="bg-slate-100 text-slate-700 hover:bg-slate-200"
          onClick={props.onReset}
        >
          <RotateCcw className="size-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label={messages.topBar.exportPng}
          className="bg-amber-500 hover:bg-amber-400"
          onClick={props.onExport}
        >
          <Download className="size-4" />
        </ToolbarIconButton>
        {props.showSaveDraft === false ? null : (
          <ToolbarIconButton
            label={messages.topBar.saveDraft}
            className="bg-slate-700 hover:bg-slate-600"
            onClick={props.onSaveDraft}
          >
            <Save className="size-4" />
          </ToolbarIconButton>
        )}
        {props.showCreateShare === false ? null : (
          <ToolbarIconButton label={messages.topBar.createShareLink} onClick={props.onCreateShare}>
            <Share2 className="size-4" />
          </ToolbarIconButton>
        )}
      </div>
    </div>
  );
}
