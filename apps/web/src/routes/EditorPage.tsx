import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createId, type EditorDraft, type ImageAsset } from '@marker/shared';
import { ImageUp, Redo2, Undo2 } from 'lucide-react';
import { AnnotationCanvas } from '@/components/editor/AnnotationCanvas';
import { CommentSidebar } from '@/components/editor/CommentSidebar';
import { CreateProjectDialog } from '@/components/editor/CreateProjectDialog';
import { EditorHomepage } from '@/components/editor/EditorHomepage';
import { TopBar, topBarButtonStyles } from '@/components/editor/TopBar';
import { ToolbarIconButton } from '@/components/ui/toolbar-icon-button';
import { getBootstrapPayload } from '@/lib/bootstrap';
import { buildExportFileName, downloadDataUrl } from '@/lib/export';
import { useLocale } from '@/lib/locale';
import {
  createProject,
  createShare,
  listProjects,
  loadDraft,
  type ProjectSummary,
  saveDraft,
} from '@/lib/persistence';
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
  const projectRequestRef = useRef(0);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
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
      projectRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    projectRequestRef.current += 1;
    const requestId = projectRequestRef.current;

    listProjects().then((nextProjects) => {
      if (requestId === projectRequestRef.current) {
        setProjects(nextProjects);
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
  const handleGoHome = useCallback(() => {
    resetDraft();
    navigate('/editor', { replace: true });
  }, [navigate, resetDraft]);

  const openFilePicker = () => fileRef.current?.click();
  const latestProject = projects[0] ?? null;
  const currentProject = useMemo(
    () => (draft.projectId ? projects.find((project) => project.id === draft.projectId) ?? null : null),
    [draft.projectId, projects],
  );

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

  const handleCreateProject = async ({ name, file }: { name: string; file: File }) => {
    const reader = new FileReader();

    await new Promise<void>((resolve, reject) => {
      reader.onload = async () => {
        try {
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
          const created = await createProject({
            name,
            draft: {
              ...createEmptyDraft(),
              asset,
            },
          });

          setDraft(created.draft);
          setIsCreateProjectOpen(false);
          navigate(`/editor?sourceType=draft&draftId=${created.draft.id}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="h-dvh overflow-hidden bg-slate-50 text-slate-900">
      <div className="mx-auto flex h-full min-h-0 flex-col gap-6">
        {!draft.asset ? (
          <div data-testid="editor-homepage-shell" className="flex min-h-0 flex-1 overflow-hidden">
            <EditorHomepage
              latestProject={latestProject}
              recentProjects={projects}
              onCreateProject={() => setIsCreateProjectOpen(true)}
              onOpenLatestProject={() => {
                if (latestProject?.latestDraftId) {
                  navigate(`/editor?sourceType=draft&draftId=${latestProject.latestDraftId}`);
                }
              }}
              onOpenProjects={() => navigate('/projects')}
              onOpenProject={(projectId) => {
                const project = projects.find((item) => item.id === projectId);

                if (project?.latestDraftId) {
                  navigate(`/editor?sourceType=draft&draftId=${project.latestDraftId}`);
                }
              }}
            />
            <CreateProjectDialog
              open={isCreateProjectOpen}
              onClose={() => setIsCreateProjectOpen(false)}
              onCreate={handleCreateProject}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <TopBar
              annotationCount={draft.annotations.length}
              threadCount={draft.threads.length}
              zoom={zoom}
              activeTool={draft.asset ? activeTool : undefined}
              currentProjectName={currentProject?.name?.trim() || undefined}
              discussionPanel={draft.asset ? <CommentSidebar /> : undefined}
              secondaryActions={
                draft.asset ? (
                  <>
                    <ToolbarIconButton
                      label={messages.editor.undo}
                      className={topBarButtonStyles.share}
                      onClick={undo}
                    >
                      <Undo2 className="size-4" />
                    </ToolbarIconButton>
                    <ToolbarIconButton
                      label={messages.editor.redo}
                      className={topBarButtonStyles.share}
                      onClick={redo}
                    >
                      <Redo2 className="size-4" />
                    </ToolbarIconButton>
                    <ToolbarIconButton
                      label={messages.editor.replaceImage}
                      className={topBarButtonStyles.share}
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
              onHome={handleGoHome}
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
