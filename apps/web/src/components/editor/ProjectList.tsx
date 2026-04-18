import type { ProjectSummary } from '@/lib/persistence';
import { useLocale } from '@/lib/locale';

const formatProjectName = (
  project: ProjectSummary,
  fallbackName: string,
) => project.name.trim() || fallbackName;

export function ProjectList(props: {
  projects: ProjectSummary[];
  onOpenProject: (projectId: string) => void;
  className?: string;
}) {
  const { messages, formatDateTime } = useLocale();

  if (!props.projects.length) {
    return (
      <div className={props.className}>
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center shadow-sm">
          <p className="text-base font-medium text-slate-700">{messages.editor.projectListEmpty}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={props.className}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {props.projects.map((project) => {
          const projectName = formatProjectName(project, messages.editor.projectUntitledFallback);

          return (
            <article
              key={project.id}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
            >
              <div className="aspect-[16/9] bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%),linear-gradient(-45deg,#f8fafc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f8fafc_75%),linear-gradient(-45deg,transparent_75%,#f8fafc_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px]">
                {project.coverImageDataUrl ? (
                  <img src={project.coverImageDataUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="space-y-3 px-5 py-4">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-slate-900">{projectName}</h3>
                  <p className="text-sm text-slate-500">{formatDateTime(project.updatedAt)}</p>
                </div>
                <button
                  type="button"
                  aria-label={messages.editor.openProject(projectName)}
                  className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  onClick={() => props.onOpenProject(project.id)}
                >
                  {messages.editor.homepageRecentContinue}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
