import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createId, type EditorDraft, type ImageAsset } from '@marker/shared';
import { ImageUp, Redo2, Undo2 } from 'lucide-react';
import { AnnotationCanvas } from '@/components/editor/AnnotationCanvas';
import { CommentSidebar } from '@/components/editor/CommentSidebar';
import { EditorHomepage } from '@/components/editor/EditorHomepage';
import { TopBar } from '@/components/editor/TopBar';
import { ToolbarIconButton } from '@/components/ui/toolbar-icon-button';
import { getBootstrapPayload } from '@/lib/bootstrap';
import { buildExportFileName, downloadDataUrl } from '@/lib/export';
import { useLocale } from '@/lib/locale';
import { createShare, listDraftPreviews, loadDraft, saveDraft } from '@/lib/persistence';
import { createEmptyDraft, useEditorStore } from '@/lib/useEditorStore';

const measureImage = (imageDataUrl: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = reject;
    image.src = imageDataUrl;
  });

export function EditorPage() {
  const { messages } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRequestRef = useRef(0);
  const draftPreviewRequestRef = useRef(0);
  const [draftPreviews, setDraftPreviews] = useState<
    { id: string; updatedAt: string; annotationCount: number; hasAsset: boolean }[]
  >([]);
  const exporterRef = useRef<(() => Promise<string | undefined>) | null>(null);
  const draft = useEditorStore((state) => state.draft);
  const activeTool = useEditorStore((state) => state.activeTool);
  const zoom = useEditorStore((state) => state.zoom);
  const setDraft = useEditorStore((state) => state.setDraft);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const zoomIn = useEditorStore((state) => state.zoomIn);
  const zoomOut = useEditorStore((state) => state.zoomOut);
  const resetDraft = useEditorStore((state) => state.resetDraft);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  useEffect(() => {
    return () => {
      draftRequestRef.current += 1;
      draftPreviewRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    draftPreviewRequestRef.current += 1;
    const requestId = draftPreviewRequestRef.current;

    listDraftPreviews().then((nextDraftPreviews) => {
      if (requestId === draftPreviewRequestRef.current) {
        setDraftPreviews(nextDraftPreviews);
      }
    });
  }, [draft.updatedAt]);

  useEffect(() => {
    draftRequestRef.current += 1;
    const requestId = draftRequestRef.current;

    const bootstrap = async () => {
      const payload = getBootstrapPayload();

      if (payload.draftId) {
        const existingDraft = await loadDraft(payload.draftId === 'latest' ? 'latest' : payload.draftId);

        if (requestId === draftRequestRef.current && existingDraft) {
          setDraft(existingDraft);
          return;
        }
      }

      if (payload.imageDataUrl) {
        const dimensions = await measureImage(payload.imageDataUrl);
        if (requestId !== draftRequestRef.current) {
          return;
        }
        const asset: ImageAsset = {
          id: createId('asset'),
          sourceType: payload.sourceType,
          imageDataUrl: payload.imageDataUrl,
          width: dimensions.width,
          height: dimensions.height,
          createdAt: new Date().toISOString(),
        };
        const nextDraft: EditorDraft = { ...createEmptyDraft(), asset };
        setDraft(nextDraft);
      }
    };

    bootstrap();

    return () => {
      if (draftRequestRef.current === requestId) {
        draftRequestRef.current += 1;
      }
    };
  }, [location.hash, location.search, setDraft]);

  const handleExportReady = useCallback((nextExporter: () => Promise<string | undefined>) => {
    exporterRef.current = nextExporter;
  }, []);

  const openFilePicker = () => fileRef.current?.click();

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    event.target.value = '';
    draftRequestRef.current += 1;
    const requestId = draftRequestRef.current;

    const reader = new FileReader();
    reader.onload = async () => {
      const imageDataUrl = reader.result as string;
      const dimensions = await measureImage(imageDataUrl);
      if (requestId !== draftRequestRef.current) {
        return;
      }
      const asset: ImageAsset = {
        id: createId('asset'),
        sourceType: 'upload',
        imageDataUrl,
        width: dimensions.width,
        height: dimensions.height,
        createdAt: new Date().toISOString(),
      };
      setDraft({ ...createEmptyDraft(), asset });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="h-dvh overflow-hidden bg-slate-50 px-6 py-6 text-slate-900">
      <div className="mx-auto flex h-full max-w-[1600px] min-h-0 flex-col gap-6">
        {!draft.asset ? (
          <div data-testid="editor-homepage-shell" className="flex min-h-0 flex-1 overflow-hidden">
            <EditorHomepage
              latestDraft={draftPreviews[0] ?? null}
              onUpload={openFilePicker}
              onOpenLatestDraft={() => navigate('/editor?sourceType=draft&draftId=latest')}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <TopBar
              annotationCount={draft.annotations.length}
              threadCount={draft.threads.length}
              zoom={zoom}
              activeTool={draft.asset ? activeTool : undefined}
              discussionPanel={draft.asset ? <CommentSidebar /> : undefined}
              secondaryActions={
                draft.asset ? (
                  <>
                    <ToolbarIconButton
                      label={messages.editor.undo}
                      className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                      onClick={undo}
                    >
                      <Undo2 className="size-4" />
                    </ToolbarIconButton>
                    <ToolbarIconButton
                      label={messages.editor.redo}
                      className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                      onClick={redo}
                    >
                      <Redo2 className="size-4" />
                    </ToolbarIconButton>
                    <ToolbarIconButton
                      label={messages.editor.replaceImage}
                      className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                      onClick={openFilePicker}
                    >
                      <ImageUp className="size-4" />
                    </ToolbarIconButton>
                  </>
                ) : undefined
              }
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onSaveDraft={async () => {
                await saveDraft(draft);
              }}
              onCreateShare={async () => {
                const share = await createShare(draft);
                navigate(`/share/${share.shareToken}`);
              }}
              onExport={async () => {
                const png = await exporterRef.current?.();

                if (png) {
                  downloadDataUrl(png, buildExportFileName());
                }
              }}
              onReset={() => resetDraft()}
            />
            <div className="min-h-0 flex-1">
              <AnnotationCanvas onExportReady={handleExportReady} />
            </div>
          </div>
        )}
        <input ref={fileRef} className="hidden" type="file" accept="image/*" onChange={onFileChange} />
      </div>
    </div>
  );
}
