import { Navigate, Route, Routes } from 'react-router-dom';
import { EditorPage } from './routes/EditorPage';
import { ProjectsPage } from './routes/ProjectsPage';
import { SharePage } from './routes/SharePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/editor" replace />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/share/:token" element={<SharePage />} />
    </Routes>
  );
}
