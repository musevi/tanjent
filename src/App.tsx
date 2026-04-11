import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import SessionPage from './pages/SessionPage';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  const { user, logout } = useAuth();

  return (
    <>
      {user && (
        <nav className="app-nav">
          <Link to="/" className="nav-brand">Tanjent</Link>
          <div className="nav-links">
            <Link to="/history">History</Link>
            <button onClick={logout} className="nav-logout">Sign out</button>
          </div>
        </nav>
      )}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <HomePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/session/:id"
          element={
            <PrivateRoute>
              <SessionPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/history"
          element={
            <PrivateRoute>
              <HistoryPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
