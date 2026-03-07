# Krab API Documentation

## Table of Contents
- [Agent](#agent)
- [MCP](#mcp)
- [Tools](#tools)
- [Memory](#memory)
- [Providers](#providers)

---

## Agent

### Creating an Agent

```typescript
import { Agent, loadConfig } from 'krab';

const config = loadConfig();
const agent = new Agent(config);
```

### Chat

```typescript
const response = await agent.chat('Hello, how are you?');
console.log(response);
```

### Memory Management

```typescript
// Get memory stats
const stats = agent.getMemoryStats();
console.log(stats);

// Clear memory
agent.clearMemory();

// Semantic search
const results = await agent.semanticSearch('previous discussion about project');
```

---

## MCP

### MCP Client

```typescript
import { MCPClient } from 'krab';

const client = new MCPClient({
  websocketUrl: 'ws://localhost:3001',
  timeout: 30000
});

await client.connect();

// List tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool('tool_name', { arg1: 'value' });

// Disconnect
await client.disconnect();
```

### MCP Server

```typescript
import { MCPServer } from 'krab';

const server = new MCPServer({
  port: 3001,
  websocket: true
});

await server.start();
```

### MCP Tools

```typescript
import { createMCPTools } from 'krab';

const mcpTools = createMCPTools();

// Connect to MCP server
await mcpTools.connectToMCP('my-server', {
  transport: 'websocket',
  websocketUrl: 'ws://localhost:3001'
});

// List connected tools
const tools = await mcpTools.listMCPTools('my-server');

// Send message between agents
await mcpTools.sendMessageToAgent('agent-2', {
  type: 'task',
  content: 'Process this data'
});
```

---

## Tools

### Registry

```typescript
import { registry } from 'krab';

// List all tools
const allTools = registry.getAll();

// Get specific tool
const tool = registry.get('shell');

// Get tool names
const names = registry.getNames();

// Execute tool directly
const result = await registry.executeTool('shell', { command: 'ls -la' });
```

### Built-in Tools

| Tool | Description |
|------|-------------|
| `get_datetime` | Get current time |
| `shell` | Execute shell commands |
| `web_search` | Search the web |
| `file_read` | Read file contents |
| `file_write` | Write to file |
| `file_list` | List directory contents |

---

## Memory

### Conversation Memory

```typescript
import { ConversationMemory } from 'krab';

const memory = new ConversationMemory('~/.krab/workspace', {
  maxConversations: 100,
  defaultLimit: 50
});

// Add message
memory.add({ role: 'user', content: 'Hello' });

// Get recent messages
const recent = memory.getRecent(10);

// Clear memory
memory.clear();

// Get all messages
const all = memory.getAll();
```

### Vector Memory

```typescript
const vectorMem = memory.getVectorMemory();

// Add embeddings
await vectorMem.add('document text', { id: 'doc1' });

// Search
const results = await vectorMem.search('query', 5);
```

---

## Providers

### Supported Providers

- `google` - Gemini models
- `openai` - GPT models
- `anthropic` - Claude models
- `deepseek` - DeepSeek models
- `kilocode` - Kilocode models
- `ollama` - Local Ollama models

### Configuration

```typescript
const config = {
  provider: {
    name: 'google',
    model: 'gemini-2.0-flash',
    apiKey: process.env.GEMINI_API_KEY
  },
  maxIterations: 5,
  maxRetries: 3
};
```

### Generating Text

```typescript
import { generateStructured, generateTextResponse } from 'krab';

const output = await generateStructured(config.provider, messages);
const response = await generateTextResponse(config.provider, messages);
```

---

## CLI Commands

```bash
# Interactive chat
krab chat

# Ask a question
krab ask "What is the weather?"

# MCP commands
krab mcp server start
krab mcp connect --websocket ws://localhost:3001

# Gateway
krab gateway start --port 18789

# Job scheduler
krab job list
krab job add -n "my-task" -s "*/5 * * * *" -c "echo hello"
```
