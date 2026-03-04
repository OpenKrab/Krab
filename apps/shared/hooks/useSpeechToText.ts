// ============================================================
// 🦀 Krab Mobile — Speech-to-Text Hook
// ============================================================
import { useState, useCallback } from 'react';
import Voice from '@react-native-voice/voice';
import type { STTResult } from '../types';

export const useSpeechToText = (language: string = 'th-TH') => {
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<STTResult>({ text: '', isFinal: false });
  const [error, setError] = useState<string | null>(null);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      setResult({ text: '', isFinal: false });
      setIsListening(true);
      
      await Voice.start(language);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start listening');
      setIsListening(false);
    }
  }, [language]);

  const stopListening = useCallback(async () => {
    try {
      await Voice.stop();
      setIsListening(false);
      setResult(prev => ({ ...prev, isFinal: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop listening');
    }
  }, []);

  const cancelListening = useCallback(async () => {
    try {
      await Voice.cancel();
      setIsListening(false);
      setResult({ text: '', isFinal: false });
    } catch (err) {
      console.error('Failed to cancel listening:', err);
    }
  }, []);

  // Set up voice listeners
  Voice.onSpeechResults = (e) => {
    if (e.value && e.value[0]) {
      setResult({ text: e.value[0], isFinal: true });
    }
  };

  Voice.onSpeechPartialResults = (e) => {
    if (e.value && e.value[0]) {
      setResult({ text: e.value[0], isFinal: false });
    }
  };

  Voice.onSpeechError = (e) => {
    setError(e.error?.message || 'Speech recognition error');
    setIsListening(false);
  };

  return {
    isListening,
    result,
    error,
    startListening,
    stopListening,
    cancelListening
  };
};
