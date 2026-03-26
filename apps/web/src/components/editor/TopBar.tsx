import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { localePreferences, useLocale, type LocalePreference } from '@/lib/locale';
import { Download, MessageSquareMore, RotateCcw, Save, Share2 } from 'lucide-react';
import { ToolPalette } from '@/components/editor/ToolPalette';

export function TopBar(props: {
  annotationCount: number;
  threadCount: number;
  zoom: number;
  activeTool?: Parameters<typeof ToolPalette>[0]['activeTool'];
  onToolChange?: Parameters<typeof ToolPalette>[0]['onToolChange'];
  textStyleControls?: ReactNode;
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
  const { messages, preference, setPreference } = useLocale();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{messages.topBar.annotations(props.annotationCount)}</Badge>
        <Badge>{messages.topBar.threads(props.threadCount)}</Badge>
        <Badge>{messages.topBar.zoom(Math.round(props.zoom * 100))}</Badge>

        <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
          <span>{messages.language.label}</span>
          <select
            aria-label={messages.language.selectAriaLabel}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400"
            value={preference}
            onChange={(event) => setPreference(event.target.value as LocalePreference)}
          >
            {localePreferences.map((option) => (
              <option key={option} value={option}>
                {messages.language.options[option]}
              </option>
            ))}
          </select>
        </label>

        {props.discussionPanel ? (
          <details className="group relative">
            <summary className="flex list-none items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white [&::-webkit-details-marker]:hidden">
              <MessageSquareMore className="size-4 text-slate-500" />
              <span>{messages.comments.title}</span>
              <Badge className="border-slate-200 bg-white text-slate-600">{props.threadCount}</Badge>
            </summary>

            <div className="absolute left-0 top-full z-20 mt-2 w-[min(30rem,calc(100vw-3rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <div className="h-[min(70dvh,42rem)] min-h-[28rem]">
                {props.discussionPanel}
              </div>
            </div>
          </details>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {props.secondaryActions}

        {props.activeTool && props.onToolChange ? (
          <ToolPalette activeTool={props.activeTool} onToolChange={props.onToolChange} />
        ) : null}

        {props.textStyleControls}

        <Button
          type="button"
          aria-label={messages.topBar.zoomOutAriaLabel}
          className="bg-slate-100 text-slate-700 hover:bg-slate-200"
          onClick={props.onZoomOut}
        >
          -
        </Button>
        <Button
          type="button"
          aria-label={messages.topBar.zoomInAriaLabel}
          className="bg-slate-100 text-slate-700 hover:bg-slate-200"
          onClick={props.onZoomIn}
        >
          +
        </Button>
        <Button
          type="button"
          className="bg-slate-100 text-slate-700 hover:bg-slate-200"
          onClick={props.onReset}
        >
          <RotateCcw className="size-4" />
          {messages.topBar.reset}
        </Button>
        <Button type="button" className="bg-amber-500 hover:bg-amber-400" onClick={props.onExport}>
          <Download className="size-4" />
          {messages.topBar.exportPng}
        </Button>
        {props.showSaveDraft === false ? null : (
          <Button
            type="button"
            className="bg-slate-700 hover:bg-slate-600"
            onClick={props.onSaveDraft}
          >
            <Save className="size-4" />
            {messages.topBar.saveDraft}
          </Button>
        )}
        {props.showCreateShare === false ? null : (
          <Button type="button" onClick={props.onCreateShare}>
            <Share2 className="size-4" />
            {messages.topBar.createShareLink}
          </Button>
        )}
      </div>
    </div>
  );
}
