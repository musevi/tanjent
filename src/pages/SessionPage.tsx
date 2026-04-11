import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  completeSession,
  getSession,
  MessageOut,
  SessionOut,
} from '../api/sessions';
import { MicButton } from '../components/MicButton';
import { ResponsePanel } from '../components/ResponsePanel';
import { StatusBadge } from '../components/StatusBadge';
import { TranscriptPanel } from '../components/TranscriptPanel';
import { useVoiceJournal } from '../hooks/useVoiceJournal';

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionOut | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const onTurnComplete = useCallback((userMsg: MessageOut, assistantMsg: MessageOut) => {
    setSession((prev) =>
      prev ? { ...prev, messages: [...prev.messages, userMsg, assistantMsg] } : prev
    );
  }, []);

  const { state, startRecording, stopRecording, stopAudio } = useVoiceJournal(
    id!,
    onTurnComplete
  );

  useEffect(() => {
    getSession(id!).then((r) => setSession(r.data));
  }, [id]);

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const r = await completeSession(id!);
      setSession(r.data);
    } finally {
      setIsCompleting(false);
    }
  };

  const isActive = session?.status === 'active';

  // Messages already saved to DB (persisted turns)
  const persistedMessages = session?.messages ?? [];
  // IDs of messages shown in the live turn (avoid double-rendering after onTurnComplete)
  const liveTranscript = state.transcript;
  const liveResponse = state.response;
  const showLiveTranscript = isActive && liveTranscript && (
    // Don't re-show if already added to persisted messages
    !persistedMessages.some(
      (m) => m.role === 'user' && m.content === liveTranscript
    )
  );
  const showLiveResponse = isActive && liveResponse && (
    !persistedMessages.some(
      (m) => m.role === 'assistant' && m.content === liveResponse
    )
  );

  return (
    <main className="app">
      <header className="app-header">
        <h1>{isActive ? 'Session' : 'Past Session'}</h1>
        {isActive && <StatusBadge status={state.status} />}
        {!isActive && session?.completed_at && (
          <span className="status-badge status-badge--completed">Completed</span>
        )}
      </header>

      {/* Persisted conversation history */}
      {persistedMessages.map((m) =>
        m.role === 'user' ? (
          <TranscriptPanel key={m.id} transcript={m.content} />
        ) : (
          <ResponsePanel
            key={m.id}
            response={m.content}
            status="idle"
            onStopAudio={() => {}}
          />
        )
      )}

      {/* Live turn feedback (before saved to DB) */}
      {showLiveTranscript && <TranscriptPanel transcript={liveTranscript} />}
      {showLiveResponse && (
        <ResponsePanel
          response={liveResponse}
          status={state.status}
          onStopAudio={stopAudio}
        />
      )}

      {state.errorMessage && (
        <div className="error-banner">{state.errorMessage}</div>
      )}

      {isActive && (
        <div className="session-actions">
          <div className="mic-area">
            <MicButton
              status={state.status}
              onStart={startRecording}
              onStop={stopRecording}
            />
          </div>
          <button
            className="complete-button"
            onClick={handleComplete}
            disabled={isCompleting || state.status !== 'idle'}
          >
            {isCompleting ? 'Completing…' : 'Complete Session'}
          </button>
        </div>
      )}

      {!isActive && session?.summary && (
        <div className="panel panel--summary">
          <h2>Summary</h2>
          <p>{session.summary}</p>
        </div>
      )}

      {!isActive && (
        <button className="back-button" onClick={() => navigate('/history')}>
          ← Back to History
        </button>
      )}
    </main>
  );
}
