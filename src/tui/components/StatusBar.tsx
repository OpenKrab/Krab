// ============================================================
// 🦀 Krab TUI — Status Bar Component
// ============================================================
import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  provider: string;
  model: string;
  messageCount: number;
  isConnected: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  provider,
  model,
  messageCount,
  isConnected
}) => {
  const truncateModel = (model: string, maxLength: number = 30) => {
    if (model.length <= maxLength) return model;
    return model.substring(0, maxLength - 3) + '...';
  };

  return (
    <Box 
      borderStyle="single" 
      borderColor="cyan" 
      paddingX={1}
      flexDirection="row"
      justifyContent="space-between"
    >
      {/* Left side - Connection status */}
      <Box flexDirection="row">
        <Text color={isConnected ? 'green' : 'red'}>
          {isConnected ? '●' : '○'}
        </Text>
        <Text> </Text>
        <Text color={isConnected ? 'green' : 'red'}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
      </Box>

      {/* Center - Provider and Model */}
      <Box flexDirection="row">
        <Text color="cyan">Provider:</Text>
        <Text> {provider}</Text>
        <Text> | </Text>
        <Text color="cyan">Model:</Text>
        <Text> {truncateModel(model)}</Text>
      </Box>

      {/* Right side - Message count */}
      <Box flexDirection="row">
        <Text color="yellow">Messages:</Text>
        <Text> {messageCount}</Text>
      </Box>
    </Box>
  );
};
