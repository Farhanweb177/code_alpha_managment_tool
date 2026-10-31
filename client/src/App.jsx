import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import Register from './pages/Register';
import Projects from './pages/Projects';
import Project from './pages/Project';
import Board from './pages/Board';
import AppLayout from './components/AppLayout';
import { Spinner } from './components/Skeleton';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-boot">
        <span className="brand-mark">TF</span>
        <Spinner size={22} />
        <span className="muted">Loading your workspace…</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route
        path="/"
        element={
          <Protected>
            <Projects />
          </Protected>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <Protected>
            <Project />
          </Protected>
        }
      />
      <Route
        path="/projects/:projectId/boards/:boardId"
        element={
          <Protected>
            <Board />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
