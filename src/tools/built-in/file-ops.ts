// ============================================================
// 🦀 Krab — Built-in Tool: File Operations
// ============================================================
import { z } from "zod";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { ToolDefinition } from "../../core/types.js";

export const fileReadTool: ToolDefinition = {
  name: "file_read",
  description:
    "Read the contents of a file. Returns the text content of the file.",
  parameters: z.object({
    path: z.string().describe("Absolute or relative path to the file"),
    maxLines: z
      .number()
      .optional()
      .default(200)
      .describe("Maximum lines to return"),
  }),
  sideEffect: false,
  requireApproval: false,
  execute: async (args) => {
    try {
      const fullPath = resolve(args.path);
      const content = await readFile(fullPath, "utf-8");
      const lines = content.split("\n");
      const truncated = lines.slice(0, args.maxLines).join("\n");
      const output =
        lines.length > args.maxLines
          ? `${truncated}\n\n... (truncated, ${lines.length} total lines)`
          : truncated;
      return { success: true, output };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
};

export const fileWriteTool: ToolDefinition = {
  name: "file_write",
  description:
    "Write content to a file. Creates the file if it does not exist, overwrites if it does.",
  parameters: z.object({
    path: z.string().describe("Path to the file"),
    content: z.string().describe("Content to write"),
  }),
  sideEffect: true,
  requireApproval: true,
  execute: async (args) => {
    try {
      const fullPath = resolve(args.path);
      await writeFile(fullPath, args.content, "utf-8");
      return {
        success: true,
        output: `Written ${args.content.length} chars to ${fullPath}`,
      };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
};

export const fileListTool: ToolDefinition = {
  name: "file_list",
  description: "List files and directories in a given path.",
  parameters: z.object({
    path: z.string().optional().default(".").describe("Directory path"),
  }),
  sideEffect: false,
  requireApproval: false,
  execute: async (args) => {
    try {
      const fullPath = resolve(args.path);
      const entries = await readdir(fullPath, { withFileTypes: true });
      const items = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "dir" : "file",
      }));
      return { success: true, output: JSON.stringify(items, null, 2) };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
};
