// ============================================================
// 🦀 Krab — Built-in Tool: Shell (Safe Command Execution)
// ============================================================
import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition } from "../../core/types.js";

const execAsync = promisify(exec);

const BLOCKED_COMMANDS = [
  "rm -rf /",
  "format",
  "del /s /q",
  "mkfs",
  ":(){:|:&};:",
];

export const shellTool: ToolDefinition = {
  name: "shell",
  description:
    "Execute a shell command on the local system. Use for checking files, running scripts, git operations, etc. Dangerous commands require user approval.",
  parameters: z.object({
    command: z.string().describe("The shell command to execute"),
    cwd: z
      .string()
      .optional()
      .describe("Working directory (defaults to current)"),
    timeout: z
      .number()
      .optional()
      .default(30000)
      .describe("Timeout in milliseconds"),
  }),
  sideEffect: true,
  requireApproval: true,
  execute: async (args) => {
    const { command, cwd, timeout } = args;

    // Block dangerous commands
    const lowerCmd = command.toLowerCase().trim();
    for (const blocked of BLOCKED_COMMANDS) {
      if (lowerCmd.includes(blocked)) {
        return {
          success: false,
          output: "",
          error: `Blocked dangerous command: "${command}"`,
        };
      }
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd || process.cwd(),
        timeout: timeout || 30000,
        maxBuffer: 1024 * 1024, // 1MB
      });

      const output = stdout || stderr || "(no output)";
      return {
        success: true,
        output: output.slice(0, 5000), // Cap output at 5KB
      };
    } catch (err: any) {
      return {
        success: false,
        output: err.stdout?.slice(0, 2000) || "",
        error: err.message?.slice(0, 500) || "Command failed",
      };
    }
  },
};
