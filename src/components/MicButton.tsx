import type { JournalStatus } from '../hooks/useVoiceJournal';

interface Props {
  status: JournalStatus;
  autoMode: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function MicButton({ status, autoMode, onStart, onStop }: Props) {
  const isRecording = status === 'recording';
  const isProcessing = ['transcribing', 'thinking', 'speaking'].includes(status);

  if (autoMode) {
    // In auto mode: one button to start/stop the whole listening session
    return (
      <button
        className={`mic-button${isRecording ? ' mic-button--recording' : ''}`}
        disabled={isProcessing && !isRecording}
        onClick={isRecording ? onStop : onStart}
        aria-label={isRecording ? 'Stop listening' : 'Start listening'}
      >
        {isRecording ? '⏹ Stop Listening' : '🎙 Start Listening'}
      </button>
    );
  }

  // Manual mode: same as before
  return (
    <button
      className={`mic-button${isRecording ? ' mic-button--recording' : ''}`}
      disabled={isProcessing}
      onClick={isRecording ? onStop : onStart}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isRecording ? '⏹ Stop' : '🎙 Speak'}
    </button>
  );
}
