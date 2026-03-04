// ============================================================
// 🦀 Krab TUI — Tool Execution Panel Component
// ============================================================
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface ToolExecution {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  result?: string;
  error?: string;
}

export const ToolExecutionPanel: React.FC = () => {
  const [executions, setExecutions] = useState<ToolExecution[]>([]);

  // Mock data for demonstration
  useEffect(() => {
    const mockExecutions: ToolExecution[] = [
      {
        id: '1',
        name: 'web_search',
        status: 'completed',
        startTime: Date.now() - 5000,
        endTime: Date.now() - 3000,
        result: 'Found 10 results'
      },
      {
        id: '2',
        name: 'file_read',
        status: 'running',
        startTime: Date.now() - 1000,
      }
    ];
    setExecutions(mockExecutions);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Spinner type="dots" />;
      case 'completed': return <Text color="green">✓</Text>;
      case 'error': return <Text color="red">✗</Text>;
      default: return <Text>?</Text>;
    }
  };

  const formatDuration = (start: number, end?: number) => {
    const duration = (end || Date.now()) - start;
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderBottom borderColor="yellow" paddingX={1}>
        <Text bold color="yellow">🛠️ Tool Execution</Text>
      </Box>

      {/* Active Tools */}
      <Box flexDirection="column" flexGrow={1} padding={1}>
        {executions.length === 0 ? (
          <Text color="dim">No tools executed yet</Text>
        ) : (
          executions.map((exec) => (
            <Box key={exec.id} flexDirection="column" marginY={1}>
              <Box flexDirection="row">
                {getStatusIcon(exec.status)}
                <Text> </Text>
                <Text bold>{exec.name}</Text>
                <Text color="dim"> ({formatDuration(exec.startTime, exec.endTime)})</Text>
              </Box>
              
              {exec.result && (
                <Text color="dim" wrap="truncate">
                  {exec.result}
                </Text>
              )}
              
              {exec.error && (
                <Text color="red" wrap="truncate">
                  {exec.error}
                </Text>
              )}
            </Box>
          ))
        )}
      </Box>

      {/* Footer */}
      <Box borderTop borderColor="yellow" paddingX={1}>
        <Text color="dim">
          {executions.filter(e => e.status === 'running').length} running
        </Text>
      </Box>
    </Box>
  );
};
