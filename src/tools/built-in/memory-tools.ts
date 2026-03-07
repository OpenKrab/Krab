// ============================================================
// 🦀 Krab — Memory Tools
// ============================================================
import { z } from "zod";
import { memoryManager } from "../../memory/manager.js";
import type { ToolDefinition } from "../../core/types.js";

const memorySearchTool: ToolDefinition = {
  name: "memory_search",
  description: "Search through memory files for relevant information",
  parameters: z.object({
    query: z.string(),
    limit: z.number().min(1).max(50).default(10),
  }),
  execute: async (args) => {
    const { query, limit } = args;

    try {
      const results = memoryManager.searchMemory(query);
      const limitedResults = results.slice(0, limit);

      const formatted = limitedResults.map(entry => ({
        file: entry.file,
        type: entry.type,
        timestamp: entry.timestamp.toISOString(),
        content: entry.content.length > 500 
          ? entry.content.substring(0, 500) + "..."
          : entry.content
      }));

      return {
        success: true,
        output: JSON.stringify({
          query,
          results: formatted,
          total: results.length,
          limited: limitedResults.length
        }, null, 2)
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Memory search failed: ${error}`
      };
    }
  }
};

const memoryGetTool: ToolDefinition = {
  name: "memory_get",
  description: "Read a specific memory file or line range",
  parameters: z.object({
    path: z.string(),
    startLine: z.number().min(1).optional(),
    endLine: z.number().min(1).optional(),
  }),
  execute: async (args) => {
    const { path, startLine, endLine } = args;

    try {
      const content = memoryManager.readMemoryFile(path);
      
      if (!content) {
        return {
          success: false,
          output: "",
          error: `Memory file not found: ${path}`
        };
      }

      let result = content;

      // Extract line range if specified
      if (startLine !== undefined) {
        const lines = content.split('\n');
        const start = startLine - 1; // Convert to 0-based
        const end = endLine ? Math.min(endLine, lines.length) : lines.length;
        
        if (start >= lines.length) {
          return {
            success: false,
            output: "",
            error: `Start line ${startLine} is beyond file length`
          };
        }

        result = lines.slice(start, end).join('\n');
      }

      return {
        success: true,
        output: JSON.stringify({
          path,
          content: result,
          lineRange: startLine ? { start: startLine, end: endLine || 'end' } : null
        }, null, 2)
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Memory read failed: ${error}`
      };
    }
  }
};

const memoryWriteTool: ToolDefinition = {
  name: "memory_write",
  description: "Write information to memory (daily log or long-term memory)",
  parameters: z.object({
    content: z.string(),
    type: z.enum(["daily", "longterm"]).default("daily"),
  }),
  execute: async (args) => {
    const { content, type } = args;

    try {
      if (type === "longterm") {
        memoryManager.writeToLongTermMemory(content);
      } else {
        memoryManager.writeToDailyLog(content);
      }

      return {
        success: true,
        output: JSON.stringify({
          type,
          content,
          timestamp: new Date().toISOString()
        }, null, 2)
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Memory write failed: ${error}`
      };
    }
  }
};

const memoryListTool: ToolDefinition = {
  name: "memory_list",
  description: "List all memory files with metadata",
  parameters: z.object({}),
  execute: async () => {
    try {
      const files = memoryManager.getMemoryFiles();
      
      const formatted = files.map(entry => ({
        file: entry.file,
        type: entry.type,
        timestamp: entry.timestamp.toISOString(),
        size: entry.content.length,
        preview: entry.content.substring(0, 100) + (entry.content.length > 100 ? "..." : "")
      }));

      return {
        success: true,
        output: JSON.stringify({
          files: formatted,
          total: files.length
        }, null, 2)
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Memory list failed: ${error}`
      };
    }
  }
};

// Export all memory tools
export const memoryTools = [
  memorySearchTool,
  memoryGetTool,
  memoryWriteTool,
  memoryListTool
];
