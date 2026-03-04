// ============================================================
// 🦀 Krab TUI — Command Palette Component
// ============================================================
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface Command {
  name: string;
  description: string;
  args?: string;
}

interface CommandPaletteProps {
  onSelect: (command: string) => void;
  onClose: () => void;
  commands: Command[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  onSelect,
  onClose,
  commands
}) => {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = commands.filter(cmd =>
    cmd.name.toLowerCase().includes(filter.toLowerCase()) ||
    cmd.description.toLowerCase().includes(filter.toLowerCase())
  );

  useInput((input, key) => {
    if (key.escape) {
      onClose();
    } else if (key.return) {
      if (filteredCommands[selectedIndex]) {
        const cmd = filteredCommands[selectedIndex];
        onSelect(`/${cmd.name}${cmd.args ? ' ' + cmd.args : ''}`);
      }
    } else if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(filteredCommands.length - 1, prev + 1));
    }
  });

  return (
    <Box 
      borderStyle="double" 
      borderColor="cyan" 
      flexDirection="column"
      position="absolute"
      top="20%"
      left="20%"
      right="20%"
      height={20}
      backgroundColor="black"
    >
      {/* Header */}
      <Box borderBottom borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">⌨️  Command Palette</Text>
        <Text color="dim"> ({filteredCommands.length} commands)</Text>
      </Box>

      {/* Search Input */}
      <Box paddingX={1} marginY={1}>
        <Text color="cyan">❯ </Text>
        <TextInput
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setSelectedIndex(0);
          }}
          placeholder="Type to filter commands..."
        />
      </Box>

      {/* Command List */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {filteredCommands.map((cmd, index) => (
          <Box
            key={cmd.name}
            paddingX={1}
            backgroundColor={index === selectedIndex ? 'cyan' : undefined}
          >
            <Text color={index === selectedIndex ? 'black' : 'yellow'}>
              /{cmd.name}
            </Text>
            {cmd.args && (
              <Text color={index === selectedIndex ? 'black' : 'dim'}>
                {' '}{cmd.args}
              </Text>
            )}
            <Text color={index === selectedIndex ? 'black' : 'dim'}>
              {' — '}{cmd.description}
            </Text>
          </Box>
        ))}
        
        {filteredCommands.length === 0 && (
          <Box paddingX={1}>
            <Text color="dim">No commands found</Text>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box borderTop borderColor="cyan" paddingX={1}>
        <Text color="dim">↑↓ Navigate | Enter Select | Esc Close</Text>
      </Box>
    </Box>
  );
};
