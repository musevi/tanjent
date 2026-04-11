import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, getSessions, SessionListItem } from '../api/sessions';
import { SessionCard } from '../components/SessionCard';
import { useAuth } from '../contexts/AuthContext';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    getSessions().then((r) => setSessions(r.data));
  }, []);

  const handleNew = async () => {
    setIsCreating(true);
    try {
      const r = await createSession();
      navigate(`/session/${r.data.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  const recentSessions = sessions.slice(0, 5);

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>Tanjent</h1>
          {user && <p className="text-muted">{user.email}</p>}
        </div>
      </header>

      <div className="mic-area">
        <button className="mic-button" onClick={handleNew} disabled={isCreating}>
          {isCreating ? 'Starting…' : '+ Start New Session'}
        </button>
      </div>

      {recentSessions.length > 0 && (
        <section>
          <h2 className="section-title">Recent Sessions</h2>
          {recentSessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onClick={() => navigate(`/session/${s.id}`)}
            />
          ))}
        </section>
      )}

      {sessions.length === 0 && (
        <p className="text-muted text-center">
          No sessions yet. Start one above!
        </p>
      )}
    </main>
  );
}
