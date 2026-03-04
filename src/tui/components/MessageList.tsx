// ============================================================
// 🦀 Krab TUI — Message List Component
// ============================================================
import React, { useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import Link from 'ink-link';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  isStreaming?: boolean;
  isError?: boolean;
}

interface MessageListProps {
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
}

// Format message content with markdown-like syntax
const formatContent = (content: string): React.ReactNode[] => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <Text key={i} bold color="cyan">{line.replace('### ', '')}</Text>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <Text key={i} bold underline color="cyan">{line.replace('## ', '')}</Text>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <Text key={i} bold underline color="cyan" backgroundColor="black">{line.replace('# ', '')}</Text>
      );
    }
    // Bullet points
    else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <Text key={i} color="green">• {line.substring(2)}</Text>
      );
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)/);
      if (match) {
        elements.push(
          <Text key={i} color="yellow">{match[1]}.</Text>
        );
        elements.push(
          <Text key={`${i}-content`}> {match[2]}</Text>
        );
      }
    }
    // Code blocks
    else if (line.startsWith('```')) {
      elements.push(
        <Text key={i} color="dim">{line}</Text>
      );
    }
    // Inline code
    else if (line.includes('`')) {
      const parts = line.split(/(`[^`]+`)/);
      const formattedParts = parts.map((part, idx) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return <Text key={idx} color="yellow" backgroundColor="black">{part}</Text>;
        }
        return <Text key={idx}>{part}</Text>;
      });
      elements.push(<Box key={i}>{formattedParts}</Box>);
    }
    // Bold text
    else if (line.includes('**')) {
      const parts = line.split(/(\*\*[^*]+\*\*)/);
      const formattedParts = parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={idx} bold>{part.replace(/\*\*/g, '')}</Text>;
        }
        return <Text key={idx}>{part}</Text>;
      });
      elements.push(<Box key={i}>{formattedParts}</Box>);
    }
    // Regular text
    else {
      elements.push(<Text key={i}>{line}</Text>);
    }
  }

  return elements;
};

// Extract and render links
const renderLinks = (content: string): React.ReactNode => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);
  const matches = content.match(urlRegex) || [];

  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          <Text>{part}</Text>
          {matches[i] && (
            <Link url={matches[i]}>
              <Text color="cyan" underline>{matches[i]}</Text>
            </Link>
          )}
        </React.Fragment>
      ))}
    </>
  );
};

const MessageItem: React.FC<{ message: Message; isLast: boolean; streamingText: string; isStreaming: boolean }> = ({ 
  message, 
  isLast, 
  streamingText,
  isStreaming 
}) => {
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'user': return 'blue';
      case 'assistant': return 'green';
      case 'system': return 'yellow';
      default: return 'white';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user': return '👤';
      case 'assistant': return '🦀';
      case 'system': return '⚙️';
      default: return '❓';
    }
  };

  const content = isLast && isStreaming && message.role === 'assistant' 
    ? streamingText 
    : message.content;

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Header */}
      <Box flexDirection="row">
        <Text color={getRoleColor(message.role)}>
          {getRoleIcon(message.role)} {message.role.charAt(0).toUpperCase() + message.role.slice(1)}
        </Text>
        {message.timestamp && (
          <Text color="dim"> • {new Date(message.timestamp).toLocaleTimeString()}</Text>
        )}
        {isLast && isStreaming && message.role === 'assistant' && (
          <Box marginLeft={1}>
            <Spinner type="dots" />
          </Box>
        )}
      </Box>

      {/* Content */}
      <Box marginLeft={2} flexDirection="column">
        {message.isError ? (
          <Text color="red">{content}</Text>
        ) : (
          <Box flexDirection="column">
            {formatContent(content)}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  streamingText,
  isStreaming 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    // In terminal, we just render all messages
    // For a real implementation, you'd handle scrolling
  }, [messages.length, streamingText]);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((message, index) => (
        <MessageItem 
          key={index} 
          message={message} 
          isLast={index === messages.length - 1}
          streamingText={streamingText}
          isStreaming={isStreaming}
        />
      ))}
    </Box>
  );
};
