import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createId, type EditorDraft, type ImageAsset } from '@marker/shared';
import { FolderOpen, ImageUp, Redo2, Undo2 } from 'lucide-react';
import { AnnotationCanvas } from '@/components/editor/AnnotationCanvas';
import { CommentSidebar } from '@/components/editor/CommentSidebar';
import { TextStyleControls } from '@/components/editor/TextStyleControls';
import { TopBar } from '@/components/editor/TopBar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getBootstrapPayload } from '@/lib/bootstrap';
import { downloadDataUrl } from '@/lib/export';
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
  const { formatDateTime, messages } = useLocale();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draftPreviews, setDraftPreviews] = useState<
    { id: string; updatedAt: string; annotationCount: number; hasAsset: boolean }[]
  >([]);
  const [exporter, setExporter] = useState<(() => string | undefined) | null>(null);
  const draft = useEditorStore((state) => state.draft);
  const activeTool = useEditorStore((state) => state.activeTool);
  const selectedAnnotationId = useEditorStore((state) => state.selectedAnnotationId);
  const inlineTextEditor = useEditorStore((state) => state.inlineTextEditor);
  const textStylePreset = useEditorStore((state) => state.textStylePreset);
  const zoom = useEditorStore((state) => state.zoom);
  const setDraft = useEditorStore((state) => state.setDraft);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const updateTextStylePreset = useEditorStore((state) => state.updateTextStylePreset);
  const updateSelectedTextStyle = useEditorStore((state) => state.updateSelectedTextStyle);
  const commitInlineTextEditor = useEditorStore((state) => state.commitInlineTextEditor);
  const zoomIn = useEditorStore((state) => state.zoomIn);
  const zoomOut = useEditorStore((state) => state.zoomOut);
  const resetDraft = useEditorStore((state) => state.resetDraft);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const selectedTextAnnotation = selectedAnnotationId
    ? draft.annotations.find((item) => item.id === selectedAnnotationId && item.tool === 'text')
    : null;
  const activeTextStyle =
    inlineTextEditor?.style ??
    selectedTextAnnotation?.style ??
    (activeTool === 'text' ? textStylePreset : null);
  const handleTextStyleChange = (patch: Parameters<typeof updateSelectedTextStyle>[0]) => {
    if (inlineTextEditor || selectedTextAnnotation) {
      updateSelectedTextStyle(patch);
      return;
    }

    updateTextStylePreset(patch);
  };

  useEffect(() => {
    listDraftPreviews().then(setDraftPreviews);
  }, [draft.updatedAt]);

  useEffect(() => {
    const bootstrap = async () => {
      const payload = getBootstrapPayload();

      if (payload.draftId) {
        const existingDraft = await loadDraft(payload.draftId === 'latest' ? 'latest' : payload.draftId);

        if (existingDraft) {
          setDraft(existingDraft);
          return;
        }
      }

      if (payload.imageDataUrl) {
        const dimensions = await measureImage(payload.imageDataUrl);
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
  }, [setDraft]);

  const openFilePicker = () => fileRef.current?.click();

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const imageDataUrl = reader.result as string;
      const dimensions = await measureImage(imageDataUrl);
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
        <TopBar
          annotationCount={draft.annotations.length}
          threadCount={draft.threads.length}
          zoom={zoom}
          activeTool={draft.asset ? activeTool : undefined}
          onToolChange={draft.asset ? setActiveTool : undefined}
          textStyleControls={
            draft.asset && activeTextStyle ? (
              <TextStyleControls
                style={activeTextStyle}
                onChange={handleTextStyleChange}
                onCommit={inlineTextEditor ? commitInlineTextEditor : undefined}
              />
            ) : undefined
          }
          discussionPanel={draft.asset ? <CommentSidebar /> : undefined}
          secondaryActions={
            draft.asset ? (
              <>
                <Button
                  type="button"
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                  onClick={undo}
                >
                  <Undo2 className="size-4" />
                  {messages.editor.undo}
                </Button>
                <Button
                  type="button"
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                  onClick={redo}
                >
                  <Redo2 className="size-4" />
                  {messages.editor.redo}
                </Button>
                <Button
                  type="button"
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                  onClick={openFilePicker}
                >
                  <ImageUp className="size-4" />
                  {messages.editor.replaceImage}
                </Button>
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
          onExport={() => {
            const png = exporter?.();

            if (png) {
              downloadDataUrl(png, 'annotated-feedback.png');
            }
          }}
          onReset={() => resetDraft()}
        />

        {!draft.asset ? (
          <div className="min-h-0 overflow-auto">
            <div className="grid gap-6 lg:grid-cols-[1.3fr,0.9fr]">
              <Card className="space-y-4 p-8">
                <div>
                  <p className="text-sm font-semibold text-blue-600">{messages.editor.intakeEyebrow}</p>
                  <h1 className="mt-2 text-balance text-3xl font-semibold text-slate-900">
                    {messages.editor.intakeTitle}
                  </h1>
                  <p className="mt-3 max-w-2xl text-pretty text-slate-600">
                    {messages.editor.intakeDescription}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={openFilePicker}>
                    <ImageUp className="size-4" />
                    {messages.editor.uploadImage}
                  </Button>
                  <Button
                    type="button"
                    className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                    onClick={() => navigate('/editor?sourceType=draft&draftId=latest')}
                  >
                    <FolderOpen className="size-4" />
                    {messages.editor.openLatestDraft}
                  </Button>
                </div>

                <input
                  ref={fileRef}
                  className="hidden"
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                />
              </Card>

              <Card className="space-y-4 p-6">
                <div>
                  <h2 className="text-balance text-lg font-semibold text-slate-900">
                    {messages.editor.recentDraftsTitle}
                  </h2>
                  <p className="mt-1 text-pretty text-sm text-slate-500">
                    {messages.editor.recentDraftsDescription}
                  </p>
                </div>

                <div className="space-y-3">
                  {draftPreviews.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                      {messages.editor.noDrafts}
                    </div>
                  ) : (
                    draftPreviews.map((preview) => (
                      <button
                        key={preview.id}
                        type="button"
                        onClick={() => navigate(`/editor?sourceType=draft&draftId=${preview.id}`)}
                        className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-900">{preview.id}</span>
                          <span className="text-xs text-slate-500">
                            {formatDateTime(preview.updatedAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {messages.editor.draftSummary(preview.annotationCount, preview.hasAsset)}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <AnnotationCanvas onExportReady={setExporter} />
            </div>
            <input
              ref={fileRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={onFileChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
