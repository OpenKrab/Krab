// ============================================================
// 🦀 Krab — Enhanced Conversation Memory (OpenClaw-inspired)
// ============================================================
import type { Message } from "../core/types.js";
import {
  existsSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "fs";
import { resolve } from "path";
import { logger } from "../utils/logger.js";
import { VectorMemory } from "./vector.js";

interface ConversationMetadata {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  agentId?: string;
  userId?: string;
  channel?: string;
  language?: string;
  model?: string;
}

interface ConversationState {
  messages: Message[];
  metadata: ConversationMetadata;
  summary?: string;
  contextPruning?: {
    enabled: boolean;
    maxTokens: number;
    strategy: "recent" | "semantic" | "mixed";
  };
}

export interface ConversationSemanticHit {
  conversation: {
    metadata: {
      id: string;
      updatedAt: Date;
      messageCount: number;
    };
    messages: Message[];
    summary?: string;
  };
  score: number;
  id?: string;
  content?: string;
}

export class ConversationMemory {
  private conversations: Map<string, ConversationState> = new Map();
  private readonly workspace: string;
  private readonly maxConversations: number;
  private readonly defaultLimit: number;
  private vectorMemory: VectorMemory;

  constructor(
    workspace: string,
    options: { maxConversations?: number; defaultLimit?: number } = {},
  ) {
    this.workspace = resolve(workspace);
    this.maxConversations = options.maxConversations || 100;
    this.defaultLimit = options.defaultLimit || 50;

    this.ensureWorkspace();
    this.vectorMemory = new VectorMemory(resolve(this.workspace, "vectors"));
    this.loadConversations();
  }

  private ensureWorkspace(): void {
    if (!existsSync(this.workspace)) {
      mkdirSync(this.workspace, { recursive: true });
    }
  }

  private loadConversations(): void {
    const conversationsDir = resolve(this.workspace, "conversations");
    if (!existsSync(conversationsDir)) {
      mkdirSync(conversationsDir, { recursive: true });
      return;
    }

    try {
      const files = readdirSync(conversationsDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = resolve(conversationsDir, file);
          const data = readFileSync(filePath, "utf-8");
          const state = JSON.parse(data) as ConversationState;
          state.metadata.createdAt = new Date(state.metadata.createdAt);
          state.metadata.updatedAt = new Date(state.metadata.updatedAt);
          this.conversations.set(file.replace(".json", ""), state);
        }
      }
      logger.info(`[Memory] Loaded ${this.conversations.size} conversations`);
    } catch (error) {
      logger.error(`[Memory] Failed to load conversations:`, error);
    }
  }

  private saveConversation(id: string): void {
    const state = this.conversations.get(id);
    if (!state) return;

    const conversationsDir = resolve(this.workspace, "conversations");
    const filePath = resolve(conversationsDir, `${id}.json`);

    try {
      writeFileSync(filePath, JSON.stringify(state, null, 2));
    } catch (error) {
      logger.error(`[Memory] Failed to save conversation ${id}:`, error);
    }
  }

  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private pruneOldConversations(): void {
    if (this.conversations.size <= this.maxConversations) return;

    const sorted = Array.from(this.conversations.entries()).sort(
      ([, a], [, b]) =>
        a.metadata.updatedAt.getTime() - b.metadata.updatedAt.getTime(),
    );

    const toRemove = sorted.slice(
      0,
      this.conversations.size - this.maxConversations,
    );

    for (const [id] of toRemove) {
      this.conversations.delete(id);
      const filePath = resolve(this.workspace, "conversations", `${id}.json`);
      try {
        unlinkSync(filePath);
      } catch (error) {
        logger.warn(
          `[Memory] Failed to delete conversation file ${id}:`,
          error,
        );
      }
    }

    logger.info(`[Memory] Pruned ${toRemove.length} old conversations`);
  }

  createConversation(
    options: Partial<ConversationMetadata> & { id?: string } = {},
  ): string {
    const id = options.id || this.generateId();
    const metadata: ConversationMetadata = {
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
      ...options,
    };

    this.conversations.set(id, {
      messages: [],
      metadata,
    });

    this.pruneOldConversations();
    this.saveConversation(id);

    logger.debug(`[Memory] Created conversation ${id}`);
    return id;
  }

  addMessage(conversationId: string, message: Message): void {
    let state = this.conversations.get(conversationId);
    if (!state) {
      this.createConversation({ id: conversationId });
      state = this.conversations.get(conversationId);
      if (!state) {
        logger.warn(`[Memory] Failed to create conversation ${conversationId}`);
        return;
      }
    }

    state.messages.push(message);
    state.metadata.updatedAt = new Date();
    state.metadata.messageCount = state.messages.length;

    // Apply context pruning if enabled
    if (state.contextPruning?.enabled) {
      this.applyContextPruning(state);
    } else {
      // Default limit-based pruning
      this.applyLimitPruning(state);
    }

    this.saveConversation(conversationId);
  }

  setMessages(conversationId: string, messages: Message[]): void {
    let state = this.conversations.get(conversationId);
    if (!state) {
      this.createConversation({ id: conversationId });
      state = this.conversations.get(conversationId)!;
    }

    state.messages = [...messages];
    state.metadata.updatedAt = new Date();
    state.metadata.messageCount = state.messages.length;

    this.saveConversation(conversationId);
  }

  private applyLimitPruning(state: ConversationState): void {
    if (state.messages.length <= this.defaultLimit) return;

    const systemMessages = state.messages.filter((m) => m.role === "system");
    const nonSystem = state.messages.filter((m) => m.role !== "system");
    const trimmed = nonSystem.slice(-this.defaultLimit + systemMessages.length);
    state.messages = [...systemMessages, ...trimmed];

    logger.debug(
      `[Memory] Applied limit pruning: ${state.messages.length} messages`,
    );
  }

  private applyContextPruning(state: ConversationState): void {
    if (!state.contextPruning) return;

    const { maxTokens, strategy } = state.contextPruning;

    switch (strategy) {
      case "recent":
        this.applyRecentPruning(state, maxTokens);
        break;
      case "semantic":
        this.applySemanticPruning(state, maxTokens);
        break;
      case "mixed":
        this.applyMixedPruning(state, maxTokens);
        break;
    }
  }

  private applyRecentPruning(
    state: ConversationState,
    maxTokens: number,
  ): void {
    // Simple recent message pruning
    this.applyLimitPruning(state);
  }

  private applySemanticPruning(
    state: ConversationState,
    maxTokens: number,
  ): void {
    // TODO: Implement semantic pruning using embeddings
    // For now, fall back to recent pruning
    this.applyRecentPruning(state, maxTokens);
  }

  private applyMixedPruning(state: ConversationState, maxTokens: number): void {
    // TODO: Implement mixed pruning (keep important + recent)
    // For now, fall back to recent pruning
    this.applyRecentPruning(state, maxTokens);
  }

  getConversation(conversationId: string): ConversationState | undefined {
    return this.conversations.get(conversationId);
  }

  getAllConversations(): ConversationState[] {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime(),
    );
  }

  getRecentMessages(conversationId: string, n: number): Message[] {
    const state = this.conversations.get(conversationId);
    return state ? state.messages.slice(-n) : [];
  }

  clearConversation(conversationId: string): void {
    const state = this.conversations.get(conversationId);
    if (!state) return;

    const systemMessages = state.messages.filter((m) => m.role === "system");
    state.messages = systemMessages;
    state.metadata.updatedAt = new Date();
    state.metadata.messageCount = state.messages.length;

    this.saveConversation(conversationId);
    logger.info(`[Memory] Cleared conversation ${conversationId}`);
  }

  deleteConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
    const filePath = resolve(
      this.workspace,
      "conversations",
      `${conversationId}.json`,
    );
    try {
      unlinkSync(filePath);
      logger.info(`[Memory] Deleted conversation ${conversationId}`);
    } catch (error) {
      logger.warn(
        `[Memory] Failed to delete conversation file ${conversationId}:`,
        error,
      );
    }
  }

  setSummary(conversationId: string, summary: string): void {
    const state = this.conversations.get(conversationId);
    if (!state) return;

    state.summary = summary;
    state.metadata.updatedAt = new Date();
    this.saveConversation(conversationId);
  }

  getSummary(conversationId: string): string | undefined {
    const state = this.conversations.get(conversationId);
    return state?.summary;
  }

  setContextPruning(
    conversationId: string,
    options: ConversationState["contextPruning"],
  ): void {
    const state = this.conversations.get(conversationId);
    if (!state) return;

    state.contextPruning = options;
    state.metadata.updatedAt = new Date();
    this.saveConversation(conversationId);
  }

  getStats(): {
    totalConversations: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
    oldestConversation: Date | null;
    newestConversation: Date | null;
  } {
    const conversations = this.getAllConversations();
    const totalMessages = conversations.reduce(
      (sum, conv) => sum + conv.metadata.messageCount,
      0,
    );

    const dates = conversations.map((c) => c.metadata.createdAt);
    const oldest =
      dates.length > 0
        ? new Date(Math.min(...dates.map((d) => d.getTime())))
        : null;
    const newest =
      dates.length > 0
        ? new Date(Math.max(...dates.map((d) => d.getTime())))
        : null;

    return {
      totalConversations: conversations.length,
      totalMessages,
      averageMessagesPerConversation:
        conversations.length > 0 ? totalMessages / conversations.length : 0,
      oldestConversation: oldest,
      newestConversation: newest,
    };
  }

  getConversationStats(conversationId: string):
    | {
        messageCount: number;
        hasSummary: boolean;
        updatedAt: Date;
      }
    | undefined {
    const conv = this.getConversation(conversationId);
    if (!conv) return undefined;
    return {
      messageCount: conv.metadata.messageCount,
      hasSummary: !!conv.summary,
      updatedAt: conv.metadata.updatedAt,
    };
  }

  searchConversations(query: string): ConversationState[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllConversations().filter((conv) => {
      // Search in messages
      const messageMatch = conv.messages.some((msg) =>
        msg.content.toLowerCase().includes(lowerQuery),
      );

      // Search in summary
      const summaryMatch = conv.summary?.toLowerCase().includes(lowerQuery);

      return messageMatch || summaryMatch;
    });
  }

  // Semantic search across all conversations using vector memory
  async semanticSearch(query: string, limit: number = 10): Promise<ConversationSemanticHit[]> {
    try {
      const results = await this.vectorMemory.semanticSearch(query, limit);
      return results.map((result: any) => {
        const conversationId = result.metadata?.conversationId || result.conversationId || result.id || "unknown";
        const conversation = this.getConversation(conversationId);
        return {
          conversation: {
            metadata: {
              id: conversation?.metadata.id || conversationId,
              updatedAt: conversation?.metadata.updatedAt || new Date(),
              messageCount: conversation?.metadata.messageCount || conversation?.messages.length || 0,
            },
            messages: conversation?.messages || [],
            summary: conversation?.summary,
          },
          score: typeof result.score === "number" ? result.score : 0.5,
          id: result.id,
          content: result.content,
        } satisfies ConversationSemanticHit;
      });
    } catch (error) {
      logger.warn(`[Memory] Semantic search failed: ${error}`);
      // Fallback to text search
      return this.searchConversations(query)
        .slice(0, limit)
        .map((conv) => ({
          conversation: {
            metadata: {
              id: conv.metadata.id,
              updatedAt: conv.metadata.updatedAt,
              messageCount: conv.metadata.messageCount,
            },
            messages: conv.messages,
            summary: conv.summary,
          },
          score: 0.5,
          id: conv.metadata.id,
          content: conv.messages.map((message) => message.content).join("\n"),
        } satisfies ConversationSemanticHit));
    }
  }

  // Find similar conversations or messages
  async findSimilar(content: string, limit: number = 5): Promise<any[]> {
    try {
      return await this.vectorMemory.findSimilar(content, limit);
    } catch (error) {
      logger.warn(`[Memory] Similarity search failed: ${error}`);
      return [];
    }
  }

  // Search within a specific conversation
  async searchConversation(
    conversationId: string,
    query: string,
    limit: number = 10,
  ): Promise<any[]> {
    try {
      return await this.vectorMemory.searchByConversation(
        conversationId,
        query,
        limit,
      );
    } catch (error) {
      logger.warn(`[Memory] Conversation search failed: ${error}`);
      return [];
    }
  }

  getVectorMemory(): VectorMemory {
    return this.vectorMemory;
  }

  close(): void {
    if (this.vectorMemory) {
      this.vectorMemory.close();
    }
  }

  // ── Compatibility Methods (for simple API) ─────────────────────
  private defaultConversationId = "default";

  add(message: Message): void {
    this.addMessage(this.defaultConversationId, message);
  }

  getRecent(n: number): Message[] {
    return this.getRecentMessages(this.defaultConversationId, n);
  }

  clear(): void {
    this.clearConversation(this.defaultConversationId);
  }

  getAll(): Message[] {
    const conv = this.getConversation(this.defaultConversationId);
    return conv?.messages || [];
  }

  setAll(messages: Message[]): void {
    this.setMessages(this.defaultConversationId, messages);
  }
}
