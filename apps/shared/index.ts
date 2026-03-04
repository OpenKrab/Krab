// ============================================================
// 🦀 Krab Mobile — Shared Components & Hooks
// ============================================================

export { KrabProvider, useKrab } from './KrabContext';
export { ChatInterface } from './ChatInterface';
export { VoiceInput } from './VoiceInput';
export { CameraCapture } from './CameraCapture';
export { GatewayConnection } from './GatewayConnection';
export { useSpeechToText } from './hooks/useSpeechToText';
export { useTextToSpeech } from './hooks/useTextToSpeech';
export { useGateway } from './hooks/useGateway';
export type { Message, ChatConfig, GatewayConfig } from './types';
