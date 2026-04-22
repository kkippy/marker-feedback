import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { House } from 'lucide-react';
import { CreateProjectDialog } from '@/components/editor/CreateProjectDialog';
import { ProjectList } from '@/components/editor/ProjectList';
import { useLocale } from '@/lib/locale';
import { addScreenshotToProjectFromFile, createProjectFromFile } from '@/lib/projectCreation';
import { listProjects, type ProjectSummary } from '@/lib/persistence';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { messages } = useLocale();
  const requestRef = useRef(0);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

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
    <main className="relative isolate min-h-dvh overflow-auto bg-[#eef4fb] px-6 py-8 text-slate-900">
      <div data-testid="project-list-glow" aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-6%] top-[-1%] h-[260px] w-[320px] rounded-full bg-[#bfdbfe]/45 blur-[120px]" />
        <div className="absolute left-[16%] top-[-6%] h-[220px] w-[420px] rounded-full bg-[#dbeafe]/55 blur-[120px]" />
        <div className="absolute left-[44%] top-[-4%] h-[230px] w-[440px] rounded-full bg-[#dbeafe]/48 blur-[130px]" />
        <div className="absolute right-[4%] top-[-4%] h-[240px] w-[360px] rounded-full bg-[#dbeafe]/46 blur-[125px]" />
        <div className="absolute left-[6%] top-[30%] h-[220px] w-[340px] rounded-full bg-[#dbeafe]/38 blur-[130px]" />
        <div className="absolute left-[55%] top-[56%] h-[260px] w-[400px] rounded-full bg-[#dbeafe]/28 blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1440px]">
        <button
          type="button"
          data-testid="project-list-back-home"
          className="inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/78 px-5 py-3 text-sm font-black text-slate-600 shadow-[0_16px_34px_rgba(15,23,42,0.08)] backdrop-blur-xl transition hover:-translate-x-0.5 hover:bg-white hover:text-[#348bff]"
          onClick={() => navigate('/editor')}
        >
          <House className="size-4" />
          <span>{messages.editor.projectListBackHome}</span>
        </button>

        <header className="mt-8 mb-16">
          <h1
            data-testid="project-list-title"
            className="text-[clamp(40px,5.2vw,72px)] font-black leading-none tracking-[-0.07em] text-slate-950"
          >
            {messages.editor.projectListTitle}
          </h1>
        </header>

        <ProjectList
          projects={projects}
          onOpenProject={(projectId) => {
            navigate(`/projects/${projectId}`);
          }}
          onOpenDraft={(draftId) => {
            navigate(`/editor?sourceType=draft&draftId=${draftId}`);
          }}
          onAddScreenshot={async (projectId, file) => {
            const created = await addScreenshotToProjectFromFile({ projectId, file });
            navigate(`/editor?sourceType=draft&draftId=${created.draft.id}`);
          }}
          onCreateProject={() => {
            setIsCreateProjectOpen(true);
          }}
        />
      </div>

      <CreateProjectDialog
        open={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onCreate={async ({ name, file }) => {
          const created = await createProjectFromFile({ name, file });
          setIsCreateProjectOpen(false);
          navigate(`/editor?sourceType=draft&draftId=${created.draft.id}`);
        }}
      />
    </main>
  );
}
