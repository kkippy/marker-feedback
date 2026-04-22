import { AnimatePresence, LayoutGroup } from 'motion/react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RouteTransitionShell } from '@/components/motion/routeTransition';
import { EditorPage } from './routes/EditorPage';
import { ProjectDetailPage } from './routes/ProjectDetailPage';
import { ProjectsPage } from './routes/ProjectsPage';
import { SharePage } from './routes/SharePage';

export default function App() {
  const location = useLocation();

  return (
    <LayoutGroup id="app-route-layout">
      <div className="relative h-full min-h-0 overflow-hidden">
        <AnimatePresence initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Navigate to="/editor" replace />} />
            <Route
              path="/editor"
              element={
                <RouteTransitionShell routeKey="editor">
                  <EditorPage />
                </RouteTransitionShell>
              }
            />
            <Route
              path="/projects"
              element={
                <RouteTransitionShell routeKey="projects">
                  <ProjectsPage />
                </RouteTransitionShell>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <RouteTransitionShell routeKey="project-detail">
                  <ProjectDetailPage />
                </RouteTransitionShell>
              }
            />
            <Route
              path="/share/:token"
              element={
                <RouteTransitionShell routeKey="share">
                  <SharePage />
                </RouteTransitionShell>
              }
            />
          </Routes>
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
