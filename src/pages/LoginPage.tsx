import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setToken } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const fn = tab === 'login' ? login : register;
      const r = await fn(email, password);
      setToken(r.data.access_token);
      navigate('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Something went wrong.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <h1 className="auth-title">Tanjent</h1>
      <p className="auth-subtitle">Your AI journaling companion</p>

      <div className="auth-tabs">
        <button
          className={`auth-tab${tab === 'login' ? ' auth-tab--active' : ''}`}
          onClick={() => setTab('login')}
        >
          Sign in
        </button>
        <button
          className={`auth-tab${tab === 'register' ? ' auth-tab--active' : ''}`}
          onClick={() => setTab('register')}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
        />
        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Please wait…' : tab === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}
    </main>
  );
}
