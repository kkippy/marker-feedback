import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AnnotationTool } from '@marker/shared';
import { Badge } from '@/components/ui/badge';
import { ToolbarIconButton } from '@/components/ui/toolbar-icon-button';
import { localePreferences, useLocale, type LocalePreference } from '@/lib/locale';
import { Download, MessageSquareMore, RotateCcw, Save, Share2, ChevronDown } from 'lucide-react';

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

function LanguageMenu() {
  const { messages, preference, setPreference } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useDismissibleLayer<HTMLDivElement>(isOpen, () => setIsOpen(false));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={messages.language.selectAriaLabel}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
          isOpen
            ? 'border-slate-300 bg-white text-slate-700'
            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="text-slate-500">{messages.language.label}</span>
        <span className="text-slate-700">{messages.language.options[preference]}</span>
        <ChevronDown className={`size-4 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-20 mt-2 min-w-52 rounded-2xl border border-slate-200 bg-white/96 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.14)] backdrop-blur">
          <div className="flex flex-col gap-1">
            {localePreferences.map((option) => {
              return (
                <button
                  key={option}
                  type="button"
                  aria-label={messages.language.options[option]}
                  className={`relative flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors duration-150 ease-out ${
                    option === preference
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => {
                    setPreference(option);
                    setIsOpen(false);
                  }}
                >
                  <span className="relative z-10 text-xs">
                    {messages.language.options[option]}
                  </span>
                  {option === preference ? <span className="relative z-10 text-xs text-white/80">•</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
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

        <LanguageMenu />

        {props.discussionPanel ? (
          <DiscussionPanel title={messages.comments.title} count={props.threadCount}>
            {props.discussionPanel}
          </DiscussionPanel>
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
