// ============================================================
// 🦀 Krab TUI — Slash Commands Hook
// ============================================================
import { useCallback, useState } from 'react';

interface CommandResult {
  type: 'success' | 'error' | 'exit' | 'info';
  message: string;
}

interface Command {
  name: string;
  description: string;
  args?: string;
  handler: (args: string) => Promise<CommandResult> | CommandResult;
}

export const useSlashCommands = (agent: any, config: any) => {
  const [availableModels] = useState([
    'google/gemini-2.5-flash',
    'openrouter/openrouter/free',
    'kilocode/z-ai/glm-5:free',
    'anthropic/claude-3-haiku',
    'openai/gpt-4o-mini'
  ]);

  const commands: Command[] = [
    {
      name: 'help',
      description: 'Show available commands',
      handler: () => ({
        type: 'info' as const,
        message: `Available commands:
/model [name] - Change AI model
/search [query] - Search the web
/clear - Clear chat history
/exit - Exit the application
/help - Show this help message`
      })
    },
    {
      name: 'model',
      description: 'Change AI model',
      args: '[model-name]',
      handler: (args) => {
        if (!args) {
          return {
            type: 'info' as const,
            message: `Available models:\n${availableModels.map(m => `  - ${m}`).join('\n')}`
          };
        }
        
        // In real implementation, this would update the config
        return {
          type: 'success' as const,
          message: `Model changed to: ${args}`
        };
      }
    },
    {
      name: 'search',
      description: 'Search the web',
      args: '<query>',
      handler: async (args) => {
        if (!args) {
          return {
            type: 'error' as const,
            message: 'Please provide a search query. Usage: /search <query>'
          };
        }
        
        return {
          type: 'success' as const,
          message: `Searching for: "${args}"... (This would trigger web_search tool)`
        };
      }
    },
    {
      name: 'clear',
      description: 'Clear chat history',
      handler: () => ({
        type: 'success' as const,
        message: 'Chat history cleared'
      })
    },
    {
      name: 'exit',
      description: 'Exit the application',
      handler: () => ({
        type: 'exit' as const,
        message: 'Goodbye! 👋'
      })
    },
    {
      name: 'quit',
      description: 'Exit the application',
      handler: () => ({
        type: 'exit' as const,
        message: 'Goodbye! 👋'
      })
    },
    {
      name: 'status',
      description: 'Show system status',
      handler: () => ({
        type: 'info' as const,
        message: `Status:
Provider: ${config?.provider?.name || 'unknown'}
Model: ${config?.provider?.model || 'unknown'}
Connected: ${agent ? 'yes' : 'no'}`
      })
    },
    {
      name: 'memory',
      description: 'Show memory statistics',
      handler: () => {
        const stats = agent?.getMemoryStats();
        return {
          type: 'info' as const,
          message: `Memory Statistics:
Total messages: ${stats?.total || 0}
Limit: ${stats?.limit || 'unlimited'}`
        };
      }
    }
  ];

  const executeCommand = useCallback(async (input: string): Promise<CommandResult> => {
    const trimmed = input.replace(/^\//, '').trim();
    const [name, ...argsParts] = trimmed.split(/\s+/);
    const args = argsParts.join(' ');
    
    const command = commands.find(cmd => cmd.name === name.toLowerCase());
    
    if (!command) {
      return {
        type: 'error' as const,
        message: `Unknown command: /${name}\nType /help for available commands`
      };
    }
    
    try {
      const result = await command.handler(args);
      return result;
    } catch (error: any) {
      return {
        type: 'error' as const,
        message: `Command failed: ${error.message}`
      };
    }
  }, [commands, agent, config]);

  const getCommandCompletions = useCallback((prefix: string) => {
    return commands
      .filter(cmd => cmd.name.toLowerCase().startsWith(prefix.toLowerCase()))
      .map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        args: cmd.args
      }));
  }, [commands]);

  return {
    executeCommand,
    getCommandCompletions,
    commands
  };
};
