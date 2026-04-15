import { useLocale } from '@/lib/locale';
import { HomepageHeroMotion } from './HomepageHeroMotion';
import { LocalePreferenceButton } from './LocalePreferenceButton';

export type HomepageDraftPreview = {
  id: string;
  updatedAt: string;
  annotationCount: number;
  hasAsset: boolean;
};

export function EditorHomepage(props: {
  latestDraft: HomepageDraftPreview | null;
  onUpload: () => void;
  onOpenLatestDraft: () => void;
}) {
  const { formatDateTime, locale, messages } = useLocale();
  const hasLatestDraft = Boolean(props.latestDraft);
  const canContinueLatestDraft = Boolean(props.latestDraft?.hasAsset);
  const recentSummaryId = 'editor-homepage-recent-summary';

  return (
    <section
      aria-labelledby="editor-homepage-title"
      data-testid="editor-homepage-root"
      className="relative flex h-full min-h-full w-full flex-col overflow-hidden rounded-[38px] border border-[#d8e5f7] bg-[radial-gradient(circle_at_12%_10%,rgba(191,219,254,0.46),transparent_26%),radial-gradient(circle_at_88%_14%,rgba(224,242,254,0.74),transparent_28%),linear-gradient(180deg,#f7fbff_0%,#eef5ff_100%)] text-slate-900 shadow-[0_24px_80px_rgba(91,132,185,0.16)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.82),transparent_46%),radial-gradient(circle_at_15%_54%,rgba(147,197,253,0.14),transparent_34%),radial-gradient(circle_at_84%_32%,rgba(186,230,253,0.14),transparent_28%)]" />

      <div className="relative z-[1] mx-auto flex h-full min-h-0 w-full max-w-[1560px] flex-1 flex-col px-6 py-6 md:px-10 md:py-8 xl:px-14 xl:py-10">
        <header className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex size-[52px] shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#2d63ea] to-[#2f62dd] text-[15px] font-extrabold text-white shadow-[0_14px_30px_rgba(37,99,235,0.22)]">
              M
            </div>
            <div className="min-w-0">
              <strong className="block text-[20px] font-[800] tracking-[-0.04em] text-slate-900">
                Marker Feedback
              </strong>
              <span className="mt-1 block text-[13px] leading-[1.45] text-[#7d8fac]">
                {messages.editor.homepageBrandLine}
              </span>
            </div>
          </div>

          <LocalePreferenceButton variant="homepage" />
        </header>

        <div
          data-testid="homepage-main-grid"
          className="grid min-h-0 flex-1 items-stretch gap-5 pt-6 xl:grid-cols-[minmax(0,0.6fr)_minmax(380px,0.4fr)]"
        >
          <section
            data-testid="homepage-left-hero"
            className="relative min-h-[420px] overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(246,250,255,0.56)_100%)] px-8 py-8 shadow-[0_18px_54px_rgba(111,146,191,0.08)] backdrop-blur-xl md:px-10 xl:h-full xl:min-h-[640px] xl:px-12"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_16%,rgba(255,255,255,0.92),transparent_30%),linear-gradient(135deg,rgba(59,130,246,0.08)_0%,transparent_40%)]" />

            <div className="relative z-[2] flex h-full max-w-[520px] flex-col justify-center gap-5 py-8 xl:gap-6 xl:py-10">
              <span className="inline-flex h-10 w-fit items-center rounded-full border border-[#d9e7ff] bg-[linear-gradient(180deg,rgba(243,247,255,0.98)_0%,rgba(231,240,255,0.96)_100%)] px-5 text-[13px] font-[760] tracking-[-0.02em] text-[#3266da] shadow-[0_8px_20px_rgba(84,125,193,0.08)]">
                {messages.editor.homepageEyebrow}
              </span>

              <h1
                id="editor-homepage-title"
                className={`text-slate-950 ${
                  locale === 'zh-CN'
                    ? 'max-w-[8.5ch] text-[56px] font-[820] leading-[1.08] tracking-[-0.06em] xl:text-[60px]'
                    : 'max-w-[12ch] text-[48px] font-[820] leading-[1.08] tracking-[-0.055em] xl:text-[54px]'
                }`}
              >
                {messages.editor.homepageTitle}
              </h1>

              <p
                className={`text-[17px] leading-[1.75] text-[#586c8b] ${
                  locale === 'zh-CN' ? 'max-w-[430px]' : 'max-w-[440px]'
                }`}
              >
                {messages.editor.homepageDescription}
              </p>

              <div data-testid="homepage-cta-row" className="flex flex-wrap gap-4 pt-2">
                <button
                  type="button"
                  className="inline-flex h-[66px] items-center justify-center rounded-[20px] bg-gradient-to-br from-[#3068eb] to-[#2f5ddd] px-[28px] text-[15px] font-[780] tracking-[-0.02em] text-white shadow-[0_18px_34px_rgba(43,99,219,0.28)] transition hover:brightness-[1.03]"
                  onClick={props.onUpload}
                >
                  {messages.editor.homepageUploadImage}
                </button>
                <button
                  type="button"
                  className={`inline-flex h-[66px] items-center justify-center rounded-[20px] border px-[28px] text-[15px] font-[760] tracking-[-0.02em] transition ${
                    hasLatestDraft
                      ? canContinueLatestDraft
                        ? 'border-[#d7e6fb] bg-white/94 text-[#6e82a4] shadow-[0_10px_24px_rgba(132,166,217,0.08)] hover:border-[#c7daf8] hover:bg-white'
                        : 'border-[#e1eaf7] bg-white/84 text-slate-400'
                      : 'border-[#e1eaf7] bg-white/84 text-slate-400'
                  }`}
                  disabled={!canContinueLatestDraft}
                  onClick={props.onOpenLatestDraft}
                >
                  {messages.editor.homepageOpenLatestDraft}
                </button>
              </div>

              <p className="max-w-[420px] pt-1 text-[13px] leading-[1.65] text-[#8798b3]">
                {messages.editor.homepageHint}
              </p>
            </div>
          </section>

          <aside
            aria-label={messages.editor.homepageRecentTitle}
            data-testid="homepage-glass-stage"
            className="relative min-h-[360px] overflow-hidden rounded-[34px] border border-white/70 bg-white/42 shadow-[0_18px_54px_rgba(111,146,191,0.12)] backdrop-blur-xl xl:h-full xl:min-h-[640px]"
          >
            <div data-testid="homepage-stage-atmosphere" className="absolute inset-0">
              <HomepageHeroMotion />
            </div>

            <div className="relative z-[2] flex h-full flex-col">
              <article
                aria-describedby={recentSummaryId}
                aria-label={messages.editor.homepageRecentTitle}
                data-testid="homepage-floating-recent-card"
                className="absolute left-7 right-7 top-7 rounded-[28px] border border-white/80 bg-white/68 p-5 shadow-[0_18px_46px_rgba(103,135,180,0.16)] backdrop-blur"
              >
                {props.latestDraft ? (
                  <>
                    <div className="max-w-[240px] text-[15px] font-extrabold tracking-[-0.02em] text-slate-900">
                      {props.latestDraft.id}
                    </div>

                    <div className="mt-3 text-[13px] leading-[1.65] text-[#4f6383]">
                      {formatDateTime(props.latestDraft.updatedAt)}
                    </div>

                    {canContinueLatestDraft ? (
                      <button
                        type="button"
                        className="mt-4 inline-flex items-center text-[13px] font-extrabold text-blue-700 transition hover:text-blue-800"
                        onClick={props.onOpenLatestDraft}
                      >
                        {messages.editor.homepageRecentContinue}
                      </button>
                    ) : (
                      <p className="mt-4 text-[13px] leading-[1.65] text-[#7c8da8]">
                        {messages.editor.homepageDraftEmpty}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[15px] leading-[1.65] text-[#7c8da8]">
                    {messages.editor.homepageRecentEmpty}
                  </p>
                )}
              </article>

              <div data-testid="homepage-recent-copy" className="mt-auto px-8 pb-8 text-[#7d8fac]">
                <h2 className="text-[20px] font-[820] tracking-[-0.04em] text-slate-950">
                  {messages.editor.homepageRecentTitle}
                </h2>
                <p id={recentSummaryId} className="mt-3 max-w-[290px] text-[15px] leading-[1.7]">
                  {messages.editor.homepageRecentSummary}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
