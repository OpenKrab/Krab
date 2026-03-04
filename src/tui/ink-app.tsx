// ============================================================
// 🦀 Krab — Ink TUI Main Entry
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import { ChatInterface } from './components/ChatInterface.js';
import { StatusBar } from './components/StatusBar.js';
import { CommandPalette } from './components/CommandPalette.js';
import { ToolExecutionPanel } from './components/ToolExecutionPanel.js';
import { useSlashCommands } from './hooks/useSlashCommands.js';
import { useChatHistory } from './hooks/useChatHistory.js';
import { useStreamingResponse } from './hooks/useStreamingResponse.js';
import { loadConfig } from '../core/config.js';
import { Agent } from '../core/agent.js';

interface AppProps {
  initialMessage?: string;
}

const App: React.FC<AppProps> = ({ initialMessage }) => {
  const { exit } = useApp();
  const [config, setConfig] = useState<any>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [activePanel, setActivePanel] = useState<'chat' | 'tools'>('chat');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { messages, addMessage, clearHistory, loadHistory } = useChatHistory();
  const { streamingText, isStreaming, startStreaming, appendStreaming, finishStreaming } = useStreamingResponse();
  const { executeCommand, getCommandCompletions } = useSlashCommands(agent, config);

  // Initialize config and agent
  useEffect(() => {
    try {
      const cfg = loadConfig();
      setConfig(cfg);
      const agt = new Agent(cfg);
      setAgent(agt);
      loadHistory();
      setIsLoading(false);

      // Send initial message if provided
      if (initialMessage) {
        handleSendMessage(initialMessage);
      }
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!agent) return;

    // Check for slash commands
    if (content.startsWith('/')) {
      const result = await executeCommand(content);
      if (result.type === 'exit') {
        exit();
        return;
      }
      addMessage({ role: 'system', content: result.message });
      return;
    }

    // Add user message
    addMessage({ role: 'user', content, timestamp: Date.now() });

    // Start streaming
    startStreaming();
    addMessage({ role: 'assistant', content: '', isStreaming: true });

    try {
      // Get response from agent
      const response = await agent.chat(content);
      
      // Stream the response
      const words = response.split(' ');
      let currentText = '';
      
      for (let i = 0; i < words.length; i++) {
        currentText += (i > 0 ? ' ' : '') + words[i];
        appendStreaming(currentText);
        await new Promise(resolve => setTimeout(resolve, 20)); // Simulate streaming
      }

      finishStreaming();
      addMessage({ role: 'assistant', content: response, timestamp: Date.now() });
    } catch (err: any) {
      finishStreaming();
      addMessage({ 
        role: 'assistant', 
        content: `❌ Error: ${err.message}`, 
        timestamp: Date.now(),
        isError: true 
      });
    }
  }, [agent, addMessage, startStreaming, appendStreaming, finishStreaming, executeCommand]);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape) {
      if (showCommandPalette) {
        setShowCommandPalette(false);
      } else if (activePanel === 'tools') {
        setActivePanel('chat');
      }
    }
    
    if (key.ctrl && input === 'k') {
      setShowCommandPalette(true);
    }
    
    if (key.ctrl && input === 't') {
      setActivePanel(activePanel === 'chat' ? 'tools' : 'chat');
    }
    
    if (key.ctrl && input === 'l') {
      clearHistory();
    }
  });

  if (isLoading) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
        <Text color="cyan">🦀 Loading Krab...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
        <Text color="red">❌ Error: {error}</Text>
        <Text color="dim">Run `krab wizard` to configure</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">🦀 Krab</Text>
        <Text> | </Text>
        <Text color="dim">Ctrl+K: Commands | Ctrl+T: Tools | Ctrl+L: Clear | Esc: Back</Text>
      </Box>

      {/* Main Content */}
      <Box flexGrow={1} flexDirection="row">
        {/* Chat Panel */}
        <Box flexGrow={1} flexDirection="column">
          <ChatInterface 
            messages={messages}
            onSendMessage={handleSendMessage}
            isStreaming={isStreaming}
            streamingText={streamingText}
          />
        </Box>

        {/* Tool Panel (conditionally shown) */}
        {activePanel === 'tools' && (
          <Box width={40} borderStyle="single" borderColor="yellow" flexDirection="column">
            <ToolExecutionPanel />
          </Box>
        )}
      </Box>

      {/* Status Bar */}
      <StatusBar 
        provider={config?.provider?.name || 'unknown'}
        model={config?.provider?.model || 'unknown'}
        messageCount={messages.length}
        isConnected={!!agent}
      />

      {/* Command Palette */}
      {showCommandPalette && (
        <CommandPalette 
          onSelect={(command) => {
            handleSendMessage(command);
            setShowCommandPalette(false);
          }}
          onClose={() => setShowCommandPalette(false)}
          commands={getCommandCompletions('')}
        />
      )}
    </Box>
  );
};

// Entry point
export function startTUI(initialMessage?: string) {
  render(<App initialMessage={initialMessage} />);
}
