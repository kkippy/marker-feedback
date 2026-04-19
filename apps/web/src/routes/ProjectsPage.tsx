import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { House } from 'lucide-react';
import { ProjectList } from '@/components/editor/ProjectList';
import { useLocale } from '@/lib/locale';
import { listProjects, type ProjectSummary } from '@/lib/persistence';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { messages } = useLocale();
  const requestRef = useRef(0);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    requestRef.current += 1;
    const requestId = requestRef.current;

    listProjects().then((nextProjects) => {
      if (requestId === requestRef.current) {
        setProjects(nextProjects);
      }
    });

    return () => {
      if (requestRef.current === requestId) {
        requestRef.current += 1;
      }
    };
  }, []);

  return (
    <main className="min-h-dvh bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-[1300px] space-y-6">
        <div className="space-y-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-600 shadow-[0_14px_34px_rgba(15,23,42,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#bfdbfe] hover:text-[#348bff]"
            onClick={() => navigate('/')}
          >
            <House className="size-4" />
            <span>{messages.editor.projectListBackHome}</span>
          </button>

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{messages.editor.projectListTitle}</h1>
            <p className="text-sm leading-6 text-slate-500">{messages.editor.projectListDescription}</p>
          </div>
        </div>

        <ProjectList
          projects={projects}
          onOpenProject={(projectId) => {
            const project = projects.find((item) => item.id === projectId);

            if (project?.latestDraftId) {
              navigate(`/editor?sourceType=draft&draftId=${project.latestDraftId}`);
            }
          }}
        />
      </div>
    </main>
  );
}
