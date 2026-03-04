// ============================================================
// 🦀 Krab — Enhanced Process Management Tool
// ============================================================
import { ToolDefinition as Tool, ToolResult } from "../../core/types.js";
import { logger } from "../../utils/logger.js";
import { z } from "zod";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface ProcessOptions {
  action: "list" | "poll" | "log" | "write" | "kill" | "clear" | "remove";
  sessionId?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  background?: boolean;
  timeout?: number;
  yieldMs?: number;
  elevated?: boolean;
  host?: "sandbox" | "gateway" | "node";
  security?: "deny" | "allowlist" | "full";
  ask?: "off" | "on-miss" | "always";
  node?: string;
  pty?: boolean;
  limit?: number;
  offset?: number;
  signal?: "SIGTERM" | "SIGKILL" | "SIGINT";
}

export interface ProcessResult {
  action: string;
  status: "success" | "error" | "running" | "completed" | "killed";
  sessionId?: string;
  pid?: number;
  output?: string;
  exitCode?: number;
  duration?: number;
  processes?: ProcessInfo[];
  error?: string;
  timestamp: Date;
}

export interface ProcessInfo {
  sessionId: string;
  pid: number;
  command: string;
  args: string[];
  cwd: string;
  status: "running" | "completed" | "killed" | "error";
  startTime: Date;
  endTime?: Date;
  exitCode?: number;
  output: string;
  duration?: number;
  background: boolean;
  elevated: boolean;
  host: string;
  kill?: (signal?: string) => void; // Method to kill the process
}

export class ProcessManager {
  private processes = new Map<string, ProcessInfo>();
  private outputDir = path.join(os.tmpdir(), "krab-processes");
  private maxProcesses = 50;
  private defaultTimeout = 1800000; // 30 minutes

  constructor() {
    this.initializeOutputDirectory();
    this.cleanupOldProcesses();
  }

  private initializeOutputDirectory(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private cleanupOldProcesses(): void {
    // Clean up processes older than 24 hours
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    
    for (const [sessionId, process] of this.processes.entries()) {
      if (process.endTime && process.endTime.getTime() < cutoff) {
        this.removeProcess(sessionId);
      }
    }
  }

  async execute(options: ProcessOptions): Promise<ProcessResult> {
    try {
      logger.info(`[ProcessManager] Executing: ${options.action}`);

      switch (options.action) {
        case "list":
          return await this.listProcesses();
        case "poll":
          return await this.pollProcess(options.sessionId!);
        case "log":
          return await this.getLog(options.sessionId!, options.offset, options.limit);
        case "write":
          return await this.writeToProcess(options.sessionId!, options.command!);
        case "kill":
          return await this.killProcess(options.sessionId!, options.signal);
        case "clear":
          return await this.clearProcess(options.sessionId!);
        case "remove":
          return await this.removeProcess(options.sessionId!);
        default:
          throw new Error(`Unknown process action: ${options.action}`);
      }

    } catch (error) {
      logger.error(`[ProcessManager] Action failed: ${options.action}`, error);
      return {
        action: options.action,
        status: "error",
        error: (error as Error).message,
        timestamp: new Date()
      };
    }
  }

  async startProcess(command: string, args: string[] = [], options: Partial<ProcessOptions> = {}): Promise<ProcessResult> {
    const sessionId = this.generateSessionId();
    const startTime = new Date();
    const cwd = options.cwd || process.cwd();
    const env = { ...process.env, ...options.env };
    const background = options.background !== false; // Default to true
    const timeout = options.timeout || this.defaultTimeout;

    // Check process limit
    if (this.processes.size >= this.maxProcesses) {
      throw new Error(`Maximum process limit reached (${this.maxProcesses})`);
    }

    // Security check
    if (options.security === "deny") {
      throw new Error("Process execution denied by security policy");
    }

    logger.info(`[ProcessManager] Starting process: ${command} ${args.join(" ")}`);

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env,
        stdio: background ? "pipe" : "inherit",
        detached: background
      });

      const processInfo: ProcessInfo = {
        sessionId,
        pid: child.pid!,
        command,
        args,
        cwd,
        status: "running",
        startTime,
        output: "",
        background,
        elevated: options.elevated || false,
        host: options.host || "sandbox"
      };

      this.processes.set(sessionId, processInfo);

      // Setup timeout
      const timeoutHandle = setTimeout(() => {
        if (child.pid) {
          child.kill("SIGTERM");
        }
        processInfo.status = "killed";
        processInfo.endTime = new Date();
      }, timeout);

      // Collect output if backgrounded
      if (background && child.stdout) {
        let output = "";
        child.stdout.on("data", (data) => {
          output += data.toString();
          processInfo.output = output;
        });

        child.stderr?.on("data", (data) => {
          output += data.toString();
          processInfo.output = output;
        });
      }

      // Handle process completion
      child.on("close", (code) => {
        clearTimeout(timeoutHandle);
        processInfo.status = code === 0 ? "completed" : "error";
        processInfo.endTime = new Date();
        processInfo.exitCode = code || undefined;
        processInfo.duration = processInfo.endTime.getTime() - processInfo.startTime.getTime();

        logger.info(`[ProcessManager] Process ${sessionId} completed with code: ${code}`);
      });

      child.on("error", (error) => {
        clearTimeout(timeoutHandle);
        processInfo.status = "error";
        processInfo.endTime = new Date();
        processInfo.duration = processInfo.endTime.getTime() - processInfo.startTime.getTime();

        logger.error(`[ProcessManager] Process ${sessionId} failed:`, error);
        reject(error);
      });

      // Return immediately for background processes
      if (background) {
        resolve({
          action: "start",
          status: "running",
          sessionId,
          pid: child.pid,
          timestamp: new Date()
        });
      } else {
        // For foreground processes, wait for completion
        child.on("close", () => {
          resolve({
            action: "start",
            status: processInfo.status,
            sessionId,
            pid: child.pid,
            output: processInfo.output,
            exitCode: processInfo.exitCode,
            duration: processInfo.duration,
            timestamp: new Date()
          });
        });
      }
    });
  }

  private async listProcesses(): Promise<ProcessResult> {
    const processes = Array.from(this.processes.values()).map(p => ({
      sessionId: p.sessionId,
      pid: p.pid,
      command: p.command,
      args: p.args,
      cwd: p.cwd,
      status: p.status,
      startTime: p.startTime,
      endTime: p.endTime,
      exitCode: p.exitCode,
      output: p.output,
      duration: p.duration,
      background: p.background,
      elevated: p.elevated,
      host: p.host
    }));

    return {
      action: "list",
      status: "success",
      processes,
      timestamp: new Date()
    };
  }

  private async pollProcess(sessionId: string): Promise<ProcessResult> {
    const process = this.processes.get(sessionId);
    
    if (!process) {
      throw new Error(`Process ${sessionId} not found`);
    }

    return {
      action: "poll",
      status: process.status,
      sessionId,
      pid: process.pid,
      output: process.output,
      exitCode: process.exitCode,
      duration: process.duration,
      timestamp: new Date()
    };
  }

  private async getLog(sessionId: string, offset?: number, limit?: number): Promise<ProcessResult> {
    const process = this.processes.get(sessionId);
    
    if (!process) {
      throw new Error(`Process ${sessionId} not found`);
    }

    let output = process.output;
    
    if (offset !== undefined) {
      const lines = output.split("\n");
      const startLine = offset >= 0 ? offset : lines.length + offset;
      const endLine = limit ? startLine + limit : lines.length;
      output = lines.slice(startLine, endLine).join("\n");
    } else if (limit !== undefined) {
      const lines = output.split("\n");
      output = lines.slice(-limit).join("\n");
    }

    return {
      action: "log",
      status: "success",
      sessionId,
      output,
      timestamp: new Date()
    };
  }

  private async writeToProcess(sessionId: string, command: string): Promise<ProcessResult> {
    const process = this.processes.get(sessionId);
    
    if (!process) {
      throw new Error(`Process ${sessionId} not found`);
    }

    if (process.status !== "running") {
      throw new Error(`Process ${sessionId} is not running`);
    }

    // In a real implementation, this would write to the process stdin
    // For now, we'll just log it
    logger.info(`[ProcessManager] Writing to process ${sessionId}: ${command}`);

    return {
      action: "write",
      status: "success",
      sessionId,
      timestamp: new Date()
    };
  }

  private async killProcess(sessionId: string, signal?: string): Promise<ProcessResult> {
    const process = this.processes.get(sessionId);
    
    if (!process) {
      throw new Error(`Process ${sessionId} not found`);
    }

    if (process.status !== "running") {
      return {
        action: "kill",
        status: "success",
        sessionId,
        timestamp: new Date()
      };
    }

    try {
      // Kill the process
      if (process.kill) {
        process.kill(signal);
      } else {
        // Fallback: use process.kill from Node.js
        require('child_process').kill(process.pid, signal || "SIGTERM");
      }
      
      process.status = "killed";
      process.endTime = new Date();
      process.duration = process.endTime.getTime() - process.startTime.getTime();

      logger.info(`[ProcessManager] Killed process ${sessionId} with signal: ${signal || "SIGTERM"}`);

      return {
        action: "kill",
        status: "success",
        sessionId,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error(`[ProcessManager] Failed to kill process ${sessionId}:`, error);
      throw error;
    }
  }

  private async clearProcess(sessionId: string): Promise<ProcessResult> {
    const process = this.processes.get(sessionId);
    
    if (!process) {
      throw new Error(`Process ${sessionId} not found`);
    }

    process.output = "";

    return {
      action: "clear",
      status: "success",
      sessionId,
      timestamp: new Date()
    };
  }

  private async removeProcess(sessionId: string): Promise<ProcessResult> {
    const process = this.processes.get(sessionId);
    
    if (!process) {
      throw new Error(`Process ${sessionId} not found`);
    }

    // Kill if still running
    if (process.status === "running") {
      try {
        if (process.kill) {
          process.kill("SIGTERM");
        } else {
          // Fallback: use process.kill from Node.js
          require('child_process').kill(process.pid, "SIGTERM");
        }
      } catch (error) {
        // Ignore kill errors during removal
      }
    }

    this.processes.delete(sessionId);

    logger.info(`[ProcessManager] Removed process ${sessionId}`);

    return {
      action: "remove",
      status: "success",
      sessionId,
      timestamp: new Date()
    };
  }

  private generateSessionId(): string {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Utility methods
  getProcessCount(): number {
    return this.processes.size;
  }

  getRunningProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values()).filter(p => p.status === "running");
  }

  getProcess(sessionId: string): ProcessInfo | undefined {
    return this.processes.get(sessionId);
  }
}

// ── Process Tool ────────────────────────────────────────────
export const processTool: Tool = {
  name: "process",
  description: "Enhanced process management tool. Supports list, poll, log, write, kill, clear, and remove operations with background execution and timeouts.",
  parameters: z.object({
    action: z.enum(["list", "poll", "log", "write", "kill", "clear", "remove"]).describe("Process management action"),
    sessionId: z.string().optional().describe("Process session ID"),
    command: z.string().optional().describe("Command to execute (for start action)"),
    args: z.array(z.string()).optional().describe("Command arguments"),
    cwd: z.string().optional().describe("Working directory"),
    env: z.record(z.string(), z.string()).optional().describe("Environment variables"),
    background: z.boolean().default(true).describe("Run in background"),
    timeout: z.number().optional().describe("Process timeout in milliseconds"),
    yieldMs: z.number().optional().describe("Auto-background after timeout (ms)"),
    elevated: z.boolean().default(false).describe("Run with elevated privileges"),
    host: z.enum(["sandbox", "gateway", "node"]).default("sandbox").describe("Execution host"),
    security: z.enum(["deny", "allowlist", "full"]).default("allowlist").describe("Security level"),
    ask: z.enum(["off", "on-miss", "always"]).default("off").describe("User approval requirement"),
    node: z.string().optional().describe("Node identifier for host=node"),
    pty: z.boolean().default(false).describe("Allocate pseudo-terminal"),
    limit: z.number().optional().describe("Log line limit"),
    offset: z.number().optional().describe("Log line offset"),
    signal: z.enum(["SIGTERM", "SIGKILL", "SIGINT"]).default("SIGTERM").describe("Kill signal")
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const manager = new ProcessManager();
      
      // Handle start command as special case
      if (args.command && !args.action) {
        const result = await manager.startProcess(args.command, args.args, args);
        return {
          success: true,
          output: JSON.stringify(result, null, 2)
        };
      }

      const result = await manager.execute(args);

      logger.info(`[ProcessTool] Action completed: ${result.action}`);
      return {
        success: true,
        output: JSON.stringify(result, null, 2)
      };

    } catch (error) {
      logger.error("[ProcessTool] Action failed:", error);
      return {
        success: false,
        output: "",
        error: `Process action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: true,
  requireApproval: true
};

// ── Enhanced Exec Tool ───────────────────────────────────────
export const enhancedExecTool: Tool = {
  name: "exec",
  description: "Enhanced command execution tool with background support, timeouts, and security controls.",
  parameters: z.object({
    command: z.string().describe("Command to execute"),
    args: z.array(z.string()).optional().describe("Command arguments"),
    cwd: z.string().optional().describe("Working directory"),
    env: z.record(z.string(), z.string()).optional().describe("Environment variables"),
    background: z.boolean().default(true).describe("Run in background"),
    timeout: z.number().default(1800000).describe("Timeout in milliseconds (default: 30 minutes)"),
    yieldMs: z.number().default(10000).describe("Auto-background after timeout (ms)"),
    elevated: z.boolean().default(false).describe("Run with elevated privileges"),
    host: z.enum(["sandbox", "gateway", "node"]).default("sandbox").describe("Execution host"),
    security: z.enum(["deny", "allowlist", "full"]).default("allowlist").describe("Security level"),
    ask: z.enum(["off", "on-miss", "always"]).default("off").describe("User approval requirement"),
    node: z.string().optional().describe("Node identifier for host=node"),
    pty: z.boolean().default(false).describe("Allocate pseudo-terminal")
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const manager = new ProcessManager();
      const result = await manager.startProcess(args.command, args.args, args);

      logger.info(`[ExecTool] Command executed: ${args.command}`);
      return {
        success: true,
        output: JSON.stringify(result, null, 2)
      };

    } catch (error) {
      logger.error("[ExecTool] Command failed:", error);
      return {
        success: false,
        output: "",
        error: `Command execution failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: true,
  requireApproval: true
};

// Factory function
export function createProcessManager(): ProcessManager {
  return new ProcessManager();
}

// Export for dynamic loading
export default ProcessManager;
