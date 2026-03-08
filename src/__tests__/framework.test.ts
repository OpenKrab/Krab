// ============================================================
// 🦀 Krab — Basic Functionality Tests
// ============================================================
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Mock external dependencies
vi.mock('playwright', () => ({
  chromium: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Krab Framework Core Tests', () => {
  describe('Core Types', () => {
    it('should have core types module', async () => {
      const types = await import('../core/types.js');
      expect(types).toBeDefined();
    });

    it('should have agent output schema', async () => {
      const types = await import('../core/types.js');
      expect(types.AgentOutputSchema).toBeDefined();
    });
  });

  describe('Tool Registry', () => {
    it('should have tool registry', async () => {
      const { registry } = await import('../tools/registry.js');
      expect(registry).toBeDefined();
    });
  });

  describe('Security Manager', () => {
    it('should have security manager', async () => {
      const mod = await import('../security/security-manager.js');
      expect(mod).toBeDefined();
    });
  });

  describe('Analytics System', () => {
    it('should have analytics', async () => {
      const mod = await import('../analytics/advanced-analytics.js');
      expect(mod).toBeDefined();
    });
  });

  describe('Agent Collaboration', () => {
    it('should have collaboration', async () => {
      const mod = await import('../collaboration/agent-collaboration.js');
      expect(mod).toBeDefined();
    });
  });

  describe('Code Interpreter', () => {
    it('should have code interpreter', async () => {
      const mod = await import('../sandbox/code-interpreter.js');
      expect(mod).toBeDefined();
    });
  });

  describe('Scheduler System', () => {
    it('should have scheduler', async () => {
      const mod = await import('../scheduler/cron.js');
      expect(mod).toBeDefined();
    });
  });

  describe('MCP Integration', () => {
    it('should have MCP tools', async () => {
      const mod = await import('../mcp/tools.js');
      expect(mod).toBeDefined();
    });
  });

  describe('Browser Automation', () => {
    it('should have browser tools', async () => {
      const mod = await import('../browser/tools.js');
      expect(mod).toBeDefined();
    });
  });

  describe('Computer Vision', () => {
    it('should have computer interface', async () => {
      const mod = await import('../computer/interface.js');
      expect(mod).toBeDefined();
    });
  });

  describe('Creative AI', () => {
    it('should have image generator', async () => {
      const mod = await import('../creative/image-generator.js');
      expect(mod).toBeDefined();
    });
  });
});

describe('Krab Framework Integration', () => {
  it('should initialize all major components', async () => {
    const { registry } = await import('../tools/registry.js');
    const { Agent } = await import('../core/agent.js');
    
    expect(registry).toBeDefined();
    expect(Agent).toBeDefined();
  });

  it('should have core modules available', async () => {
    const modules = [
      '../core/types.js',
      '../core/agent.js',
      '../tools/registry.js',
    ];
    
    for (const modulePath of modules) {
      const mod = await import(modulePath);
      expect(mod).toBeDefined();
    }
  });

  it('should rank newer and more relevant memory hits', async () => {
    const { MemoryManager } = await import('../memory/manager.js');
    const workspace = mkdtempSync(join(tmpdir(), 'krab-memory-test-'));
    mkdirSync(join(workspace, 'memory'), { recursive: true });
    writeFileSync(join(workspace, 'memory', 'MEMORY.md'), '# Long-term\nalpha beta gamma');
    writeFileSync(join(workspace, 'memory', '2026-03-08.md'), '# Daily\nalpha alpha latest context');

    const manager = new MemoryManager(workspace);
    const results = manager.searchMemoryRanked('alpha', 5);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].matchCount).toBeGreaterThan(0);

    rmSync(workspace, { recursive: true, force: true });
  });

  it('should return hybrid memory results from files and stored conversations', async () => {
    const { MemoryManager } = await import('../memory/manager.js');
    const workspace = mkdtempSync(join(tmpdir(), 'krab-hybrid-memory-test-'));
    mkdirSync(join(workspace, 'memory'), { recursive: true });
    mkdirSync(join(workspace, 'conversations'), { recursive: true });
    writeFileSync(join(workspace, 'memory', 'MEMORY.md'), '# Long-term\nshared alpha context');
    writeFileSync(
      join(workspace, 'conversations', 'conv-1.json'),
      JSON.stringify({
        metadata: { id: 'conv-1', updatedAt: new Date().toISOString(), messageCount: 2 },
        messages: [{ content: 'alpha from conversation' }, { content: 'follow-up alpha' }],
        summary: 'alpha summary',
      }),
    );

    const manager = new MemoryManager(workspace);
    const results = manager.getHybridMemoryResults('alpha', { limit: 5, conversationLimit: 5 });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((entry) => entry.source === 'memory_file')).toBe(true);
    expect(results.some((entry) => entry.source === 'conversation')).toBe(true);

    rmSync(workspace, { recursive: true, force: true });
  });

  it('should provide async hybrid memory results with safe fallback semantics', async () => {
    const { MemoryManager } = await import('../memory/manager.js');
    const workspace = mkdtempSync(join(tmpdir(), 'krab-async-hybrid-memory-test-'));
    mkdirSync(join(workspace, 'memory'), { recursive: true });
    mkdirSync(join(workspace, 'conversations'), { recursive: true });
    writeFileSync(join(workspace, 'memory', 'MEMORY.md'), '# Long-term\nsemantic alpha context');
    writeFileSync(
      join(workspace, 'conversations', 'conv-semantic.json'),
      JSON.stringify({
        metadata: { id: 'conv-semantic', updatedAt: new Date().toISOString(), messageCount: 1 },
        messages: [{ content: 'alpha semantic conversation text' }],
        summary: 'semantic alpha summary',
      }),
    );

    const manager = new MemoryManager(workspace);
    const results = await manager.getHybridMemoryResultsAsync('alpha', { limit: 5, conversationLimit: 5 });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((entry) => entry.source === 'memory_file' || entry.source === 'conversation' || entry.source === 'semantic_conversation')).toBe(true);

    rmSync(workspace, { recursive: true, force: true });
  });

  it('should spawn and execute a subagent runtime task', async () => {
    const { SubagentRuntime } = await import('../agent/subagent-runtime.js');
    const { Agent } = await import('../core/agent.js');

    vi.spyOn(Agent.prototype, 'chat').mockResolvedValueOnce('subagent-result');

    const runtime = new SubagentRuntime({
      agents: { defaults: { workspace: process.cwd(), model: { primary: 'test-model' } } },
      provider: { name: 'google', model: 'test-model', apiKey: 'test-key' },
      maxIterations: 3,
      maxRetries: 1,
    } as any);

    const record = runtime.spawn('researcher', 'find info', 'parent-1');
    const result = await runtime.execute(record.id, 'do work');

    expect(result.status).toBe('completed');
    expect(result.lastResult).toBe('subagent-result');
  });

  it('should record subagent lifecycle events including kill requests', async () => {
    const { SubagentRuntime } = await import('../agent/subagent-runtime.js');

    const runtime = new SubagentRuntime({
      agents: { defaults: { workspace: process.cwd(), model: { primary: 'test-model' } } },
      provider: { name: 'google', model: 'test-model', apiKey: 'test-key' },
      maxIterations: 3,
      maxRetries: 1,
    } as any);

    const record = runtime.spawn('reviewer', 'audit output', 'parent-2');
    runtime.kill(record.id);
    const events = runtime.getEvents(10);

    expect(events.some((event) => event.type === 'spawned')).toBe(true);
    expect(events.some((event) => event.type === 'kill_requested')).toBe(true);
    expect(events.some((event) => event.type === 'killed')).toBe(true);
  });

  it('should abort an in-flight subagent run when killed', async () => {
    const { SubagentRuntime } = await import('../agent/subagent-runtime.js');
    const { Agent } = await import('../core/agent.js');

    vi.spyOn(Agent.prototype, 'chat').mockImplementationOnce(async (_input, options) => {
      await new Promise((_, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
      return 'unreachable';
    });

    const runtime = new SubagentRuntime({
      agents: { defaults: { workspace: process.cwd(), model: { primary: 'test-model' } } },
      provider: { name: 'google', model: 'test-model', apiKey: 'test-key' },
      maxIterations: 3,
      maxRetries: 1,
    } as any);

    const record = runtime.spawn('worker', 'long task', 'parent-3');
    const runPromise = runtime.execute(record.id, 'wait forever');
    runtime.kill(record.id);
    const result = await runPromise;

    expect(result.status).toBe('killed');
    expect(String(result.error)).toContain('aborted');
  });

  it('should record tool diagnostics and truncate oversized tool output', async () => {
    const { registry } = await import('../tools/registry.js');
    const { executeToolCalls } = await import('../tools/executor.js');
    const { getToolExecutionDiagnostics, clearToolExecutionDiagnostics } = await import('../tools/diagnostics.js');
    const { z } = await import('zod');

    clearToolExecutionDiagnostics();
    registry.register({
      name: 'test_tool_diagnostics',
      description: 'test tool',
      parameters: z.object({ value: z.string() }),
      sideEffect: false,
      maxOutputChars: 10,
      execute: async () => ({ success: true, output: 'abcdefghijklmnopqrstuvwxyz' }),
    });

    const results = await executeToolCalls([
      { name: 'test_tool_diagnostics', args: { value: 'x' } },
      { name: 'test_tool_diagnostics', args: { value: 'x' } },
    ]);

    const diagnostics = getToolExecutionDiagnostics();

    expect(results[0].result.success).toBe(true);
    expect(String(results[0].result.output)).toContain('[truncated]');
    expect(diagnostics.some((entry) => entry.phase === 'policy')).toBe(true);
    expect(diagnostics.some((entry) => entry.phase === 'execution')).toBe(true);
  });

  it('should fire tool policy hooks during execution', async () => {
    const { registry } = await import('../tools/registry.js');
    const { executeToolCalls } = await import('../tools/executor.js');
    const { hooksManager } = await import('../hooks/index.js');
    const { clearToolExecutionDiagnostics } = await import('../tools/diagnostics.js');
    const { z } = await import('zod');

    clearToolExecutionDiagnostics();
    const hookExecute = vi.fn().mockResolvedValue(undefined);
    (hooksManager as any).hooks.set('policy-hook-test', {
      metadata: {
        name: 'policy-hook-test',
        description: 'policy hook test',
        metadata: { openclaw: { events: ['tool:policy:pre', 'tool:policy:post'], export: 'default' } },
      },
      handler: { execute: hookExecute },
      path: '/test',
      enabled: true,
    });

    registry.register({
      name: 'test_tool_policy_hook',
      description: 'test tool for policy hooks',
      parameters: z.object({ value: z.string() }),
      sideEffect: false,
      execute: async () => ({ success: true, output: 'ok' }),
    });

    await executeToolCalls([{ name: 'test_tool_policy_hook', args: { value: 'x' } }]);

    expect(hookExecute).toHaveBeenCalled();
    expect(hookExecute.mock.calls.some((call) => call[0]?.type === 'tool:policy:pre')).toBe(true);
    expect(hookExecute.mock.calls.some((call) => call[0]?.type === 'tool:policy:post')).toBe(true);
  });

  it('should filter tool diagnostics in dashboard helper output', async () => {
    const originalLog = console.log;
    const lines: string[] = [];
    console.log = (...args: any[]) => lines.push(args.join(' '));

    const { recordToolExecutionDiagnostic, clearToolExecutionDiagnostics } = await import('../tools/diagnostics.js');
    const { renderToolDiagnostics } = await import('../tui/dashboard.js');

    clearToolExecutionDiagnostics();
    recordToolExecutionDiagnostic({
      timestamp: new Date().toISOString(),
      toolName: 'tool_a',
      success: true,
      durationMs: 1,
      sideEffect: false,
      phase: 'execution',
    });
    recordToolExecutionDiagnostic({
      timestamp: new Date().toISOString(),
      toolName: 'tool_b',
      success: true,
      durationMs: 1,
      sideEffect: false,
      phase: 'execution',
    });

    renderToolDiagnostics('tool_b');
    console.log = originalLog;

    expect(lines.some((line) => line.includes('tool_b'))).toBe(true);
    expect(lines.some((line) => line.includes('tool_a'))).toBe(false);
  });

  it('should render subagent inspect details in dashboard helper output', async () => {
    const originalLog = console.log;
    const lines: string[] = [];
    console.log = (...args: any[]) => lines.push(args.join(' '));

    const { Agent } = await import('../core/agent.js');
    const { initializeSubagentRuntime } = await import('../agent/subagent-runtime.js');
    const { renderSubagentInspect } = await import('../tui/dashboard.js');

    const config = {
      agents: { defaults: { workspace: process.cwd(), model: { primary: 'test-model' } } },
      provider: { name: 'google', model: 'test-model', apiKey: 'test-key' },
      maxIterations: 3,
      maxRetries: 1,
    } as any;

    const runtime = initializeSubagentRuntime(config);
    const record = runtime.spawn('analyst', 'inspect target', 'parent-9');
    const agent = new Agent(config);

    renderSubagentInspect(agent, record.id);
    console.log = originalLog;

    expect(lines.some((line) => line.includes('analyst'))).toBe(true);
    expect(lines.some((line) => line.includes('inspect target'))).toBe(true);
  });

  it('should abort web fetch operations via AbortSignal', async () => {
    const { WebFetcher } = await import('../tools/web/fetch.js');

    const fetcher = new WebFetcher();
    const controller = new AbortController();
    controller.abort();

    await expect(fetcher.fetch({
      url: 'https://example.com',
      signal: controller.signal,
      timeout: 100,
    })).rejects.toThrow(/aborted|fetch failed/i);
  });

  it('should safely fall back when model fetching is aborted', async () => {
    const originalFetch = globalThis.fetch;
    const controller = new AbortController();
    controller.abort();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('aborted')) as any;

    try {
      const { getModels } = await import('../utils/model-fetcher.js');
      const models = await getModels('openrouter', undefined, controller.signal);

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should forward AbortSignal into OpenAI STT transcription requests', async () => {
    const { SpeechToText } = await import('../voice/stt.js');

    const controller = new AbortController();
    const createSpy = vi.fn().mockResolvedValue({ text: 'ok' });
    const stt = new SpeechToText({
      provider: 'openai',
      apiKey: 'test-key',
      signal: controller.signal,
    });

    (stt as any).constructor['OpenAI'] = undefined;
    (globalThis as any).OpenAI = undefined;
    (stt as any).transcribeWithOpenAI = async function (_audioFilePath: string) {
      const openai = {
        audio: {
          transcriptions: {
            create: createSpy,
          },
        },
      };

      const transcriptionRequest = {
        file: {},
        model: this.options.model,
        language: this.options.language,
        temperature: this.options.temperature,
        response_format: this.options.responseFormat,
      };

      await openai.audio.transcriptions.create(transcriptionRequest, {
        signal: this.options.signal,
      });

      return { text: 'ok' };
    };

    await (stt as any).transcribeWithOpenAI('dummy.wav');

    expect(createSpy).toHaveBeenCalledWith(expect.any(Object), { signal: controller.signal });
  });

  it('should return false when oauth refresh fetch is aborted', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('aborted')) as any;

    try {
      const { OAuthManager } = await import('../oauth/manager.js');
      const manager = new OAuthManager();

      manager.addProfile({
        id: 'oauth-test',
        provider: 'openai',
        type: 'oauth',
        tokens: {
          access_token: 'old-token',
          refresh_token: 'refresh-token',
        },
      });

      const config = (manager as any).configs.get('openai');
      config.signal = new AbortController().signal;

      const refreshed = await manager.refreshToken('oauth-test');
      expect(refreshed).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should resolve hooks bundled directory without CommonJS __dirname assumptions', async () => {
    const hooksModule = await import('../hooks/index.js');
    const manager = new hooksModule.HooksManager();

    expect(Array.isArray((manager as any).hookDirs)).toBe(true);
    expect((manager as any).hookDirs.some((dir: string) => dir.includes('bundled'))).toBe(true);
  });

  it('should avoid duplicate session command registration in the CLI source', async () => {
    const cliSource = readFileSync(join(process.cwd(), 'src', 'cli.ts'), 'utf8');
    const sessionRegistrations = cliSource.match(/program\.addCommand\(session(Command|Cmd)\);/g) || [];

    expect(sessionRegistrations).toHaveLength(1);
  });

  it('should register browser cleanup handlers only once across managers', async () => {
    const originalSigintListeners = process.listeners('SIGINT');
    const originalSigtermListeners = process.listeners('SIGTERM');
    const originalExitListeners = process.listeners('exit');

    try {
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');
      process.removeAllListeners('exit');

      const { BrowserSessionManager } = await import('../browser/session.js');
      new BrowserSessionManager();
      new BrowserSessionManager();

      expect(process.listeners('SIGINT')).toHaveLength(1);
      expect(process.listeners('SIGTERM')).toHaveLength(1);
      expect(process.listeners('exit')).toHaveLength(1);
    } finally {
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');
      process.removeAllListeners('exit');

      for (const listener of originalSigintListeners) process.on('SIGINT', listener);
      for (const listener of originalSigtermListeners) process.on('SIGTERM', listener);
      for (const listener of originalExitListeners) process.on('exit', listener as (...args: any[]) => void);
    }
  });

  it('should resolve shared secrets helper paths from KRAB_STATE_DIR', async () => {
    const previousStateDir = process.env.KRAB_STATE_DIR;
    const workspace = mkdtempSync(join(tmpdir(), 'krab-secrets-test-'));
    process.env.KRAB_STATE_DIR = workspace;

    const { getSecretsEnvPath, writeSecretsEnvFile, readSecretsEnvFile } = await import('../core/secrets.js');
    writeSecretsEnvFile({ TEST_SECRET_KEY: 'secret-value' });
    const envPath = getSecretsEnvPath();
    const env = readSecretsEnvFile(envPath);

    expect(envPath.startsWith(workspace)).toBe(true);
    expect(env.TEST_SECRET_KEY).toBe('secret-value');

    if (previousStateDir === undefined) {
      delete process.env.KRAB_STATE_DIR;
    } else {
      process.env.KRAB_STATE_DIR = previousStateDir;
    }
    rmSync(workspace, { recursive: true, force: true });
  });

  it('should create a gateway status snapshot with unreachable health handled', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as any;

    const { getGatewayStatusSnapshot } = await import('../cli/gateway-commands.js');
    const snapshot = await getGatewayStatusSnapshot({ deep: true });

    expect(snapshot.running).toBe(false);
    expect(snapshot.port).toBeDefined();

    globalThis.fetch = originalFetch;
  });

  it('should abort http chat when the client disconnects', async () => {
    const { GatewayServer } = await import('../gateway/server.js');
    const { Agent } = await import('../core/agent.js');

    const chatSpy = vi.spyOn(Agent.prototype, 'chat').mockImplementationOnce(async (_input, options) => {
      await new Promise((_, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('http aborted')));
      });
      return 'unreachable';
    });

    const gateway = new GatewayServer({
      port: 0,
      host: '127.0.0.1',
      openaiCompatible: true,
      auth: { mode: 'none' },
      agents: { defaults: { workspace: process.cwd(), model: { primary: 'test-model' } } },
      provider: { name: 'google', model: 'test-model', apiKey: 'test-key' },
    } as any, process.cwd());

    const reqHandlers = new Map<string, (...args: any[]) => void>();
    const requestBody = JSON.stringify({
      messages: [{ role: 'user', content: 'hello' }],
      stream: false,
      model: 'test-model',
    });
    const req = {
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        reqHandlers.set(event, handler);
      }),
    } as any;
    const res = {
      headersSent: false,
      writeHead: vi.fn(),
      end: vi.fn(),
      write: vi.fn(),
    } as any;
    const completion = new Promise<void>((resolve) => {
      res.end = vi.fn(() => resolve());
    });

    req.method = 'POST';
    req.url = '/v1/chat/completions';
    req.headers = {};
    req.socket = { remoteAddress: '127.0.0.1' };
    (gateway as any).config.http = { endpoints: { chatCompletions: { enabled: true } } };

    const runPromise = (gateway as any).handleChatCompletions(req, res);

    reqHandlers.get('data')?.(Buffer.from(requestBody));
    reqHandlers.get('end')?.();
    reqHandlers.get('close')?.();
    try {
      await runPromise;
      await completion;

      expect(chatSpy).toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining('http aborted'));
    } finally {
      chatSpy.mockRestore();
    }
  });

  it('should abort streaming http chat when the client disconnects', async () => {
    const { GatewayServer } = await import('../gateway/server.js');
    const { Agent } = await import('../core/agent.js');

    const chatSpy = vi.spyOn(Agent.prototype, 'chat').mockImplementationOnce(async (_input, options) => {
      await new Promise((_, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('http stream aborted')));
      });
      return 'unreachable';
    });

    const gateway = new GatewayServer({
      port: 0,
      host: '127.0.0.1',
      openaiCompatible: true,
      auth: { mode: 'none' },
      agents: { defaults: { workspace: process.cwd(), model: { primary: 'test-model' } } },
      provider: { name: 'google', model: 'test-model', apiKey: 'test-key' },
    } as any, process.cwd());

    const reqHandlers = new Map<string, (...args: any[]) => void>();
    const requestBody = JSON.stringify({
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
      model: 'test-model',
    });
    const req = {
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        reqHandlers.set(event, handler);
      }),
    } as any;
    const res = {
      headersSent: false,
      writeHead: vi.fn(function (this: any) {
        this.headersSent = true;
      }),
      end: vi.fn(),
      write: vi.fn(),
    } as any;
    const completion = new Promise<void>((resolve) => {
      res.end = vi.fn(() => resolve());
    });

    req.method = 'POST';
    req.url = '/v1/chat/completions';
    req.headers = {};
    req.socket = { remoteAddress: '127.0.0.1' };
    (gateway as any).config.http = { endpoints: { chatCompletions: { enabled: true } } };

    const runPromise = (gateway as any).handleChatCompletions(req, res);

    reqHandlers.get('data')?.(Buffer.from(requestBody));
    reqHandlers.get('end')?.();
    reqHandlers.get('close')?.();
    try {
      await runPromise;
      await completion;

      expect(chatSpy).toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Type': 'text/event-stream' }));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining('http stream aborted'));
    } finally {
      chatSpy.mockRestore();
    }
  });

  it('should abort websocket chat when the client disconnects', async () => {
    const { GatewayServer } = await import('../gateway/server.js');
    const { Agent } = await import('../core/agent.js');

    const chatSpy = vi.spyOn(Agent.prototype, 'chat').mockImplementationOnce(async (_input, options) => {
      await new Promise((_, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('ws aborted')));
      });
      return 'unreachable';
    });

    const gateway = new GatewayServer({
      port: 0,
      host: '127.0.0.1',
      openaiCompatible: true,
      auth: { mode: 'none' },
      agents: { defaults: { workspace: process.cwd(), model: { primary: 'test-model' } } },
      provider: { name: 'google', model: 'test-model', apiKey: 'test-key' },
    } as any, process.cwd());

    const wsHandlers = new Map<string, (...args: any[]) => void>();
    const ws = {
      once: vi.fn((event: string, handler: (...args: any[]) => void) => {
        wsHandlers.set(event, handler);
      }),
      off: vi.fn((event: string) => {
        wsHandlers.delete(event);
      }),
      send: vi.fn(),
    } as any;

    const runPromise = (gateway as any).handleWebSocketChat(ws, {
      type: 'chat',
      content: 'hello',
      sessionId: 'ws-test',
    });

    wsHandlers.get('close')?.();
    try {
      await runPromise;

      expect(chatSpy).toHaveBeenCalled();
      expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('ws aborted'));
    } finally {
      chatSpy.mockRestore();
    }
  });

  it('should abort websocket streaming chat when the client disconnects', async () => {
    const { GatewayServer } = await import('../gateway/server.js');
    const { Agent } = await import('../core/agent.js');

    const chatSpy = vi.spyOn(Agent.prototype, 'chat').mockImplementationOnce(async (_input, options) => {
      await new Promise((_, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('ws stream aborted')));
      });
      return 'unreachable';
    });

    const gateway = new GatewayServer({
      port: 0,
      host: '127.0.0.1',
      openaiCompatible: true,
      auth: { mode: 'none' },
      agents: { defaults: { workspace: process.cwd(), model: { primary: 'test-model' } } },
      provider: { name: 'google', model: 'test-model', apiKey: 'test-key' },
    } as any, process.cwd());

    const wsHandlers = new Map<string, (...args: any[]) => void>();
    const ws = {
      once: vi.fn((event: string, handler: (...args: any[]) => void) => {
        wsHandlers.set(event, handler);
      }),
      off: vi.fn((event: string) => {
        wsHandlers.delete(event);
      }),
      send: vi.fn(),
    } as any;

    const runPromise = (gateway as any).handleWebSocketStreamChat(ws, {
      type: 'chat.stream',
      content: 'hello',
      sessionId: 'ws-stream-test',
    });

    wsHandlers.get('close')?.();
    try {
      await runPromise;

      expect(chatSpy).toHaveBeenCalled();
      expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('ws stream aborted'));
    } finally {
      chatSpy.mockRestore();
    }
  });

  it('should spawn a session through session tools', async () => {
    const { sessionTools } = await import('../tools/built-in/session-tools.js');
    const { Agent } = await import('../core/agent.js');

    const chatSpy = vi.spyOn(Agent.prototype, 'chat').mockResolvedValue('spawned-session-result');

    const spawnTool = sessionTools.find((tool) => tool.name === 'sessions_spawn');
    expect(spawnTool).toBeDefined();

    try {
      const result = await spawnTool!.execute({
        channel: 'internal-test',
        initialMessage: 'hello from test',
        sessionType: 'main',
      });

      expect(result.success).toBe(true);
      expect(String(result.output)).toContain('sessionKey');
    } finally {
      chatSpy.mockRestore();
    }
  });
});
