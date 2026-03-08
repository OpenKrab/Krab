// ============================================================
// 🦀 Krab — Memory Manager (Markdown-based long-term memory)
// ============================================================
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ConversationMemory, type ConversationSemanticHit } from "./conversation-enhanced.js";
import { logger } from "../utils/logger.js";

export interface MemoryEntry {
  content: string;
  timestamp: Date;
  type: "daily" | "longterm";
  file: string;
}

export interface MemorySearchResult extends MemoryEntry {
  score: number;
  matchCount: number;
  preview: string;
}

export interface HybridMemoryResult {
  source: "memory_file" | "conversation" | "semantic_conversation";
  id: string;
  score: number;
  preview: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryStatus {
  workspaceDir: string;
  memoryDir: string;
  files: number;
  conversations: number;
  vectorEntries: number;
  vectorConversations: number;
  semanticAvailable: boolean;
}

interface StoredConversationRecord {
  messages?: Array<{ content?: string }>;
  metadata?: {
    id?: string;
    updatedAt?: string;
    messageCount?: number;
  };
  summary?: string;
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

  searchMemoryRanked(query: string, limit = 10): MemorySearchResult[] {
    const entries = this.getMemoryFiles();
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) {
      return [];
    }

    const terms = trimmedQuery.split(/\s+/).filter(Boolean);
    const now = Date.now();

    const scored = entries
      .map((entry) => {
        const contentLower = entry.content.toLowerCase();
        let matchCount = 0;

        for (const term of terms) {
          const matches = contentLower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
          matchCount += matches?.length || 0;
        }

        if (matchCount === 0 && !contentLower.includes(trimmedQuery)) {
          return null;
        }

        const exactBonus = contentLower.includes(trimmedQuery) ? 5 : 0;
        const ageHours = Math.max(1, (now - entry.timestamp.getTime()) / (1000 * 60 * 60));
        const recencyBonus = Math.max(0, 8 - Math.log2(ageHours));
        const score = matchCount * 3 + exactBonus + recencyBonus;
        const preview = entry.content.length > 240 ? entry.content.slice(0, 240) + "..." : entry.content;

        return {
          ...entry,
          score: Math.round(score * 100) / 100,
          matchCount,
          preview,
        } satisfies MemorySearchResult;
      })
      .filter((entry): entry is MemorySearchResult => entry !== null)
      .sort((a, b) => b.score - a.score || b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return scored;
  }

  private searchStoredConversations(query: string): Array<{
    id: string;
    updatedAt: string;
    messageCount: number;
    summary?: string;
    text: string;
  }> {
    const lowerQuery = query.trim().toLowerCase();
    const conversationsDir = path.join(this.workspacePath, "conversations");
    if (!lowerQuery || !fs.existsSync(conversationsDir)) {
      return [];
    }

    const hits: Array<{
      id: string;
      updatedAt: string;
      messageCount: number;
      summary?: string;
      text: string;
    }> = [];

    for (const file of fs.readdirSync(conversationsDir).filter((entry) => entry.endsWith(".json"))) {
      const filePath = path.join(conversationsDir, file);
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const conversation = JSON.parse(raw) as StoredConversationRecord;
        const text = [
          ...(conversation.messages || []).map((message) => message.content || ""),
          conversation.summary || "",
        ]
          .filter(Boolean)
          .join("\n");

        if (!text.toLowerCase().includes(lowerQuery)) {
          continue;
        }

        hits.push({
          id: conversation.metadata?.id || file.replace(/\.json$/, ""),
          updatedAt: conversation.metadata?.updatedAt || new Date(fs.statSync(filePath).mtime).toISOString(),
          messageCount: conversation.metadata?.messageCount || conversation.messages?.length || 0,
          summary: conversation.summary,
          text,
        });
      } catch (error) {
        logger.warn(`[Memory] Failed to read stored conversation for hybrid retrieval: ${file}`);
      }
    }

    return hits.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  getHybridMemoryResults(
    query: string,
    options: { limit?: number; conversationLimit?: number } = {},
  ): HybridMemoryResult[] {
    const limit = options.limit ?? 10;
    const conversationLimit = options.conversationLimit ?? limit;
    const memoryHits = this.searchMemoryRanked(query, limit).map((entry) => ({
      source: "memory_file" as const,
      id: entry.file,
      score: entry.score,
      preview: entry.preview,
      timestamp: entry.timestamp.toISOString(),
      metadata: {
        type: entry.type,
        matchCount: entry.matchCount,
      },
    }));

    const conversationHits = this.searchStoredConversations(query)
      .slice(0, conversationLimit)
      .map((conversation, index) => {
        const text = conversation.text;
        const preview = text.length > 240 ? text.slice(0, 240) + "..." : text;
        const matchCount = query.trim().toLowerCase().length > 0 ? (text.toLowerCase().match(new RegExp(query.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length || 0) : 0;
        const score = Math.max(1, 20 - index) + matchCount * 2;
        return {
          source: "conversation" as const,
          id: conversation.id,
          score,
          preview,
          timestamp: conversation.updatedAt,
          metadata: {
            messageCount: conversation.messageCount,
            summary: conversation.summary,
          },
        } satisfies HybridMemoryResult;
      });

    return [...memoryHits, ...conversationHits]
      .sort((a, b) => b.score - a.score || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getHybridMemoryResultsAsync(
    query: string,
    options: { limit?: number; conversationLimit?: number } = {},
  ): Promise<HybridMemoryResult[]> {
    const syncResults = this.getHybridMemoryResults(query, options);

    try {
      const conversationMemory = new ConversationMemory(this.workspacePath);
      const semanticResults = await conversationMemory.semanticSearch(query, options.limit ?? 10);
      const semanticHits = semanticResults
        .slice(0, options.limit ?? 10)
        .map((entry, index) => this.normalizeSemanticHit(entry, index));
      conversationMemory.close();

      return [...syncResults, ...semanticHits]
        .sort((a, b) => b.score - a.score || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, options.limit ?? 10);
    } catch (error) {
      logger.warn(`[Memory] Async semantic hybrid retrieval unavailable: ${error}`);
      return syncResults;
    }
  }

  getStatus(): MemoryStatus {
    const files = this.listMemoryFiles().length;
    const conversationsDir = path.join(this.workspacePath, "conversations");
    const conversations = fs.existsSync(conversationsDir)
      ? fs.readdirSync(conversationsDir).filter((file) => file.endsWith(".json")).length
      : 0;
    return {
      workspaceDir: this.workspacePath,
      memoryDir: this.memoryPath,
      files,
      conversations,
      vectorEntries: 0,
      vectorConversations: 0,
      semanticAvailable: conversations > 0,
    };
  }

  private normalizeSemanticHit(entry: ConversationSemanticHit, index: number): HybridMemoryResult {
    const previewSource = entry.content || entry.conversation.messages.map((message) => message.content).join("\n");
    const preview = previewSource.length > 240 ? previewSource.slice(0, 240) + "..." : previewSource;
    const normalizedScore = entry.score > 1 ? entry.score : entry.score * 100;
    return {
      source: "semantic_conversation",
      id: entry.conversation.metadata.id || entry.id || `semantic_${index}`,
      score: Math.max(1, Math.round(normalizedScore * 100) / 100),
      preview,
      timestamp: entry.conversation.metadata.updatedAt.toISOString(),
      metadata: {
        summary: entry.conversation.summary,
        messageCount: entry.conversation.metadata.messageCount,
        semantic: true,
      },
    } satisfies HybridMemoryResult;
  }
}

// Export singleton instance
export const memoryManager = new MemoryManager();
