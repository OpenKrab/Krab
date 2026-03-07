// ============================================================
// 🦀 Krab — Vector Memory (Long-term Memory with Embeddings)
// ============================================================
// Transformers is imported dynamically to prevent sharp C++ binding crashes on boot
import Database from "better-sqlite3";
import { resolve } from "path";
import { existsSync, mkdirSync } from "fs";
import { logger } from "../utils/logger.js";

interface VectorEntry {
  id: string;
  content: string;
  vector: number[];
  metadata: Record<string, any>;
  timestamp: Date;
  conversationId?: string;
  messageIndex?: number;
}

interface SearchResult {
  entry: VectorEntry;
  score: number;
}

export class VectorMemory {
  private db: any;
  private embedder: any | null = null;
  private readonly workspace: string;
  private readonly modelName = "nomic-ai/nomic-embed-text-v1.5";
  private initialized = false;
  private initError: Error | null = null;

  constructor(workspace: string) {
    this.workspace = resolve(workspace);
    this.ensureWorkspace();
    try {
      this.db = new Database(resolve(this.workspace, "vector-memory.db"));
      this.initializeDatabase();
      this.initialized = true;
    } catch (error) {
      this.initError = error as Error;
      logger.warn("[VectorMemory] Failed to initialize:", error);
    }
  }

  private ensureWorkspace(): void {
    if (!existsSync(this.workspace)) {
      mkdirSync(this.workspace, { recursive: true });
    }
  }

  private initializeDatabase(): void {
    // Enable vector extension if available
    try {
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("synchronous = NORMAL");
    } catch (error) {
      logger.warn("[VectorMemory] Failed to set pragmas:", error);
    }

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        vector TEXT NOT NULL, -- JSON array of floats
        metadata TEXT, -- JSON metadata
        timestamp TEXT NOT NULL,
        conversation_id TEXT,
        message_index INTEGER
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS vectors_fts USING fts5(
        id UNINDEXED,
        content
      );

      CREATE INDEX IF NOT EXISTS idx_conversation ON vectors(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON vectors(timestamp);
    `);

    // Prepare statements
    this.insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO vectors (id, content, vector, metadata, timestamp, conversation_id, message_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.searchStmt = this.db.prepare(`
      SELECT id, content, vector, metadata, timestamp, conversation_id, message_index
      FROM vectors
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    this.deleteStmt = this.db.prepare("DELETE FROM vectors WHERE id = ?");
    this.clearStmt = this.db.prepare("DELETE FROM vectors");
  }

  private async initializeEmbedder(): Promise<void> {
    try {
      logger.info("[VectorMemory] Initializing embedder...");
      const { pipeline } = await import("@xenova/transformers");
      this.embedder = await pipeline("feature-extraction", this.modelName, {
        quantized: true, // Use quantized model for speed
      });
      logger.info("[VectorMemory] Embedder ready");
    } catch (error) {
      logger.error(
        "[VectorMemory] Failed to initialize embedder. This is often caused by 'sharp' native binding issues on Windows.",
        error,
      );
    }
  }

  private insertStmt: any;
  private searchStmt: any;
  private deleteStmt: any;
  private clearStmt: any;

  async addEntry(
    content: string,
    metadata: Record<string, any> = {},
    conversationId?: string,
    messageIndex?: number,
  ): Promise<string> {
    if (!this.embedder) {
      throw new Error("Embedder not initialized");
    }

    const id = `vec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    try {
      // Generate embedding
      const output = await this.embedder(content, {
        pooling: "mean",
        normalize: true,
      });

      // Convert to array
      const vector = Array.from(output.data) as number[];

      // Store in database
      const metadataJson = JSON.stringify(metadata);
      const vectorJson = JSON.stringify(vector);

      this.insertStmt.run(
        id,
        content,
        vectorJson,
        metadataJson,
        timestamp,
        conversationId || null,
        messageIndex || null,
      );

      // Sync with FTS
      this.db
        .prepare("INSERT INTO vectors_fts (id, content) VALUES (?, ?)")
        .run(id, content);

      logger.debug(`[VectorMemory] Added entry ${id}`);
      return id;
    } catch (error) {
      logger.error("[VectorMemory] Failed to add entry:", error);
      throw error;
    }
  }

  async search(
    query: string,
    limit: number = 10,
    threshold: number = 0.1,
  ): Promise<SearchResult[]> {
    if (!this.embedder) {
      throw new Error("Embedder not initialized");
    }

    try {
      // Generate query embedding
      const output = await this.embedder(query, {
        pooling: "mean",
        normalize: true,
      });
      const queryVector = Array.from(output.data) as number[];

      // Get all vectors from database
      const rows = this.db.prepare("SELECT * FROM vectors").all() as any[];

      const results: SearchResult[] = [];

      for (const row of rows) {
        const vector = JSON.parse(row.vector);
        const score = this.cosineSimilarity(queryVector, vector);

        if (score >= threshold) {
          results.push({
            entry: {
              id: row.id,
              content: row.content,
              vector,
              metadata: JSON.parse(row.metadata || "{}"),
              timestamp: new Date(row.timestamp),
              conversationId: row.conversation_id,
              messageIndex: row.message_index,
            },
            score,
          });
        }
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);

      return results.slice(0, limit);
    } catch (error) {
      logger.error("[VectorMemory] Search failed:", error);
      throw error;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vector dimensions don't match");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  async keywordSearch(
    query: string,
    limit: number = 10,
  ): Promise<SearchResult[]> {
    try {
      // Simple FTS5 query
      const rows = this.db
        .prepare(
          `
        SELECT v.*, bm25(vectors_fts) as rank
        FROM vectors v
        JOIN vectors_fts f ON v.id = f.id
        WHERE vectors_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `,
        )
        .all(query, limit) as any[];

      return rows.map((row) => ({
        entry: {
          id: row.id,
          content: row.content,
          vector: JSON.parse(row.vector),
          metadata: JSON.parse(row.metadata || "{}"),
          timestamp: new Date(row.timestamp),
          conversationId: row.conversation_id,
          message_index: row.message_index,
        },
        score: Math.max(0, 1 - Math.abs(row.rank / 10)), // Normalize BM25 rank (rough)
      }));
    } catch (error) {
      logger.warn(`[VectorMemory] Keyword search failed: ${error}`);
      return [];
    }
  }

  async hybridSearch(
    query: string,
    limit: number = 10,
    options: { vectorWeight?: number; textWeight?: number } = {},
  ): Promise<SearchResult[]> {
    const vectorWeight = options.vectorWeight ?? 0.7;
    const textWeight = options.textWeight ?? 0.3;

    const [vectorResults, textResults] = await Promise.all([
      this.search(query, limit * 2),
      this.keywordSearch(query, limit * 2),
    ]);

    const merged = new Map<string, SearchResult>();

    // Add vector results
    for (const res of vectorResults) {
      merged.set(res.entry.id, {
        ...res,
        score: res.score * vectorWeight,
      });
    }

    // Blend with text results
    for (const res of textResults) {
      const existing = merged.get(res.entry.id);
      if (existing) {
        existing.score += res.score * textWeight;
      } else {
        merged.set(res.entry.id, {
          ...res,
          score: res.score * textWeight,
        });
      }
    }

    // Final sort and slice
    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async searchByConversation(
    conversationId: string,
    query?: string,
    limit: number = 10,
  ): Promise<SearchResult[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM vectors WHERE conversation_id = ? ORDER BY message_index ASC",
    );
    const rows = stmt.all(conversationId) as any[];

    if (!query) {
      // Return all entries for conversation
      return rows
        .map((row) => ({
          entry: {
            id: row.id,
            content: row.content,
            vector: JSON.parse(row.vector),
            metadata: JSON.parse(row.metadata || "{}"),
            timestamp: new Date(row.timestamp),
            conversationId: row.conversation_id,
            messageIndex: row.message_index,
          },
          score: 1.0,
        }))
        .slice(-limit);
    }

    // Search within conversation
    const results: SearchResult[] = [];
    const queryVector = query
      ? await this.embedder!(query, { pooling: "mean", normalize: true }).then(
          (output: any) => Array.from(output.data) as number[],
        )
      : [];

    for (const row of rows) {
      let score = 1.0;
      if (query && this.embedder) {
        const vector = JSON.parse(row.vector);
        score = this.cosineSimilarity(queryVector, vector);
      }

      results.push({
        entry: {
          id: row.id,
          content: row.content,
          vector: JSON.parse(row.vector),
          metadata: JSON.parse(row.metadata || "{}"),
          timestamp: new Date(row.timestamp),
          conversationId: row.conversation_id,
          messageIndex: row.message_index,
        },
        score,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  deleteEntry(id: string): void {
    this.deleteStmt.run(id);
    logger.debug(`[VectorMemory] Deleted entry ${id}`);
  }

  clear(): void {
    this.clearStmt.run();
    logger.info("[VectorMemory] All vectors cleared");
  }

  getStats(): {
    totalEntries: number;
    totalConversations: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const countStmt = this.db.prepare("SELECT COUNT(*) as count FROM vectors");
    const totalEntries = (countStmt.get() as any).count;

    const convStmt = this.db.prepare(
      "SELECT COUNT(DISTINCT conversation_id) as count FROM vectors WHERE conversation_id IS NOT NULL",
    );
    const totalConversations = (convStmt.get() as any).count;

    const oldestStmt = this.db.prepare(
      "SELECT MIN(timestamp) as oldest FROM vectors",
    );
    const oldest = (oldestStmt.get() as any).oldest;

    const newestStmt = this.db.prepare(
      "SELECT MAX(timestamp) as newest FROM vectors",
    );
    const newest = (newestStmt.get() as any).newest;

    return {
      totalEntries,
      totalConversations,
      oldestEntry: oldest ? new Date(oldest) : null,
      newestEntry: newest ? new Date(newest) : null,
    };
  }

  close(): void {
    if (this.db) {
      this.db.close();
      logger.info("[VectorMemory] Database closed");
    }
  }

  // Integration with ConversationMemory
  async addConversationMessage(
    conversationId: string,
    messageIndex: number,
    content: string,
    role: string,
    metadata: Record<string, any> = {},
  ): Promise<string> {
    const fullMetadata = {
      ...metadata,
      role,
      conversationId,
      messageIndex,
    };

    return await this.addEntry(
      content,
      fullMetadata,
      conversationId,
      messageIndex,
    );
  }

  // Batch add multiple messages
  async addConversationMessages(
    conversationId: string,
    messages: Array<{
      content: string;
      role: string;
      index: number;
      metadata?: Record<string, any>;
    }>,
  ): Promise<string[]> {
    const promises = messages.map((msg) =>
      this.addConversationMessage(
        conversationId,
        msg.index,
        msg.content,
        msg.role,
        msg.metadata,
      ),
    );

    return await Promise.all(promises);
  }

  // Semantic search across all conversations
  async semanticSearch(
    query: string,
    limit: number = 10,
  ): Promise<SearchResult[]> {
    return await this.hybridSearch(query, limit);
  }

  // Find similar messages
  async findSimilar(
    content: string,
    limit: number = 5,
  ): Promise<SearchResult[]> {
    return await this.search(content, limit, 0.7); // Higher threshold for similarity
  }
}
