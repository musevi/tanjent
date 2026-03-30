import { useState, useRef, useCallback } from 'react';
import { groq } from '../groqClient';
import { truncateForTTS } from '../utils/truncateForTTS';

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

export function useVoiceJournal() {
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

    // Prefer webm/opus; Safari falls back to audio/mp4
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
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setStatus('transcribing');
    }
  }, []);

  const runPipeline = async (audioBlob: Blob, mimeType: string) => {
    try {
      setStatus('transcribing');

      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const audioFile = new File([audioBlob], `recording.${extension}`, {
        type: mimeType,
      });

      const transcription = await groq.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-large-v3',
        response_format: 'json',
        language: 'en',
      });

      const transcript = transcription.text.trim();
      setState((prev) => ({ ...prev, transcript, status: 'thinking' }));

      await runChat(transcript);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Transcription failed.',
      }));
    }
  };

  const runChat = async (transcript: string) => {
    try {
      const chatCompletion = await groq.chat.completions.create({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content:
              'You are a thoughtful journaling companion. ' +
              "Respond to the user's journal entry with a brief, empathetic reflection " +
              'or gentle question. Keep responses concise — 1-3 sentences.',
          },
          { role: 'user', content: transcript },
        ],
        max_tokens: 200,
        temperature: 0.8,
      });

      const response = chatCompletion.choices[0]?.message?.content ?? '';
      setState((prev) => ({ ...prev, response, status: 'speaking' }));

      await runTTS(response);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'LLM call failed.',
      }));
    }
  };

  const runTTS = async (text: string) => {
    try {
      const ttsInput = truncateForTTS(text);

      const speechResponse = await groq.audio.speech.create({
        model: 'canopylabs/orpheus-v1-english',
        voice: 'hannah',
        input: ttsInput,
        response_format: 'wav',
      });

      const arrayBuffer = await speechResponse.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setStatus('idle');
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
      };

      audio.onerror = () => {
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'Audio playback failed.',
        }));
      };

      await audio.play();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'TTS failed.',
      }));
    }
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
