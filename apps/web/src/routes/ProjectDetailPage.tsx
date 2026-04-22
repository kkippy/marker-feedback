import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Image,
  Layers,
  Lock,
  MessageSquare,
} from 'lucide-react';
import { createId, type EditorDraft, type ImageAsset, type ProjectItem } from '@marker/shared';
import { useLocale } from '@/lib/locale';
import {
  listProjectDrafts,
  loadProject,
  saveProject,
  saveDraft,
  type ProjectDraftSummary,
} from '@/lib/persistence';
import { createEmptyDraft } from '@/lib/useEditorStore';

const SHARES_KEY = 'marker-feedback:shares';

const getProjectName = (project: ProjectItem | null, fallbackName: string) =>
  project?.name.trim() || fallbackName;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const measureImage = (imageDataUrl: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = reject;
    image.src = imageDataUrl;
  });

type LocalShareSummary = {
  shareToken: string;
  draftId: string;
};

const getLocalShareForDraft = (draftId: string | null): LocalShareSummary | null => {
  if (!draftId || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SHARES_KEY);
    if (!raw) {
      return null;
    }

    const shares = JSON.parse(raw) as Record<
      string,
      {
        shareToken?: string;
        draft?: { id?: string | null };
      }
    >;

    const matched = Object.values(shares).find((share) => share?.draft?.id === draftId);

    if (!matched?.shareToken) {
      return null;
    }

    return {
      shareToken: matched.shareToken,
      draftId,
    };
  } catch {
    return null;
  }
};

const buildShareUrl = (shareToken: string) => {
  if (typeof window === 'undefined') {
    return `/share/${shareToken}`;
  }

  return new URL(`/share/${shareToken}`, window.location.origin).toString();
};

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { locale, messages, formatDateTime } = useLocale();
  const requestRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [drafts, setDrafts] = useState<ProjectDraftSummary[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftProjectName, setDraftProjectName] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    requestRef.current += 1;
    const requestId = requestRef.current;

    const loadProjectDetail = async () => {
      if (!projectId) {
        setIsLoaded(true);
        return;
      }

      const [nextProject, nextDrafts] = await Promise.all([
        loadProject(projectId),
        listProjectDrafts(projectId),
      ]);

      if (requestId !== requestRef.current) {
        return;
      }

      setProject(nextProject);
      setDrafts(nextDrafts);
      setActiveDraftId(
        nextProject?.latestDraftId && nextDrafts.some((draft) => draft.id === nextProject.latestDraftId)
          ? nextProject.latestDraftId
          : nextDrafts[0]?.id ?? null,
      );
      setIsLoaded(true);
    };

    loadProjectDetail();

    return () => {
      if (requestRef.current === requestId) {
        requestRef.current += 1;
      }
    };
  }, [projectId]);

  const activeIndex = useMemo(() => {
    const index = drafts.findIndex((draft) => draft.id === activeDraftId);
    return index >= 0 ? index : 0;
  }, [activeDraftId, drafts]);

  const activeDraft = drafts[activeIndex] ?? null;
  const activeShare = useMemo(() => getLocalShareForDraft(activeDraft?.id ?? null), [activeDraft?.id]);
  const projectName = getProjectName(project, messages.editor.projectUntitledFallback);
  const totalThreads = drafts.reduce((total, draft) => total + draft.threadCount, 0);
  const annotatedDraftCount = drafts.filter((draft) => draft.annotationCount > 0).length;
  const progress = drafts.length ? Math.round((annotatedDraftCount / drafts.length) * 100) : 0;
  const detailDateLabel = useMemo(() => {
    if (!project?.updatedAt) {
      return '';
    }

    const date = new Date(project.updatedAt);

    if (Number.isNaN(date.getTime())) {
      return project.updatedAt;
    }

    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
    }).format(date);
  }, [locale, project?.updatedAt]);

  useEffect(() => {
    setDraftProjectName(project?.name ?? '');
    setIsEditingTitle(false);
  }, [project?.id, project?.name]);

  const openDraft = (draftId: string) => {
    navigate(`/editor?sourceType=draft&draftId=${draftId}`);
  };

  const handleBackToProjects = () => {
    navigate('/projects');
  };

  const handleAddScreenshotClick = () => {
    fileInputRef.current?.click();
  };

  const handleAddScreenshotChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !projectId) {
      return;
    }

    const imageDataUrl = await readFileAsDataUrl(file);
    const dimensions = await measureImage(imageDataUrl);
    const now = new Date().toISOString();
    const asset: ImageAsset = {
      id: createId('asset'),
      sourceType: 'upload',
      imageDataUrl,
      name: file.name,
      width: dimensions.width,
      height: dimensions.height,
      createdAt: now,
    };
    const nextDraft: EditorDraft = {
      ...createEmptyDraft(),
      projectId,
      asset,
      updatedAt: now,
    };

    await saveDraft(nextDraft);
    navigate(`/editor?sourceType=draft&draftId=${nextDraft.id}`);
  };

  const handleShareAction = async () => {
    if (!activeDraft) {
      return;
    }

    if (!activeShare) {
      openDraft(activeDraft.id);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }

    await navigator.clipboard.writeText(buildShareUrl(activeShare.shareToken));
  };

  const handleTitleEditStart = () => {
    setDraftProjectName(project?.name ?? projectName);
    setIsEditingTitle(true);
  };

  const handleTitleEditCancel = () => {
    setDraftProjectName(project?.name ?? '');
    setIsEditingTitle(false);
  };

  const handleTitleEditSubmit = async () => {
    if (!project) {
      setIsEditingTitle(false);
      return;
    }

    const nextName = draftProjectName.replace(/\s+/g, ' ').trim();
    const resolvedName = nextName || project.name;

    if (resolvedName === project.name) {
      setDraftProjectName(project.name);
      setIsEditingTitle(false);
      return;
    }

    const nextProject: ProjectItem = {
      ...project,
      name: resolvedName,
    };

    await saveProject(nextProject);
    setProject(nextProject);
    setDraftProjectName(nextProject.name);
    setIsEditingTitle(false);
  };

  if (isLoaded && !project) {
    return (
      <main className="detail-page">
        <div className="detail-empty-state">
          <button
            type="button"
            data-testid="project-detail-back"
            aria-label={messages.editor.projectDetailBackToProjects}
            className="detail-back"
            onClick={handleBackToProjects}
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="detail-empty-card">
            <p>{messages.editor.projectListEmpty}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="detail-page">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleAddScreenshotChange}
      />

      <div className="detail-route-surface">
        <header className="detail-topbar">
          <div className="detail-heading">
            <button
              type="button"
              data-testid="project-detail-back"
              aria-label={messages.editor.projectDetailBackToProjects}
              className="detail-back"
              onClick={handleBackToProjects}
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="detail-title">
              <div className="detail-title-row">
                {isEditingTitle ? (
                  <input
                    autoFocus
                    value={draftProjectName}
                    aria-label={messages.editor.projectNameLabel}
                    className="detail-title-input"
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => setDraftProjectName(event.target.value)}
                    onBlur={() => void handleTitleEditSubmit()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleTitleEditSubmit();
                      }

                      if (event.key === 'Escape') {
                        event.preventDefault();
                        handleTitleEditCancel();
                      }
                    }}
                  />
                ) : (
                  <strong onDoubleClick={handleTitleEditStart}>{projectName}</strong>
                )}
                <span
                  className="stat detail-title-count"
                  data-testid="project-detail-title-screenshot-count"
                >
                  <Image className="size-[14px]" />
                  <span>{messages.editor.projectDetailScreenshotCount(drafts.length)}</span>
                </span>
              </div>
              <span className="detail-title-date">{detailDateLabel}</span>
            </div>
          </div>

          <div className="detail-head-actions">
            <button type="button" className="btn primary" onClick={handleAddScreenshotClick}>
              {messages.editor.projectDetailAddScreenshot}
            </button>
            <button type="button" className="btn secondary" onClick={handleBackToProjects}>
              {messages.editor.projectDetailBackToProjects}
            </button>
          </div>
        </header>

        <div className="detail-layout">
          <section className="detail-main">
            <div className="detail-preview-card">
              <div className="detail-main-inner">
                <div className="detail-hero">
                  {activeDraft?.imageDataUrl ? (
                    <img
                      data-testid="project-detail-preview-image"
                      src={activeDraft.imageDataUrl}
                      alt=""
                    />
                  ) : (
                    <div
                      data-testid="project-detail-preview-image"
                      className="detail-hero-placeholder"
                    />
                  )}
                </div>

                <div className="detail-chips">
                  <div className="detail-chip-group">
                    <span className="stat detail-meta-chip">
                      <Layers className="size-[14px] text-orange-500" />
                      <span>{messages.topBar.annotations(activeDraft?.annotationCount ?? 0)}</span>
                    </span>
                  </div>

                  <span className="detail-discussion-chip">
                    <MessageSquare className="size-[14px]" />
                    <span>{messages.comments.title}</span>
                    <strong>{totalThreads}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="detail-share-card">
              <div className="detail-share-head">
                <div className="detail-share-label">
                  <Activity className="size-[14px] text-[#348bff]" />
                  <span>{messages.editor.projectDetailProgressLabel}</span>
                </div>
                <span className="detail-progress-value">{progress}%</span>
              </div>

              <div className="detail-progress-track">
                <div className="detail-progress-bar" style={{ width: `${progress}%` }} />
              </div>

              <div className="detail-share-row">
                <div className="detail-share-label">
                  <Lock className="size-[14px] text-slate-400" />
                  <span>{messages.editor.projectDetailShareLabel}</span>
                </div>
                <span className={`detail-share-state${activeShare ? ' is-public' : ''}`}>
                  {activeShare
                    ? messages.editor.projectDetailSharePublic
                    : messages.editor.projectDetailSharePrivate}
                </span>
              </div>

              <div className="detail-share-box" data-shared={String(Boolean(activeShare))}>
                <span className="detail-share-url">
                  {activeShare
                    ? buildShareUrl(activeShare.shareToken)
                    : messages.editor.projectDetailShareUnavailable}
                </span>
                <button type="button" className="detail-copy" onClick={handleShareAction}>
                  {activeShare
                    ? messages.editor.projectDetailShareCopy
                    : messages.editor.projectDetailShareEnable}
                </button>
              </div>
            </div>
          </section>

          <section className="detail-side">
            <div className="detail-list" role="list">
              {drafts.map((draft, index) => {
                const isActive = draft.id === activeDraft?.id;
                const draftName =
                  draft.name?.trim() || messages.editor.projectDetailScreenshotFallback(index);

                return (
                  <button
                    key={draft.id}
                    type="button"
                    data-testid="project-detail-row"
                    aria-label={draftName}
                    className={`detail-item${isActive ? ' active' : ''}`}
                    onMouseEnter={() => setActiveDraftId(draft.id)}
                    onFocus={() => setActiveDraftId(draft.id)}
                    onClick={() => openDraft(draft.id)}
                  >
                    <div className="detail-item-main">
                      <div className="detail-thumb">
                        {draft.imageDataUrl ? <img src={draft.imageDataUrl} alt="" /> : <div />}
                      </div>

                      <div className="detail-item-copy">
                        <strong>{draftName}</strong>
                        <span>
                          {messages.topBar.annotations(draft.annotationCount)} ·{' '}
                          {formatDateTime(draft.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="detail-tail">
                      <ChevronRight className="detail-chevron" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
