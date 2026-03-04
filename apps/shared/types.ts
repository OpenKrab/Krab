// ============================================================
// 🦀 Krab Mobile — Shared Types
// ============================================================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
}

export interface Attachment {
  type: 'image' | 'audio' | 'video' | 'file';
  uri: string;
  mimeType: string;
  name?: string;
}

export interface ChatConfig {
  apiKey?: string;
  model?: string;
  provider?: 'openrouter' | 'openai' | 'kilocode';
  enableVoice?: boolean;
  enableCamera?: boolean;
  language?: string;
}

export interface GatewayConfig {
  url: string;
  token?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface KrabContextValue {
  messages: Message[];
  isLoading: boolean;
  isConnected: boolean;
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>;
  clearChat: () => void;
  config: ChatConfig;
  updateConfig: (config: Partial<ChatConfig>) => void;
}

export interface STTResult {
  text: string;
  confidence?: number;
  isFinal: boolean;
}

export interface TTSOptions {
  voice?: string;
  speed?: number;
  language?: string;
}
