import { useVoiceJournal } from './hooks/useVoiceJournal';
import { MicButton } from './components/MicButton';
import { StatusBadge } from './components/StatusBadge';
import { TranscriptPanel } from './components/TranscriptPanel';
import { ResponsePanel } from './components/ResponsePanel';

export default function App() {
  const { state, startRecording, stopRecording, stopAudio } = useVoiceJournal();

  return (
    <main className="app">
      <header className="app-header">
        <h1>Tanjent</h1>
        <StatusBadge status={state.status} />
      </header>

      <div className="mic-area">
        <MicButton
          status={state.status}
          onStart={startRecording}
          onStop={stopRecording}
        />
      </div>

      {state.errorMessage && (
        <div className="error-banner" role="alert">
          {state.errorMessage}
        </div>
      )}

      <TranscriptPanel transcript={state.transcript} />
      <ResponsePanel
        response={state.response}
        status={state.status}
        onStopAudio={stopAudio}
      />
    </main>
  );
}
