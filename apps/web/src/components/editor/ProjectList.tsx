import {
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { ProjectSummary } from '@/lib/persistence';
import { useLocale } from '@/lib/locale';

const formatProjectName = (
  project: ProjectSummary,
  fallbackName: string,
) => project.name.trim() || fallbackName;

const getProjectScreenshotCount = (project: ProjectSummary) =>
  project.screenshotCount ?? (project.hasAsset ? 1 : 0);

type FanItem =
  | {
      type: 'image';
      imageDataUrl: string;
      draftId: string | null;
    }
  | {
      type: 'summary';
      hiddenCount: number;
    };

const getProjectPreviewImages = (project: ProjectSummary) =>
  project.previewImageDataUrls?.length
    ? project.previewImageDataUrls
    : project.coverImageDataUrl
      ? [project.coverImageDataUrl]
      : [];

const getProjectPreviewDraftIds = (project: ProjectSummary) =>
  project.previewDraftIds?.length
    ? project.previewDraftIds
    : project.latestDraftId
      ? [project.latestDraftId]
      : [];

const getDisplayItems = (project: ProjectSummary): FanItem[] => {
  const screenshotCount = getProjectScreenshotCount(project);
  const previewLimit = screenshotCount <= 4 ? 4 : 3;
  const previewImages = getProjectPreviewImages(project).slice(0, previewLimit);
  const previewDraftIds = getProjectPreviewDraftIds(project);
  const hiddenCount = Math.max(0, screenshotCount - previewImages.length);
  const items: FanItem[] = previewImages.map((imageDataUrl, index) => ({
    type: 'image',
    imageDataUrl,
    draftId: previewDraftIds[index] ?? null,
  }));

  if (hiddenCount > 0) {
    items.push({
      type: 'summary',
      hiddenCount,
    });
  }

  return items;
};

const getFanItemStyle = ({
  index,
  activeIndex,
  visualIndex,
  total,
  isHovered,
  isFocus,
  isSelected,
  isSummary,
}: {
  index: number;
  activeIndex: number;
  visualIndex: number;
  total: number;
  isHovered: boolean;
  isFocus: boolean;
  isSelected: boolean;
  isSummary: boolean;
}): CSSProperties => {
  const midIndex = (total - 1) / 2;
  const visualOffset = index - midIndex;
  const collapsedOffset = index - activeIndex;
  const distance = Math.abs(index - visualIndex);
  const x = isHovered ? visualOffset * 68 : collapsedOffset * 4;
  const y = isHovered ? (isFocus ? -14 : 0) : collapsedOffset * 4;
  const rotate = isHovered ? visualOffset * 6 : collapsedOffset * 2;
  const scale = isFocus
    ? 1.06
    : isHovered
      ? Math.max(0.9, 0.98 - distance * 0.04)
      : 1 - Math.abs(collapsedOffset) * 0.026;
  const zIndex = isHovered ? (isFocus ? 50 : 20 - distance) : isSelected ? 50 : 12 + (total - index);
  const opacity = isHovered ? 1 : isSummary ? 0.78 : index === activeIndex ? 1 : 0.5;
  const blur = isHovered && distance > 2 ? 0.6 : 0;

  return {
    transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`,
    transformOrigin: '50% 92%',
    backfaceVisibility: 'hidden',
    willChange: 'transform, opacity',
    zIndex,
    opacity,
    filter: blur > 0 ? `blur(${blur}px)` : undefined,
  };
};

function CreateProjectCard({
  onCreateProject,
}: {
  onCreateProject?: () => void;
}) {
  const { messages } = useLocale();

  return (
    <article
      data-testid="project-empty-create-card-shell"
      className="relative isolate z-[1] w-[303px] overflow-visible pt-[46px]"
    >
      <button
        type="button"
        data-testid="project-empty-create-card"
        className="group grid w-[303px] min-h-[356px] place-items-center rounded-[34px] border-2 border-dashed border-slate-300/80 bg-white/22 p-8 text-center shadow-[0_28px_80px_rgba(52,139,255,0.06)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-[#bfdbfe] hover:bg-white/34 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#348bff]/70"
        onClick={onCreateProject}
      >
        <span className="grid justify-items-center gap-6">
          <span className="grid size-[98px] place-items-center rounded-[28px] bg-white/88 text-slate-400 shadow-[0_22px_64px_rgba(52,139,255,0.10)] transition duration-300 group-hover:text-[#348bff] group-hover:shadow-[0_26px_72px_rgba(52,139,255,0.18)]">
            <Plus className="size-10 stroke-[2.1]" />
          </span>
          <span className="text-[15px] font-black tracking-[0.06em] text-slate-500">
            {messages.editor.projectListCreateProject}
          </span>
        </span>
      </button>
    </article>
  );
}

function ProjectStatChip({
  text,
}: {
  text: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center justify-center rounded-full border border-slate-200/80 bg-white/66 px-2.5 py-2 text-[11px] font-black text-slate-600">
      <span className="min-w-0 truncate">{text}</span>
    </span>
  );
}

function ProjectFanStage({
  project,
  projectName,
  isHovered,
  activeIndex,
  hoverIndex,
  onActiveIndexChange,
  onHoverIndexChange,
  onStageHoverChange,
  onOpenProject,
  onOpenDraft,
}: {
  project: ProjectSummary;
  projectName: string;
  isHovered: boolean;
  activeIndex: number;
  hoverIndex: number | null;
  onActiveIndexChange: (index: number) => void;
  onHoverIndexChange: (index: number | null) => void;
  onStageHoverChange: (isHovered: boolean) => void;
  onOpenProject: (projectId: string) => void;
  onOpenDraft?: (draftId: string) => void;
}) {
  const { messages } = useLocale();
  const displayItems = getDisplayItems(project);
  const visualIndex = hoverIndex ?? activeIndex;

  if (!displayItems.length) {
    return (
      <div
        data-testid="project-fan-stage"
        className="relative mb-7 flex h-[168px] items-center justify-center overflow-visible [perspective:900px]"
      >
        <div className="absolute h-[150px] w-[94%] overflow-hidden rounded-[20px] border-2 border-white/95 bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%),linear-gradient(-45deg,#f8fafc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f8fafc_75%),linear-gradient(-45deg,transparent_75%,#f8fafc_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] shadow-[0_18px_38px_rgba(15,23,42,0.14)]" />
      </div>
    );
  }

  return (
    <div
      data-testid="project-fan-stage"
      className="relative mb-7 flex h-[168px] items-center justify-center overflow-visible [perspective:900px]"
      onMouseEnter={() => onStageHoverChange(true)}
      onMouseLeave={() => {
        onStageHoverChange(false);
        onHoverIndexChange(null);
      }}
    >
      {displayItems.map((item, index) => {
        const isFocus = index === visualIndex;
        const isSelected = index === activeIndex && item.type === 'image';
        const isSummary = item.type === 'summary';

        return (
          <button
            key={item.type === 'image' ? `${item.imageDataUrl}-${index}` : `summary-${item.hiddenCount}`}
            type="button"
            data-testid="project-fan-item"
            data-type={item.type}
            aria-label={
              item.type === 'summary'
                ? messages.editor.openProject(projectName)
                : messages.editor.projectDetailScreenshotFallback(index)
            }
            className={`project-fan-item absolute h-[150px] w-[94%] overflow-hidden rounded-[20px] text-left focus:outline-none ${
              isSummary
                ? 'project-fan-item-summary is-summary grid place-items-center p-3 text-center'
                : 'project-fan-item-image'
            } ${isFocus ? 'is-focus' : ''} ${isSelected ? 'is-selected' : ''}`}
            style={getFanItemStyle({
              index,
              activeIndex,
              visualIndex,
              total: displayItems.length,
              isHovered,
              isFocus,
              isSelected,
              isSummary,
            })}
            onMouseEnter={() => onHoverIndexChange(index)}
            onMouseLeave={() => onHoverIndexChange(null)}
            onClick={(event) => {
              event.stopPropagation();

              if (item.type === 'summary') {
                onOpenProject(project.id);
                return;
              }

              onActiveIndexChange(index);

              if (item.draftId && onOpenDraft) {
                onOpenDraft(item.draftId);
              }
            }}
          >
            {item.type === 'summary' ? (
              <>
                <span aria-hidden="true" className="project-fan-summary-aurora" data-testid="project-summary-aurora" />
                <span aria-hidden="true" className="project-fan-summary-sheen" data-testid="project-summary-sheen" />
                <div
                  className="project-fan-summary-content pointer-events-none grid gap-2"
                  data-testid={`project-summary-trigger-${project.id}`}
                >
                <div className="text-[28px] font-black leading-none tracking-[-0.04em]">+{item.hiddenCount}</div>
                <div className="text-[11px] font-black uppercase leading-normal tracking-[0.12em]">
                  {messages.editor.projectListMoreScreenshots}
                </div>
                </div>
              </>
            ) : (
              <img
                src={item.imageDataUrl}
                alt=""
                className="project-fan-image pointer-events-none h-full w-full select-none object-cover"
                style={{
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden',
                  willChange: 'transform',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function ProjectCard({
  project,
  onOpenProject,
  onOpenDraft,
  onAddScreenshot,
  onRenameProject,
}: {
  project: ProjectSummary;
  onOpenProject: (projectId: string) => void;
  onOpenDraft?: (draftId: string) => void;
  onAddScreenshot?: (projectId: string, file: File) => void | Promise<void>;
  onRenameProject?: (projectId: string, name: string) => void | Promise<void>;
}) {
  const { locale, messages } = useLocale();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftProjectName, setDraftProjectName] = useState('');
  const projectName = formatProjectName(project, messages.editor.projectUntitledFallback);
  const screenshotCount = getProjectScreenshotCount(project);
  const previewImages = getProjectPreviewImages(project).slice(0, screenshotCount <= 4 ? 4 : 3);
  const previewDraftIds = getProjectPreviewDraftIds(project);
  const visualIndex = hoverIndex ?? activeIndex;
  const activeDotIndex = previewImages.length ? Math.min(visualIndex, previewImages.length - 1) : 0;
  const renameProjectLabel = locale === 'zh-CN' ? '重命名项目' : 'Rename project';
  const formattedDate = (() => {
    const date = new Date(project.updatedAt);

    if (Number.isNaN(date.getTime())) {
      return project.updatedAt;
    }

    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
  })();

  const handleAddScreenshotClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleAddScreenshotChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !onAddScreenshot) {
      return;
    }

    await onAddScreenshot(project.id, file);
  };

  const startTitleEditing = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setDraftProjectName(projectName);
    setIsEditingTitle(true);
  };

  const cancelTitleEditing = () => {
    setDraftProjectName(projectName);
    setIsEditingTitle(false);
  };

  const saveTitleEditing = async () => {
    const nextName = draftProjectName.trim();
    setIsEditingTitle(false);

    if (!nextName || nextName === projectName || !onRenameProject) {
      setDraftProjectName(projectName);
      return;
    }

    await onRenameProject(project.id, nextName);
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveTitleEditing();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelTitleEditing();
    }
  };

  return (
    <article className="relative isolate z-[1] w-[303px] overflow-visible pt-[46px] hover:z-20">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        data-testid="project-add-screenshot-input"
        onChange={(event) => void handleAddScreenshotChange(event)}
      />

      <div
        data-testid="project-fan-card"
        className="w-[303px] min-h-[356px] rounded-[34px] border border-white/80 bg-white/72 p-5 text-left text-slate-900 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-2xl"
      >
        <ProjectFanStage
          project={project}
          projectName={projectName}
          isHovered={isHovered}
          activeIndex={activeIndex}
          hoverIndex={hoverIndex}
          onActiveIndexChange={setActiveIndex}
          onHoverIndexChange={setHoverIndex}
          onStageHoverChange={setIsHovered}
          onOpenProject={onOpenProject}
          onOpenDraft={onOpenDraft}
        />

        <div className="grid gap-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 max-w-[222px] space-y-2">
              <div className="group/title grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                {isEditingTitle ? (
                  <>
                    <input
                      value={draftProjectName}
                      autoFocus
                      aria-label={messages.editor.projectNameLabel}
                      className="h-10 min-w-0 w-full rounded-xl border border-[#bfdbfe] bg-white/88 px-3 text-[15px] font-black leading-tight tracking-[-0.02em] text-slate-900 outline-none shadow-[0_10px_24px_rgba(52,139,255,0.10)] focus:border-[#348bff] focus:ring-2 focus:ring-[#348bff]/18"
                      onChange={(event) => setDraftProjectName(event.target.value)}
                      onKeyDown={handleTitleKeyDown}
                      onBlur={() => void saveTitleEditing()}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <span aria-hidden="true" className="size-6 shrink-0" />
                  </>
                ) : (
                  <>
                    <h3 className="min-w-0 truncate text-base font-black leading-tight tracking-[-0.035em]">
                      {projectName}
                    </h3>
                    <button
                      type="button"
                      data-testid="project-rename-button"
                      aria-label={renameProjectLabel}
                      title={renameProjectLabel}
                      className="grid size-6 shrink-0 place-items-center rounded-full text-slate-400 opacity-0 transition duration-200 hover:bg-[#348bff]/10 hover:text-[#1f6ee8] focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#348bff]/45 group-hover/title:opacity-100"
                      onClick={startTitleEditing}
                    >
                      <Pencil className="size-3.5 stroke-[2.3]" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  data-testid="project-add-screenshot-button"
                  aria-label={messages.editor.projectDetailAddScreenshot}
                  className="group ml-2 grid size-7 shrink-0 place-items-center rounded-full bg-[#348bff]/10 text-[#1f6ee8] transition-colors duration-300 hover:bg-[#348bff]/16 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#348bff]/55"
                  onClick={handleAddScreenshotClick}
                >
                  <Plus className="size-4 origin-center stroke-[2.4] transition-transform duration-300 ease-out group-hover:rotate-90" />
                </button>
              </div>
              <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                <span aria-hidden="true" className="text-[15px] leading-none">
                  📅
                </span>
                <span>{formattedDate}</span>
              </p>
            </div>

            <div className="flex gap-1 pt-2" aria-hidden="true">
              {previewImages.slice(0, Math.min(screenshotCount, 3)).map((imageDataUrl, index) => (
                <span
                  key={`${imageDataUrl}-${index}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === activeDotIndex ? 'w-5 bg-[#348bff]' : 'w-1.5 bg-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>

          <div data-testid="project-card-meta-row" className="grid grid-cols-3 gap-2">
            <ProjectStatChip
              text={messages.editor.projectDetailScreenshotCount(screenshotCount)}
            />
            <ProjectStatChip
              text={messages.topBar.annotations(project.annotationCount)}
            />
            <ProjectStatChip
              text={messages.topBar.threads(project.threadCount ?? 0)}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProjectList(props: {
  projects: ProjectSummary[];
  onOpenProject: (projectId: string) => void;
  onOpenDraft?: (draftId: string) => void;
  onCreateProject?: () => void;
  onAddScreenshot?: (projectId: string, file: File) => void | Promise<void>;
  onRenameProject?: (projectId: string, name: string) => void | Promise<void>;
  className?: string;
}) {
  return (
    <div className={props.className}>
      <div className="grid grid-cols-1 gap-x-[52px] gap-y-16 overflow-visible sm:grid-cols-2 xl:grid-cols-4">
        {props.projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onOpenProject={props.onOpenProject}
            onOpenDraft={props.onOpenDraft}
            onAddScreenshot={props.onAddScreenshot}
            onRenameProject={props.onRenameProject}
          />
        ))}

        <CreateProjectCard onCreateProject={props.onCreateProject} />
      </div>
    </div>
  );
}
