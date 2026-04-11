import { SessionListItem } from '../api/sessions';

interface Props {
  session: SessionListItem;
  onClick: () => void;
}

export function SessionCard({ session, onClick }: Props) {
  const date = new Date(session.started_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const exchanges = Math.floor(session.message_count / 2);

  return (
    <button className="session-card" onClick={onClick}>
      <div className="session-card__meta">
        <span className={`status-badge status-badge--${session.status}`}>
          {session.status}
        </span>
        <span className="session-card__date">{date}</span>
        <span className="text-muted">
          {exchanges} {exchanges === 1 ? 'exchange' : 'exchanges'}
        </span>
      </div>
      {session.summary ? (
        <p className="session-card__summary">{session.summary}</p>
      ) : (
        <p className="session-card__summary text-muted">No summary yet</p>
      )}
    </button>
  );
}
