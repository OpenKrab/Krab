// ============================================================
// 🦀 Krab Mobile — React Context
// ============================================================
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Message, ChatConfig, KrabContextValue, Attachment } from './types';

const defaultConfig: ChatConfig = {
  provider: 'openrouter',
  model: 'google/gemini-2.5-flash',
  enableVoice: true,
  enableCamera: true,
  language: 'th'
};

const KrabContext = createContext<KrabContextValue | null>(null);

export const KrabProvider: React.FC<{ children: React.ReactNode; config?: Partial<ChatConfig> }> = ({
  children,
  config: initialConfig
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [config, setConfig] = useState<ChatConfig>({ ...defaultConfig, ...initialConfig });

  const sendMessage = useCallback(async (content: string, attachments?: Attachment[]) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Call Krab API
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://krab.dev',
          'X-OpenRouter-Title': 'Krab Mobile'
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content }
          ]
        })
      });

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || '';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your API key and try again.',
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, config]);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  const updateConfig = useCallback((newConfig: Partial<ChatConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  return (
    <KrabContext.Provider
      value={{
        messages,
        isLoading,
        isConnected,
        sendMessage,
        clearChat,
        config,
        updateConfig
      }}
    >
      {children}
    </KrabContext.Provider>
  );
};

export const useKrab = () => {
  const context = useContext(KrabContext);
  if (!context) {
    throw new Error('useKrab must be used within a KrabProvider');
  }
  return context;
};
