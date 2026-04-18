import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{messages.editor.projectListTitle}</h1>
          <p className="text-sm leading-6 text-slate-500">{messages.editor.projectListDescription}</p>
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
