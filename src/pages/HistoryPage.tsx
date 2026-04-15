import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteSession,
  getSessions,
  searchSessions,
  SearchResultItem,
  SessionListItem,
} from '../api/sessions';
import { SessionCard } from '../components/SessionCard';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    getSessions().then((r) => setSessions(r.data));
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchSessions(value.trim());
        setResults(r.data);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this session? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (results) {
        setResults((prev) => prev!.filter((s) => s.id !== id));
      }
    } finally {
      setDeleting(null);
    }
  };

  const displayed = results ?? sessions;

  return (
    <main className="app">
      <header className="app-header">
        <h1>History</h1>
      </header>

      <input
        className="search-input"
        type="text"
        placeholder="Search past entries..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />

      {searching && <p className="text-muted text-center">Searching...</p>}

      {results !== null && !searching && results.length === 0 && (
        <p className="text-muted text-center">No matching entries found.</p>
      )}

      {!results && sessions.length === 0 ? (
        <p className="text-muted text-center">No sessions yet.</p>
      ) : (
        displayed.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            onClick={() => navigate(`/session/${s.id}`)}
            onDelete={
              deleting === s.id ? undefined : () => handleDelete(s.id)
            }
          />
        ))
      )}
    </main>
  );
}
