import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function PrivateRoute({ children }: { children: JSX.Element }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return <div className="loading">Loading…</div>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
