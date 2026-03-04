// ============================================================
// 🦀 Krab TUI — Streaming Response Hook
// ============================================================
import { useState, useCallback, useRef } from 'react';

export const useStreamingResponse = () => {
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStreaming = useCallback(() => {
    setStreamingText('');
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
  }, []);

  const appendStreaming = useCallback((text: string) => {
    setStreamingText(text);
  }, []);

  const finishStreaming = useCallback(() => {
    setIsStreaming(false);
    abortControllerRef.current = null;
  }, []);

  const abortStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamingText('');
  }, []);

  const streamResponse = useCallback(async (
    generator: AsyncGenerator<string>,
    onChunk?: (chunk: string) => void
  ) => {
    startStreaming();
    let fullText = '';

    try {
      for await (const chunk of generator) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }
        
        fullText += chunk;
        appendStreaming(fullText);
        onChunk?.(chunk);
      }
    } catch (error) {
      console.error('Streaming error:', error);
    } finally {
      finishStreaming();
    }

    return fullText;
  }, [startStreaming, appendStreaming, finishStreaming]);

  return {
    streamingText,
    isStreaming,
    startStreaming,
    appendStreaming,
    finishStreaming,
    abortStreaming,
    streamResponse
  };
};
