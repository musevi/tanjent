import type { JournalStatus } from '../hooks/useVoiceJournal';

interface Props {
  response: string;
  status: JournalStatus;
  onStopAudio: () => void;
}

export function ResponsePanel({ response, status, onStopAudio }: Props) {
  if (!response) return null;
  return (
    <section className="panel panel--response">
      <h2>Tanjent</h2>
      <p>{response}</p>
      {status === 'speaking' && (
        <button className="stop-audio-button" onClick={onStopAudio}>
          ⏸ Stop audio
        </button>
      )}
    </section>
  );
}
