import { useRef, useCallback, useState, useEffect } from 'react';
import { MicVAD, utils } from '@ricky0123/vad-web';

const SILENCE_MS = 2000;

export interface UseVADOptions {
  onSpeechEnd: (wavBlob: Blob) => void;
  onSpeechStart?: () => void;
  onError?: (msg: string) => void;
}

export function useVAD({ onSpeechEnd, onSpeechStart, onError }: UseVADOptions) {
  const vadRef = useRef<MicVAD | null>(null);
  const [isListening, setIsListening] = useState(false);

  const onSpeechEndRef = useRef(onSpeechEnd);
  const onSpeechStartRef = useRef(onSpeechStart);
  const onErrorRef = useRef(onError);
  useEffect(() => { onSpeechEndRef.current = onSpeechEnd; }, [onSpeechEnd]);
  useEffect(() => { onSpeechStartRef.current = onSpeechStart; }, [onSpeechStart]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const start = useCallback(async () => {
    if (vadRef.current) {
      await vadRef.current.destroy();
      vadRef.current = null;
    }

    try {
      const vad = await MicVAD.new({
        model: 'legacy',
        baseAssetPath: '/',
        onnxWASMBasePath: '/',
        redemptionMs: SILENCE_MS,
        minSpeechMs: 300,
        preSpeechPadMs: 300,
        positiveSpeechThreshold: 0.5,
        negativeSpeechThreshold: 0.35,
        startOnLoad: true,
        onSpeechStart: () => {
          console.log('[VAD] speech start');
          onSpeechStartRef.current?.();
        },
        onSpeechEnd: (audio: Float32Array) => {
          console.log('[VAD] speech end, samples:', audio.length);
          const wavBuffer = utils.encodeWAV(audio);
          const blob = new Blob([wavBuffer], { type: 'audio/wav' });
          onSpeechEndRef.current(blob);
        },
        onVADMisfire: () => {
          console.log('[VAD] misfire (speech too short)');
        },
      });

      vadRef.current = vad;
      setIsListening(true);
      console.log('[VAD] started, listening:', vad.listening);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[VAD] failed to start:', msg);
      onErrorRef.current?.(`VAD failed: ${msg}`);
    }
  }, []);

  const stop = useCallback(async () => {
    if (vadRef.current) {
      await vadRef.current.destroy();
      vadRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      vadRef.current?.destroy();
    };
  }, []);

  return { start, stop, isListening };
}
