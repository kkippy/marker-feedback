import { LocalePreferenceButton } from '@/components/editor/LocalePreferenceButton';
import { useLocale } from '@/lib/locale';

export interface HomepageDraftPreview {
  id: string;
  updatedAt: string;
  annotationCount: number;
  hasAsset: boolean;
}

interface EditorHomepageProps {
  latestDraft: HomepageDraftPreview | null;
  onUpload: () => void;
  onOpenLatestDraft: () => void;
}

const homepageCopy = {
  en: {
    brandLine: 'Visual Communication',
    titleStart: 'Make screenshot communication',
    titleAccent: 'feel intuitive.',
    description:
      'Keep ideas on the image, let feedback be seen more naturally, and sync smoothly across devices.',
    latest: 'Latest',
    latestTitle: 'Homepage visual refinement',
    fallbackDate: '2026/04/16',
    continue: 'Continue this project',
    activeProjects: 'Recent active projects',
    newMessages: '2 New Messages',
    previewTag: 'Multi-project workbench',
    tileTitle: 'Component detail review',
    tileTime: '10:20 AM',
    newProject: '＋ New',
    socialProof: 'Join 10k+ creators',
  },
  'zh-CN': {
    brandLine: 'Visual Communication',
    titleStart: '让截图沟通，',
    titleAccent: '更具直觉。',
    description: '把想法留在画面上，让反馈更自然地被看见。支持多终端无缝同步。',
    latest: 'Latest',
    latestTitle: '首页视觉优化讨论',
    fallbackDate: '2026/04/16',
    continue: '继续这个项目',
    activeProjects: '最近活跃项目',
    newMessages: '2 New Messages',
    previewTag: '多项目工作台',
    tileTitle: '组件细节走查',
    tileTime: '10:20 AM',
    newProject: '＋ 新建',
    socialProof: 'Join 10k+ creators',
  },
} as const;

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        data-testid="homepage-folder-back"
        className="mf-homepage-folder-back"
        d="M4.5 8.1V6.9a2 2 0 0 1 2-2h4.2l1.8 2.35H18a2 2 0 0 1 2 2v1.2H5.1z"
      />
      <path
        data-testid="homepage-folder-front-closed"
        className="mf-homepage-folder-front-closed"
        d="M4 9.35h16v7.65a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
      />
      <path
        data-testid="homepage-folder-front-open"
        className="mf-homepage-folder-front-open"
        d="M5.1 11.15h15.3l-2.1 7.85H5.8a2 2 0 0 1-1.95-2.45z"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function MessagesIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-5 4v-4.5z" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m12 4 8 4-8 4-8-4z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </svg>
  );
}

function CursorIcon() {
  return (
    <svg className="mf-homepage-cursor" aria-hidden="true" viewBox="0 0 24 24">
      <path d="m5 3 13 9-6 1 1 6-2 1-3-7-3 1z" />
    </svg>
  );
}

function RulerMarks() {
  return (
    <>
      {Array.from({ length: 20 }, (_, index) => (
        <i key={index} />
      ))}
    </>
  );
}

export function EditorHomepage({ latestDraft, onUpload, onOpenLatestDraft }: EditorHomepageProps) {
  const { locale, messages, formatDateTime } = useLocale();
  const copy = homepageCopy[locale];
  const canOpenLatestDraft = Boolean(latestDraft?.hasAsset);
  const latestDate = latestDraft ? formatDateTime(latestDraft.updatedAt) : copy.fallbackDate;

  return (
    <main data-testid="editor-homepage-root" className="mf-homepage-root h-full min-h-full w-full">
      <div data-testid="homepage-main-grid" className="mf-homepage-layout">
        <section data-testid="homepage-hero-panel" className="mf-homepage-hero" aria-labelledby="homepage-title">
          <div className="mf-homepage-brand">
            <div className="mf-homepage-logo">M</div>
            <div>
              <h2>Marker Feedback</h2>
              <p>{copy.brandLine}</p>
            </div>
          </div>

          <div className="mf-homepage-intro">
            <div className="mf-homepage-badge">✦ 2026 Version</div>
            <h1 id="homepage-title" className="mf-homepage-title">
              {copy.titleStart}
              <br />
              <span>{copy.titleAccent}</span>
            </h1>
            <p className="mf-homepage-desc">{copy.description}</p>
          </div>

          <div className="mf-homepage-actions">
            <button type="button" className="mf-homepage-btn mf-homepage-btn-primary" onClick={onUpload}>
              {messages.editor.homepageUploadImage}
              <PlusIcon />
            </button>
            <button
              type="button"
              className="mf-homepage-btn mf-homepage-btn-secondary"
              disabled={!canOpenLatestDraft}
              onClick={onOpenLatestDraft}
            >
              {locale === 'zh-CN' ? '最近草稿' : 'Recent drafts'}
              <span data-testid="homepage-recent-drafts-icon" className="mf-homepage-btn-secondary-icon">
                <FolderIcon />
              </span>
            </button>
          </div>

          <div className="mf-homepage-social">
            <div className="mf-homepage-avatars" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <span>{copy.socialProof}</span>
          </div>
        </section>

        <section className="mf-homepage-stage-wrap" aria-label={copy.activeProjects}>
          <div className="mf-homepage-lang">
            <LocalePreferenceButton variant="homepage" />
          </div>

          <div className="mf-homepage-card-shell">
            <div data-testid="homepage-preview-ruler" className="mf-homepage-ruler" aria-hidden="true">
              <RulerMarks />
            </div>

            <div className="mf-homepage-back-layer" aria-hidden="true" />

            <article data-testid="homepage-workbench-panel" className="mf-homepage-main-card">
              <div className="mf-homepage-card-head">
                <div data-testid="homepage-latest-project-card" className="mf-homepage-head-row">
                  <div className="mf-homepage-meta">
                    <div className="mf-homepage-meta-line">
                      <span className="mf-homepage-latest">{copy.latest}</span>
                      <h3>{canOpenLatestDraft ? copy.latestTitle : messages.editor.homepageRecentEmpty}</h3>
                    </div>
                    <p>{canOpenLatestDraft ? latestDate : messages.editor.homepageDraftEmpty}</p>
                  </div>
                  {canOpenLatestDraft ? (
                    <button
                      type="button"
                      className={`mf-homepage-continue${locale === 'en' ? ' mf-homepage-continue-wide' : ''}`}
                      onClick={onOpenLatestDraft}
                    >
                      <span data-testid="homepage-continue-label" className="mf-homepage-continue-label">
                        {copy.continue}
                      </span>
                      <ArrowIcon />
                    </button>
                  ) : null}
                </div>

                <div data-testid="homepage-preview-stage" className="mf-homepage-preview">
                  <div className="mf-homepage-depth-panel mf-homepage-depth-panel-back" aria-hidden="true" />
                  <div className="mf-homepage-depth-panel mf-homepage-depth-panel-mid" aria-hidden="true" />
                  <div data-testid="homepage-preview-workspace" className="mf-homepage-workspace">
                    <div className="mf-homepage-top-dots" aria-hidden="true">
                      <i />
                      <i />
                    </div>
                    <div className="mf-homepage-line-sm" aria-hidden="true" />
                    <div className="mf-homepage-message-stack" aria-hidden="true">
                      <div className="mf-homepage-msg-left">
                        <div className="mf-homepage-avatar-blue" />
                        <div className="mf-homepage-bubble-left">
                          <i />
                        </div>
                      </div>
                      <div className="mf-homepage-msg-right">
                        <div className="mf-homepage-bubble-right">
                          <i />
                        </div>
                        <div className="mf-homepage-avatar-gray" />
                      </div>
                    </div>
                    <div data-testid="homepage-preview-tag" className="mf-homepage-mini-tag">
                      {copy.previewTag}
                    </div>
                    <CursorIcon />
                  </div>
                </div>
              </div>

              <div data-testid="homepage-active-projects" className="mf-homepage-card-foot">
                <div className="mf-homepage-foot-head">
                  <h4>{copy.activeProjects}</h4>
                  <div className="mf-homepage-msgs">
                    <MessagesIcon />
                    <span>{copy.newMessages}</span>
                  </div>
                </div>

                <div className="mf-homepage-project-grid">
                  <div data-testid="homepage-active-project-tile" className="mf-homepage-tile">
                    <div className="mf-homepage-tile-icon">
                      <LayersIcon />
                    </div>
                    <div>
                      <strong>{copy.tileTitle}</strong>
                      <span>{copy.tileTime}</span>
                    </div>
                  </div>
                  <div data-testid="homepage-new-project-tile" className="mf-homepage-tile-add">
                    {copy.newProject}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
