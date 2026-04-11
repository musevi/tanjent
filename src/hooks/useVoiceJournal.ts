import { useState, useRef, useCallback } from 'react';
import { sendTurn, MessageOut } from '../api/sessions';

export type JournalStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface JournalState {
  status: JournalStatus;
  transcript: string;
  response: string;
  errorMessage: string | null;
}

export function useVoiceJournal(
  sessionId: string,
  onTurnComplete?: (userMsg: MessageOut, assistantMsg: MessageOut) => void
) {
  const [state, setState] = useState<JournalState>({
    status: 'idle',
    transcript: '',
    response: '',
    errorMessage: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const setStatus = (status: JournalStatus) =>
    setState((prev) => ({ ...prev, status }));

  const startRecording = useCallback(async () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setState({ status: 'recording', transcript: '', response: '', errorMessage: null });
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'Microphone access denied.',
      }));
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const audioBlob = new Blob(chunksRef.current, { type: mimeType });
      await runPipeline(audioBlob, mimeType);
    };

    recorder.start();
  }, [sessionId]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setStatus('transcribing');
    }
  }, []);

  const runPipeline = async (audioBlob: Blob, mimeType: string) => {
    try {
      setStatus('transcribing');

      const { data } = await sendTurn(sessionId, audioBlob, mimeType);

      setState((prev) => ({
        ...prev,
        transcript: data.transcript,
        response: data.response_text,
        status: 'speaking',
      }));

      await playBase64Audio(data.audio_base64);

      // Notify parent with the newly saved messages (approximate — IDs not known until DB sync)
      if (onTurnComplete) {
        const now = new Date().toISOString();
        onTurnComplete(
          { id: `live-user-${Date.now()}`, session_id: sessionId, role: 'user', content: data.transcript, created_at: now },
          { id: `live-asst-${Date.now()}`, session_id: sessionId, role: 'assistant', content: data.response_text, created_at: now }
        );
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage:
          err instanceof Error ? err.message : 'Turn failed. Check the backend.',
      }));
    }
  };

  const playBase64Audio = async (base64: string): Promise<void> => {
    return new Promise((resolve) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setStatus('idle');
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
        resolve();
      };

      audio.onerror = () => {
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'Audio playback failed.',
        }));
        resolve();
      };

      audio.play().catch(() => {
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'Audio playback failed.',
        }));
        resolve();
      });
    });
  };

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setStatus('idle');
  }, []);

  return { state, startRecording, stopRecording, stopAudio };
}
