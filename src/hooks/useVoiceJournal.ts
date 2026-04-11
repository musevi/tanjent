import { useState, useRef, useCallback, useEffect } from 'react';
import { sendTurn, MessageOut } from '../api/sessions';
import { useVAD } from './useVAD';

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
  const [autoMode, setAutoMode] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Refs to avoid stale closures in VAD callbacks and runPipeline
  const autoModeRef = useRef(autoMode);
  const sessionIdRef = useRef(sessionId);
  const onTurnCompleteRef = useRef(onTurnComplete);
  useEffect(() => { autoModeRef.current = autoMode; }, [autoMode]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { onTurnCompleteRef.current = onTurnComplete; }, [onTurnComplete]);

  // We need a ref to vad.start so runPipeline can restart it without circular deps
  const vadStartRef = useRef<() => Promise<void>>(async () => {});

  const setStatus = (status: JournalStatus) =>
    setState((prev) => ({ ...prev, status }));

  // --- Pipeline (shared by both modes) ---
  const runPipeline = useCallback(async (audioBlob: Blob, mimeType: string) => {
    try {
      setStatus('transcribing');

      const { data } = await sendTurn(sessionIdRef.current, audioBlob, mimeType);

      setState((prev) => ({
        ...prev,
        transcript: data.transcript,
        response: data.response_text,
        status: 'speaking',
      }));

      await playBase64Audio(data.audio_base64);

      if (onTurnCompleteRef.current) {
        const now = new Date().toISOString();
        onTurnCompleteRef.current(
          { id: `live-user-${Date.now()}`, session_id: sessionIdRef.current, role: 'user', content: data.transcript, created_at: now },
          { id: `live-asst-${Date.now()}`, session_id: sessionIdRef.current, role: 'assistant', content: data.response_text, created_at: now }
        );
      }

      // In auto mode, restart VAD listening after the response plays
      if (autoModeRef.current) {
        await vadStartRef.current();
        setState((prev) => ({ ...prev, status: 'recording' }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage:
          err instanceof Error ? err.message : 'Turn failed. Check the backend.',
      }));
    }
  }, []);

  const playBase64Audio = (base64: string): Promise<void> => {
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
        // In auto mode, don't go to idle — runPipeline will restart VAD
        if (!autoModeRef.current) {
          setStatus('idle');
        }
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

  // --- VAD (auto mode) ---
  const handleVADSpeechEnd = useCallback((wavBlob: Blob) => {
    runPipeline(wavBlob, 'audio/wav');
  }, [runPipeline]);

  const handleVADSpeechStart = useCallback(() => {
    setState({ status: 'recording', transcript: '', response: '', errorMessage: null });
  }, []);

  const handleVADError = useCallback((msg: string) => {
    setState((prev) => ({ ...prev, status: 'error', errorMessage: msg }));
  }, []);

  const vad = useVAD({
    onSpeechEnd: handleVADSpeechEnd,
    onSpeechStart: handleVADSpeechStart,
    onError: handleVADError,
  });

  // Keep vadStartRef in sync
  useEffect(() => { vadStartRef.current = vad.start; }, [vad.start]);

  // --- Manual mode recording ---
  const startManualRecording = useCallback(async () => {
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
  }, [runPipeline]);

  const stopManualRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setStatus('transcribing');
    }
  }, []);

  // --- Unified start/stop ---
  const startRecording = useCallback(async () => {
    if (autoModeRef.current) {
      setState({ status: 'recording', transcript: '', response: '', errorMessage: null });
      await vad.start();
    } else {
      await startManualRecording();
    }
  }, [vad, startManualRecording]);

  const stopRecording = useCallback(async () => {
    if (autoModeRef.current) {
      await vad.stop();
      setStatus('idle');
    } else {
      stopManualRecording();
    }
  }, [vad, stopManualRecording]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setStatus('idle');
  }, []);

  return {
    state,
    autoMode,
    setAutoMode,
    startRecording,
    stopRecording,
    stopAudio,
  };
}
