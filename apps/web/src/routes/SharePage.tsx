import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnnotationCanvas } from '@/components/editor/AnnotationCanvas';
import { CommentSidebar } from '@/components/editor/CommentSidebar';
import { routeSharedLayoutIds, routeSharedTransition } from '@/components/motion/routeTransition';
import { TopBar } from '@/components/editor/TopBar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { buildExportFileName, downloadDataUrl } from '@/lib/export';
import { useLocale } from '@/lib/locale';
import { getShare, syncShareDraft } from '@/lib/persistence';
import { useEditorStore } from '@/lib/useEditorStore';

export function SharePage() {
  const { messages } = useLocale();
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const exporterRef = useRef<(() => Promise<string | undefined>) | null>(null);
  const draft = useEditorStore((state) => state.draft);
  const setDraft = useEditorStore((state) => state.setDraft);
  const zoom = useEditorStore((state) => state.zoom);
  const zoomIn = useEditorStore((state) => state.zoomIn);
  const zoomOut = useEditorStore((state) => state.zoomOut);
  const resetDraft = useEditorStore((state) => state.resetDraft);

  const handleExportReady = useCallback((nextExporter: () => Promise<string | undefined>) => {
    exporterRef.current = nextExporter;
  }, []);
  const handleGoHome = useCallback(() => {
    resetDraft();
    navigate('/editor', { replace: true });
  }, [navigate, resetDraft]);

  useEffect(() => {
    const load = async () => {
      const share = await getShare(token);

      if (!share) {
        setMissing(true);
        setLoading(false);
        return;
      }

      setDraft(share.draft);
      setLoading(false);
    };

    load();
  }, [setDraft, token]);

  useEffect(() => {
    if (!loading && !missing && draft.asset) {
      syncShareDraft(token, draft);
    }
  }, [draft, loading, missing, token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        {messages.share.loading}
      </div>
    );
  }

  if (missing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-lg space-y-4 p-8 text-center">
          <h1 className="text-balance text-2xl font-semibold text-slate-900">
            {messages.share.missingTitle}
          </h1>
          <p className="text-pretty text-slate-600">{messages.share.missingDescription}</p>
          <Button type="button" onClick={() => navigate('/editor')}>
            <ArrowLeft className="size-4" />
            {messages.share.openEditor}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-slate-50 px-6 py-6 text-slate-900">
      <div className="mx-auto flex h-full max-w-[1600px] min-h-0 flex-col gap-6">
        <TopBar
          annotationCount={draft.annotations.length}
          threadCount={draft.threads.length}
          zoom={zoom}
          discussionPanel={<CommentSidebar />}
          secondaryActions={
            <Button
              type="button"
              className="bg-slate-100 text-slate-700 hover:bg-slate-200"
              onClick={() => navigate('/editor')}
            >
              <ArrowLeft className="size-4" />
              {messages.share.backToEditor}
            </Button>
          }
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          showSaveDraft={false}
          showCreateShare={false}
          onSaveDraft={() => {}}
          onCreateShare={() => {}}
          onExport={async () => {
            const png = await exporterRef.current?.();

            if (png) {
              downloadDataUrl(png, buildExportFileName());
            }
          }}
          onHome={handleGoHome}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          <motion.div
            layoutId={routeSharedLayoutIds.primarySurface}
            transition={routeSharedTransition}
            className="flex min-h-0 flex-1 flex-col"
          >
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-blue-600">{messages.share.eyebrow}</p>
                <h1 className="mt-2 text-balance text-2xl font-semibold text-slate-900">
                  {messages.share.token(token)}
                </h1>
                <p className="mt-1 text-pretty text-sm text-slate-500">
                  {messages.share.description}
                </p>
              </div>
            </div>
          </Card>

          <motion.div
            layoutId={routeSharedLayoutIds.previewStage}
            transition={routeSharedTransition}
            className="mt-4 min-h-0 flex-1"
          >
            <AnnotationCanvas readOnly onExportReady={handleExportReady} />
          </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
