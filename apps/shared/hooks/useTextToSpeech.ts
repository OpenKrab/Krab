// ============================================================
// 🦀 Krab Mobile — Text-to-Speech Hook
// ============================================================
import { useState, useCallback } from 'react';
import Tts from 'react-native-tts';
import type { TTSOptions } from '../types';

export const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speak = useCallback(async (text: string, options?: TTSOptions) => {
    try {
      setError(null);
      setIsSpeaking(true);
      
      if (options?.voice) {
        await Tts.setDefaultVoice(options.voice);
      }
      
      if (options?.speed) {
        await Tts.setDefaultRate(options.speed);
      }
      
      if (options?.language) {
        await Tts.setDefaultLanguage(options.language);
      }
      
      await Tts.speak(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to speak');
      setIsSpeaking(false);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await Tts.stop();
      setIsSpeaking(false);
    } catch (err) {
      console.error('Failed to stop TTS:', err);
    }
  }, []);

  // Listen for finish event
  Tts.addEventListener('tts-finish', () => {
    setIsSpeaking(false);
  });

  Tts.addEventListener('tts-cancel', () => {
    setIsSpeaking(false);
  });

  return {
    isSpeaking,
    error,
    speak,
    stop
  };
};
