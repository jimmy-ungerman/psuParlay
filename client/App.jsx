import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import HomePage from './pages/HomePage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-chalk-faint">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

function AppRoutes() {
  const { user } = useAuth();

  // A manually-added or admin-reset account must set its own password before it
  // can touch anything else.
  if (user && user.mustChangePassword) return <ChangePasswordPage />;

  return (
    <Routes>
      <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
      <Route path="/register" element={<RedirectIfAuthed><RegisterPage /></RedirectIfAuthed>} />
      <Route path="/invite/:token" element={<RedirectIfAuthed><RegisterPage /></RedirectIfAuthed>} />
      <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
