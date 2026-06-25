import { Navigate, Route, Routes } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import ViewerPage from './pages/ViewerPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/v/demo-100days" replace />} />
      <Route path="/v/:token" element={<ViewerPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}
