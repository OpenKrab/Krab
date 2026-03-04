// ============================================================
// 🦀 Krab — Desktop Preload Script
// ============================================================
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('krabAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app-version'),
  getSystemInfo: () => ipcRenderer.invoke('system-info'),

  // Command execution
  executeCommand: (command: string, args?: string[]) => 
    ipcRenderer.invoke('execute-command', command, args),

  // File operations
  showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),

  // External links
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // Events
  onNewChat: (callback: () => void) => {
    ipcRenderer.on('new-chat', callback);
  },
  
  onClearHistory: (callback: () => void) => {
    ipcRenderer.on('clear-history', callback);
  },

  onOpenVoiceSettings: (callback: () => void) => {
    ipcRenderer.on('open-voice-settings', callback);
  },

  onOpenWebTools: (callback: () => void) => {
    ipcRenderer.on('open-web-tools', callback);
  },

  onOpenSystemMonitor: (callback: () => void) => {
    ipcRenderer.on('open-system-monitor', callback);
  },

  onProtocolUrl: (callback: (url: string) => void) => {
    ipcRenderer.on('protocol-url', callback);
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Type definitions for renderer
export interface KrabAPI {
  getVersion(): Promise<string>;
  getSystemInfo(): Promise<any>;
  executeCommand(command: string, args?: string[]): Promise<any>;
  showSaveDialog(options: any): Promise<any>;
  showOpenDialog(options: any): Promise<any>;
  openExternal(url: string): Promise<void>;
  onNewChat(callback: () => void): void;
  onClearHistory(callback: () => void): void;
  onOpenVoiceSettings(callback: () => void): void;
  onOpenWebTools(callback: () => void): void;
  onOpenSystemMonitor(callback: () => void): void;
  onProtocolUrl(callback: (url: string) => void): void;
  removeAllListeners(channel: string): void;
}

declare global {
  interface Window {
    krabAPI: KrabAPI;
  }
}
