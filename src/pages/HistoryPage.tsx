import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSessions, SessionListItem } from '../api/sessions';
import { SessionCard } from '../components/SessionCard';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);

  useEffect(() => {
    getSessions().then((r) => setSessions(r.data));
  }, []);

  return (
    <main className="app">
      <header className="app-header">
        <h1>History</h1>
      </header>

      {sessions.length === 0 ? (
        <p className="text-muted text-center">No sessions yet.</p>
      ) : (
        sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            onClick={() => navigate(`/session/${s.id}`)}
          />
        ))
      )}
    </main>
  );
}
