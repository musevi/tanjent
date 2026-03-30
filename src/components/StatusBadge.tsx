import type { JournalStatus } from '../hooks/useVoiceJournal';

const STATUS_LABELS: Record<JournalStatus, string> = {
  idle: 'Ready',
  recording: 'Listening\u2026',
  transcribing: 'Transcribing\u2026',
  thinking: 'Thinking\u2026',
  speaking: 'Speaking\u2026',
  error: 'Error',
};

export function StatusBadge({ status }: { status: JournalStatus }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
