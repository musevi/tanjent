import type { JournalStatus } from '../hooks/useVoiceJournal';

interface Props {
  status: JournalStatus;
  onStart: () => void;
  onStop: () => void;
}

export function MicButton({ status, onStart, onStop }: Props) {
  const isRecording = status === 'recording';
  const isDisabled = ['transcribing', 'thinking', 'speaking'].includes(status);

  return (
    <button
      className={`mic-button${isRecording ? ' mic-button--recording' : ''}`}
      disabled={isDisabled}
      onClick={isRecording ? onStop : onStart}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isRecording ? '⏹ Stop' : '🎙 Speak'}
    </button>
  );
}
