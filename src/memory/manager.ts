// ============================================================
// 🦀 Krab — Memory Manager (Markdown-based long-term memory)
// ============================================================
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { logger } from "../utils/logger.js";

export interface MemoryEntry {
  content: string;
  timestamp: Date;
  type: "daily" | "longterm";
  file: string;
}

export class MemoryManager {
  private workspacePath: string;
  private memoryPath: string;

  constructor(workspacePath: string = path.join(os.homedir(), ".krab", "workspace")) {
    this.workspacePath = workspacePath;
    this.memoryPath = path.join(workspacePath, "memory");

    if (!fs.existsSync(this.memoryPath)) {
      fs.mkdirSync(this.memoryPath, { recursive: true });
    }
  }

  /**
   * Write to daily memory log
   */
  writeToDailyLog(content: string): void {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `${today}.md`;
    const filePath = path.join(this.memoryPath, filename);

    const entry = `${new Date().toISOString()}\n${content}\n\n---\n\n`;
    
    try {
      if (fs.existsSync(filePath)) {
        fs.appendFileSync(filePath, entry);
      } else {
        fs.writeFileSync(filePath, `# Daily Memory Log - ${today}\n\n${entry}`);
      }
      logger.debug(`[Memory] Wrote to daily log: ${filename}`);
    } catch (error) {
      logger.error(`[Memory] Failed to write daily log:`, error);
    }
  }

  /**
   * Write to long-term memory (MEMORY.md)
   */
  writeToLongTermMemory(content: string): void {
    const filePath = path.join(this.memoryPath, "MEMORY.md");
    
    const entry = `## ${new Date().toISOString()}\n${content}\n\n`;
    
    try {
      if (fs.existsSync(filePath)) {
        // Read existing content and append
        const existing = fs.readFileSync(filePath, "utf8");
        fs.writeFileSync(filePath, existing + entry);
      } else {
        fs.writeFileSync(filePath, `# Long-term Memory\n\n${entry}`);
      }
      logger.debug(`[Memory] Wrote to long-term memory: MEMORY.md`);
    } catch (error) {
      logger.error(`[Memory] Failed to write long-term memory:`, error);
    }
  }

  /**
   * Read daily memory (today and yesterday)
   */
  readDailyMemory(): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const files = [
      `${today.toISOString().split('T')[0]}.md`,
      `${yesterday.toISOString().split('T')[0]}.md`
    ];

    let content = "";
    for (const file of files) {
      const filePath = path.join(this.memoryPath, file);
      if (fs.existsSync(filePath)) {
        try {
          content += fs.readFileSync(filePath, "utf8") + "\n\n";
        } catch (error) {
          logger.warn(`[Memory] Failed to read daily memory file: ${file}`);
        }
      }
    }

    return content.trim();
  }

  /**
   * Read long-term memory (only for main sessions)
   */
  readLongTermMemory(): string {
    const filePath = path.join(this.memoryPath, "MEMORY.md");
    
    if (!fs.existsSync(filePath)) {
      return "";
    }

    try {
      return fs.readFileSync(filePath, "utf8");
    } catch (error) {
      logger.warn(`[Memory] Failed to read long-term memory`);
      return "";
    }
  }

  /**
   * Read specific memory file
   */
  readMemoryFile(filename: string): string {
    const filePath = path.join(this.memoryPath, filename);
    
    if (!fs.existsSync(filePath)) {
      return "";
    }

    try {
      return fs.readFileSync(filePath, "utf8");
    } catch (error) {
      logger.warn(`[Memory] Failed to read memory file: ${filename}`);
      return "";
    }
  }

  /**
   * List all memory files
   */
  listMemoryFiles(): string[] {
    try {
      return fs.readdirSync(this.memoryPath)
        .filter(file => file.endsWith('.md'))
        .sort();
    } catch (error) {
      logger.warn(`[Memory] Failed to list memory files`);
      return [];
    }
  }

  /**
   * Get memory files with metadata
   */
  getMemoryFiles(): MemoryEntry[] {
    const files = this.listMemoryFiles();
    const entries: MemoryEntry[] = [];

    for (const file of files) {
      const filePath = path.join(this.memoryPath, file);
      try {
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, "utf8");
        
        entries.push({
          content,
          timestamp: stats.mtime,
          type: file === "MEMORY.md" ? "longterm" : "daily",
          file
        });
      } catch (error) {
        logger.warn(`[Memory] Failed to read memory file metadata: ${file}`);
      }
    }

    return entries;
  }

  /**
   * Search memory files for content
   */
  searchMemory(query: string): MemoryEntry[] {
    const entries = this.getMemoryFiles();
    const results: MemoryEntry[] = [];

    const queryLower = query.toLowerCase();

    for (const entry of entries) {
      if (entry.content.toLowerCase().includes(queryLower)) {
        results.push(entry);
      }
    }

    return results;
  }
}

// Export singleton instance
export const memoryManager = new MemoryManager();
