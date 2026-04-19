import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AnnotationTool } from '@marker/shared';
import { Download, House, MessageSquareMore, Save, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ToolbarIconButton } from '@/components/ui/toolbar-icon-button';
import { useLocale } from '@/lib/locale';
import { LocalePreferenceButton } from './LocalePreferenceButton';

export const topBarButtonStyles = {
  home:
    '!bg-[#348bff] !text-white shadow-[0_12px_26px_rgba(52,139,255,0.26)] hover:!bg-[#1f7af0]',
  neutral:
    '!bg-[#eaf3ff] !text-[#256fdc] border border-[#cfe3ff] hover:!bg-[#dbeafe] hover:!text-[#1d5fbe]',
  save:
    '!bg-[#256fdc] !text-white shadow-[0_12px_24px_rgba(37,111,220,0.2)] hover:!bg-[#1d5fbe]',
  share:
    '!bg-[#eaf3ff] !text-[#256fdc] border border-[#cfe3ff] hover:!bg-[#dbeafe] hover:!text-[#1d5fbe]',
};

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
        <ToolbarIconButton
          label={messages.topBar.home}
          className={topBarButtonStyles.home}
          onClick={props.onReset}
        >
          <House className="size-4" />
        </ToolbarIconButton>
        {props.secondaryActions}

        <ToolbarIconButton
          label={messages.topBar.zoomOutAriaLabel}
          className={topBarButtonStyles.neutral}
          onClick={props.onZoomOut}
        >
          -
        </ToolbarIconButton>
        <ToolbarIconButton
          label={messages.topBar.zoomInAriaLabel}
          className={topBarButtonStyles.neutral}
          onClick={props.onZoomIn}
        >
          +
        </ToolbarIconButton>
        {props.showSaveDraft === false ? null : (
          <ToolbarIconButton
            label={messages.topBar.saveDraft}
            className={topBarButtonStyles.save}
            onClick={props.onSaveDraft}
          >
            <Save className="size-4" />
          </ToolbarIconButton>
        )}
        {props.showCreateShare === false ? null : (
          <ToolbarIconButton
            label={messages.topBar.createShareLink}
            className={topBarButtonStyles.share}
            onClick={props.onCreateShare}
          >
            <Share2 className="size-4" />
          </ToolbarIconButton>
        )}
        <ToolbarIconButton
          label={messages.topBar.exportPng}
          className={topBarButtonStyles.share}
          onClick={props.onExport}
        >
          <Download className="size-4" />
        </ToolbarIconButton>
      </div>
    </div>
  );
}
