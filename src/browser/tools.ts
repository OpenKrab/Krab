// ============================================================
// 🦀 Krab — Browser Tools
// ============================================================
import { BrowserSessionManager } from './session.js';
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';

export interface BrowserToolOptions {
  action: 'navigate' | 'click' | 'type' | 'scroll' | 'screenshot' | 'extract' | 'close';
  sessionId: string;
  url?: string;
  selector?: string;
  text?: string;
  direction?: 'up' | 'down';
  distance?: number;
  extractOptions?: {
    text?: boolean;
    html?: boolean;
    links?: boolean;
    images?: boolean;
    tables?: boolean;
  };
  fullPage?: boolean;
}

export class BrowserTools {
  private sessionManager: BrowserSessionManager;

  constructor() {
    this.sessionManager = new BrowserSessionManager();
  }

  async executeTool(options: BrowserToolOptions): Promise<ToolResult> {
    try {
      logger.info(`[BrowserTools] Executing: ${options.action} on session ${options.sessionId}`);

      switch (options.action) {
        case 'navigate':
          if (!options.url) {
            throw new Error('URL is required for navigate action');
          }
          await this.sessionManager.navigateTo(options.sessionId, options.url);
          break;

        case 'click':
          if (!options.selector) {
            throw new Error('Selector is required for click action');
          }
          await this.sessionManager.clickElement(options.sessionId, options.selector);
          break;

        case 'type':
          if (!options.selector || !options.text) {
            throw new Error('Selector and text are required for type action');
          }
          await this.sessionManager.typeText(options.sessionId, options.selector, options.text);
          break;

        case 'scroll':
          await this.sessionManager.scrollPage(
            options.sessionId, 
            options.direction || 'down', 
            options.distance || 300
          );
          break;

        case 'screenshot':
          const screenshotPath = await this.sessionManager.takeScreenshot(options.sessionId, {
            fullPage: options.fullPage,
            selector: options.selector
          });
          break;

        case 'extract':
          if (!options.extractOptions) {
            throw new Error('Extract options are required for extract action');
          }
          const content = await this.sessionManager.extractContent(options.sessionId, options.extractOptions);
          break;

        case 'close':
          await this.sessionManager.closeSession(options.sessionId);
          break;

        default:
          throw new Error(`Unknown browser action: ${options.action}`);
      }

      const result = {
        success: true,
        output: JSON.stringify({
          action: options.action,
          sessionId: options.sessionId,
          timestamp: new Date().toISOString(),
          ...(options.action === 'screenshot' && { screenshotPath: (await this.sessionManager.takeScreenshot(options.sessionId, {
            fullPage: options.fullPage,
            selector: options.selector
          })) }),
          ...(options.action === 'extract' && { content })
        }, null, 2)
      };

      logger.info(`[BrowserTools] Action completed: ${options.action}`);
      return result;

    } catch (error) {
      logger.error(`[BrowserTools] Action failed: ${options.action}`, error);
      return {
        success: false,
        output: "",
        error: `Browser action failed: ${(error as Error).message}`
      };
    }
  }

  async createSession(name: string, options: any = {}): Promise<string> {
    const session = await this.sessionManager.createSession(name, options);
    return session.id;
  }

  async listSessions(): Promise<ToolResult> {
    try {
      const sessions = this.sessionManager.getAllSessions();
      
      return {
        success: true,
        output: JSON.stringify({
          sessions: sessions.map(session => ({
            id: session.id,
            name: session.name,
            status: session.status,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            metadata: session.metadata
          })),
          totalSessions: sessions.length,
          activeSessions: sessions.filter(s => s.status === 'active').length
        }, null, 2)
      };

    } catch (error) {
      logger.error('[BrowserTools] Failed to list sessions:', error);
      return {
        success: false,
        output: "",
        error: `Failed to list sessions: ${(error as Error).message}`
      };
    }
  }

  async getSessionInfo(sessionId: string): Promise<ToolResult> {
    try {
      const session = this.sessionManager.getSession(sessionId);
      
      if (!session) {
        return {
          success: false,
          output: "",
          error: `Session not found: ${sessionId}`
        };
      }

      return {
        success: true,
        output: JSON.stringify({
          session: {
            id: session.id,
            name: session.name,
            status: session.status,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            metadata: session.metadata
          },
          pageUrl: session.page?.url(),
          pageTitle: await session.page?.title()
        }, null, 2)
      };

    } catch (error) {
      logger.error('[BrowserTools] Failed to get session info:', error);
      return {
        success: false,
        output: "",
        error: `Failed to get session info: ${(error as Error).message}`
      };
    }
  }
}

// ── Browser Automation Tool ───────────────────────────────────────
export const browserAutomationTool: Tool = {
  name: "browser_automation",
  description: "Browser automation tool with Playwright. Supports session management, navigation, clicking, typing, scrolling, screenshots, and content extraction.",
  parameters: z.object({
    action: z.enum(["navigate", "click", "type", "scroll", "screenshot", "extract", "close"]).describe("Browser action to perform"),
    sessionId: z.string().describe("Browser session ID"),
    url: z.string().optional().describe("URL for navigate action"),
    selector: z.string().optional().describe("CSS selector for click/type actions"),
    text: z.string().optional().describe("Text to type into element"),
    direction: z.enum(["up", "down"]).optional().describe("Scroll direction"),
    distance: z.number().optional().describe("Scroll distance in pixels"),
    extractOptions: z.object({
      text: z.boolean().optional().describe("Extract text content"),
      html: z.boolean().optional().describe("Extract HTML content"),
      links: z.boolean().optional().describe("Extract links"),
      images: z.boolean().optional().describe("Extract images"),
      tables: z.boolean().optional().describe("Extract tables")
    }).optional().describe("Content extraction options"),
    fullPage: z.boolean().optional().describe("Take full page screenshot")
  }),

  async execute(args: any): Promise<ToolResult> {
    const browserTools = new BrowserTools();
    return await browserTools.executeTool(args);
  },

  sideEffect: true,
  requireApproval: true
};

// ── Browser Session Manager Tool ───────────────────────────────
export const browserSessionTool: Tool = {
  name: "browser_session",
  description: "Browser session management tool. Create, list, and manage browser sessions.",
  parameters: z.object({
    action: z.enum(["create", "list", "info", "close"]).describe("Session management action"),
    name: z.string().optional().describe("Session name for create action"),
    sessionId: z.string().optional().describe("Session ID for info/close actions")
  }),

  async execute(args: any): Promise<ToolResult> {
    const browserTools = new BrowserTools();
    
    try {
      switch (args.action) {
        case 'create':
          const sessionId = await browserTools.createSession(args.name || 'default');
          return {
            success: true,
            output: JSON.stringify({
              sessionId,
              message: `Browser session '${args.name || 'default'}' created successfully`
            }, null, 2)
          };

        case 'list':
          return await browserTools.listSessions();

        case 'info':
          return await browserTools.getSessionInfo(args.sessionId);

        case 'close':
          await browserTools.sessionManager.closeSession(args.sessionId);
          return {
            success: true,
            output: JSON.stringify({
              sessionId: args.sessionId,
              message: `Browser session ${args.sessionId} closed successfully`
            }, null, 2)
          };

        default:
          throw new Error(`Unknown session action: ${args.action}`);
      }

    } catch (error) {
      logger.error('[BrowserSessionTool] Action failed:', error);
      return {
        success: false,
        output: "",
        error: `Session action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: true,
  requireApproval: true
};

// Factory function
export function createBrowserTools(): BrowserTools {
  return new BrowserTools();
}

// Export for dynamic loading
export default BrowserTools;
