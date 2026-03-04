// ============================================================
// 🦀 Krab TUI — Chat Interface Component
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { MessageList } from './MessageList.js';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  isStreaming?: boolean;
  isError?: boolean;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isStreaming: boolean;
  streamingText: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isStreaming,
  streamingText
}) => {
  const [input, setInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const scrollRef = useRef<number>(0);

  // Handle input submission
  const handleSubmit = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  // Handle keyboard shortcuts
  useInput((input, key) => {
    if (key.return) {
      handleSubmit();
    }
    if (input === '?' && key.ctrl) {
      setShowHelp(!showHelp);
    }
  });

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current = messages.length;
  }, [messages.length]);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Messages Area */}
      <Box flexGrow={1} flexDirection="column" padding={1}>
        {messages.length === 0 ? (
          <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
            <Text color="cyan" bold>🦀 Welcome to Krab!</Text>
            <Text color="dim">Type a message or use /help for commands</Text>
            <Box marginTop={1} flexDirection="column">
              <Text color="dim">Quick commands:</Text>
              <Text color="dim">  /model - Change model</Text>
              <Text color="dim">  /search - Web search</Text>
              <Text color="dim">  /clear - Clear chat</Text>
              <Text color="dim">  /exit - Exit</Text>
            </Box>
          </Box>
        ) : (
          <MessageList 
            messages={messages} 
            streamingText={streamingText}
            isStreaming={isStreaming}
          />
        )}
      </Box>

      {/* Input Area */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Box flexDirection="row">
          <Text color="cyan">❯ </Text>
          <TextInput 
            value={input} 
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Type a message... (Ctrl+K for commands)"
          />
          {isStreaming && (
            <Box marginLeft={1}>
              <Spinner type="dots" />
            </Box>
          )}
        </Box>
      </Box>

      {/* Help Panel */}
      {showHelp && (
        <Box 
          borderStyle="single" 
          borderColor="yellow" 
          padding={1} 
          position="absolute" 
          bottom={3}
          left={0}
          right={0}
        >
          <Text bold color="yellow">⌨️  Keyboard Shortcuts</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text color="dim">Ctrl+K - Open command palette</Text>
            <Text color="dim">Ctrl+T - Toggle tool panel</Text>
            <Text color="dim">Ctrl+L - Clear chat history</Text>
            <Text color="dim">Ctrl+? - Toggle this help</Text>
            <Text color="dim">Esc - Close panels/go back</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
