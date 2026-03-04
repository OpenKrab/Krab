// ============================================================
// 🦀 Krab TUI — Chat History Hook
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger.js';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  isStreaming?: boolean;
  isError?: boolean;
}

const HISTORY_FILE = path.join(process.cwd(), '.krab', 'chat-history.json');
const MAX_HISTORY = 1000;

export const useChatHistory = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  // Load history from file
  const loadHistory = useCallback(() => {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        setMessages(parsed.messages || []);
        logger.info('[TUI] Loaded chat history:', parsed.messages?.length || 0, 'messages');
      }
    } catch (error) {
      logger.error('[TUI] Failed to load chat history:', error);
    }
  }, []);

  // Save history to file
  const saveHistory = useCallback((newMessages: Message[]) => {
    try {
      const dir = path.dirname(HISTORY_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const data = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        messages: newMessages.slice(-MAX_HISTORY) // Keep only last 1000 messages
      };
      
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('[TUI] Failed to save chat history:', error);
    }
  }, []);

  // Add a new message
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => {
      // If last message is streaming assistant message, replace it
      if (message.role === 'assistant' && !message.isStreaming) {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'assistant' && lastMessage?.isStreaming) {
          const newMessages = [...prev.slice(0, -1), message];
          saveHistory(newMessages);
          return newMessages;
        }
      }
      
      const newMessages = [...prev, message];
      saveHistory(newMessages);
      return newMessages;
    });
  }, [saveHistory]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setMessages([]);
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        fs.unlinkSync(HISTORY_FILE);
      }
      logger.info('[TUI] Chat history cleared');
    } catch (error) {
      logger.error('[TUI] Failed to clear chat history:', error);
    }
  }, []);

  // Export history
  const exportHistory = useCallback((format: 'json' | 'txt' = 'json') => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      if (format === 'json') {
        const exportPath = path.join(process.cwd(), `krab-chat-${timestamp}.json`);
        fs.writeFileSync(exportPath, JSON.stringify({ messages }, null, 2));
        return exportPath;
      } else {
        const exportPath = path.join(process.cwd(), `krab-chat-${timestamp}.txt`);
        const text = messages
          .map(m => `[${m.role}] ${new Date(m.timestamp || 0).toLocaleString()}\n${m.content}\n`)
          .join('\n---\n\n');
        fs.writeFileSync(exportPath, text);
        return exportPath;
      }
    } catch (error) {
      logger.error('[TUI] Failed to export chat history:', error);
      return null;
    }
  }, [messages]);

  // Get message count
  const getMessageCount = useCallback(() => messages.length, [messages]);

  // Get conversation context (last N messages)
  const getContext = useCallback((count: number = 10) => {
    return messages
      .filter(m => m.role !== 'system')
      .slice(-count)
      .map(m => ({ role: m.role, content: m.content }));
  }, [messages]);

  return {
    messages,
    addMessage,
    clearHistory,
    loadHistory,
    exportHistory,
    getMessageCount,
    getContext
  };
};
