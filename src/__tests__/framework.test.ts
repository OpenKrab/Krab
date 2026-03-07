// ============================================================
// 🦀 Krab — Basic Functionality Tests
// ============================================================
import { describe, it, expect, vi } from 'vitest';

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
});
