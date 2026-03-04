// ============================================================
// 🦀 Krab — Computer Tools
// ============================================================
import { ComputerInterface } from './interface.js';
import { ComputerVision, computerVisionTool } from './vision.js';
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';

export interface ComputerToolOptions {
  action: 'screenshot' | 'mouse' | 'keyboard' | 'windows' | 'activate_window';
  screenshotOptions?: {
    action: 'capture' | 'region';
    region?: { x: number; y: number; width: number; height: number };
    format?: 'png' | 'jpg';
  };
  mouseOptions?: {
    action: 'click' | 'move' | 'drag' | 'scroll' | 'double_click' | 'right_click';
    x?: number;
    y?: number;
    button?: 'left' | 'right' | 'middle';
  };
  keyboardOptions?: {
    action: 'type' | 'key' | 'shortcut';
    text?: string;
    key?: string;
    modifiers?: string[];
  };
  windowOptions?: {
    action: 'list' | 'activate' | 'close' | 'minimize' | 'maximize';
    title?: string;
    id?: number;
  };
}

export class ComputerTools {
  private computerInterface: ComputerInterface;
  private computerVision: ComputerVision;

  constructor() {
    this.computerInterface = new ComputerInterface();
    this.computerVision = new ComputerVision();
  }

  async executeTool(options: ComputerToolOptions): Promise<ToolResult> {
    try {
      logger.info(`[ComputerTools] Executing: ${options.action}`);

      switch (options.action) {
        case 'screenshot':
          if (!options.screenshotOptions) {
            throw new Error('Screenshot options are required');
          }
          const screenshotPath = await this.computerInterface.takeScreenshot(options.screenshotOptions);
          break;

        case 'mouse':
          if (!options.mouseOptions) {
            throw new Error('Mouse options are required');
          }
          await this.computerInterface.performMouseAction(options.mouseOptions);
          break;

        case 'keyboard':
          if (!options.keyboardOptions) {
            throw new Error('Keyboard options are required');
          }
          await this.computerInterface.performKeyboardAction(options.keyboardOptions);
          break;

        case 'windows':
          if (!options.windowOptions) {
            throw new Error('Window options are required');
          }
          if (options.windowOptions.action === 'list') {
            const windows = await this.computerInterface.listWindows();
            break;
          } else {
            // Handle other window actions
            break;
          }

        case 'activate_window':
          if (!options.windowOptions?.title && !options.windowOptions?.id) {
            throw new Error('Window title or ID is required for activate_window action');
          }
          const windowId = options.windowOptions.id || options.windowOptions.title;
          await this.computerInterface.activateWindow(windowId);
          break;

        default:
          throw new Error(`Unknown computer action: ${options.action}`);
      }

      const result = {
        success: true,
        output: JSON.stringify({
          action: options.action,
          timestamp: new Date().toISOString(),
          ...(options.action === 'screenshot' && { 
            screenshotPath: await this.computerInterface.takeScreenshot(options.screenshotOptions) 
          }),
          ...(options.action === 'windows' && options.windowOptions?.action === 'list' && { 
            windows: await this.computerInterface.listWindows() 
          })
        }, null, 2)
      };

      logger.info(`[ComputerTools] Action completed: ${options.action}`);
      return result;

    } catch (error) {
      logger.error(`[ComputerTools] Action failed: ${options.action}`, error);
      return {
        success: false,
        output: "",
        error: `Computer action failed: ${(error as Error).message}`
      };
    }
  }

  async getSystemInfo(): Promise<ToolResult> {
    try {
      const os = await import('os');
      const windows = await this.computerInterface.listWindows();
      
      const systemInfo = {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        cpus: os.cpus(),
        networkInterfaces: os.networkInterfaces(),
        windows: windows,
        timestamp: new Date().toISOString()
      };

      return {
        success: true,
        output: JSON.stringify(systemInfo, null, 2)
      };

    } catch (error) {
      logger.error('[ComputerTools] System info failed:', error);
      return {
        success: false,
        output: "",
        error: `System info failed: ${(error as Error).message}`
      };
    }
  }

  async getActiveWindow(): Promise<ToolResult> {
    try {
      // This would require platform-specific implementation
      // For now, return a placeholder
      const activeWindow = {
        title: "Active Window",
        process: "process.exe",
        id: 12345,
        timestamp: new Date().toISOString()
      };

      return {
        success: true,
        output: JSON.stringify(activeWindow, null, 2)
      };

    } catch (error) {
      logger.error('[ComputerTools] Active window failed:', error);
      return {
        success: false,
        output: "",
        error: `Active window failed: ${(error as Error).message}`
      };
    }
  }
}

// ── Computer Control Tool ───────────────────────────────────────
export const computerControlTool: Tool = {
  name: "computer_control",
  description: "Computer control tool for desktop automation. Control mouse, keyboard, take screenshots, manage windows, and interact with the desktop.",
  parameters: z.object({
    action: z.enum(["screenshot", "mouse", "keyboard", "windows", "activate_window"]).describe("Computer action to perform"),
    screenshotOptions: z.object({
      action: z.enum(["capture", "region"]).optional().describe("Screenshot action"),
      region: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional().describe("Screenshot region"),
      format: z.enum(["png", "jpg"]).optional().describe("Screenshot format")
    }).optional().describe("Screenshot options"),
    mouseOptions: z.object({
      action: z.enum(["click", "move", "drag", "scroll", "double_click", "right_click"]).describe("Mouse action"),
      x: z.number().optional().describe("Mouse X coordinate"),
      y: z.number().optional().describe("Mouse Y coordinate"),
      button: z.enum(["left", "right", "middle"]).optional().describe("Mouse button")
    }).optional().describe("Mouse options"),
    keyboardOptions: z.object({
      action: z.enum(["type", "key", "shortcut"]).describe("Keyboard action"),
      text: z.string().optional().describe("Text to type"),
      key: z.string().optional().describe("Key to press"),
      modifiers: z.array(z.string()).optional().describe("Modifier keys for shortcut")
    }).optional().describe("Keyboard options"),
    windowOptions: z.object({
      action: z.enum(["list", "activate", "close", "minimize", "maximize"]).describe("Window action"),
      title: z.string().optional().describe("Window title"),
      id: z.number().optional().describe("Window ID")
    }).optional().describe("Window options")
  }),

  async execute(args: any): Promise<ToolResult> {
    const computerTools = new ComputerTools();
    return await computerTools.executeTool(args);
  },

  sideEffect: true,
  requireApproval: true
};

// ── System Info Tool ───────────────────────────────────────────
export const systemInfoTool: Tool = {
  name: "system_info",
  description: "Get comprehensive system information including OS, hardware, and active windows.",
  parameters: z.object({
    action: z.enum(["system", "active_window", "processes"]).describe("Information type to retrieve")
  }),

  async execute(args: any): Promise<ToolResult> {
    const computerTools = new ComputerTools();
    
    try {
      switch (args.action) {
        case 'system':
          return await computerTools.getSystemInfo();
        case 'active_window':
          return await computerTools.getActiveWindow();
        case 'processes':
          // This would require process listing implementation
          return {
            success: true,
            output: JSON.stringify({
              message: "Process listing not implemented yet",
              processes: []
            }, null, 2)
          };
        default:
          throw new Error(`Unknown system info action: ${args.action}`);
      }

    } catch (error) {
      logger.error('[SystemInfoTool] Action failed:', error);
      return {
        success: false,
        output: "",
        error: `System info action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// Factory function
export function createComputerTools(): ComputerTools {
  return new ComputerTools();
}

// Export for dynamic loading
export default ComputerTools;
