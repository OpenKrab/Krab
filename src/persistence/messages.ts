// ============================================================
// 🦀 Krab — Message Persistence & State Management
// ============================================================
import { logger } from "../utils/logger.js";
import { MultiModalMessage, MediaAttachment } from "../channels/base.js";

// ── Message Storage Types ────────────────────────────────────
export interface PersistedMessage {
  id: string;
  channelId: string;
  conversationId: string;
  userId: string;
  timestamp: Date;
  content: string;
  type: "text" | "image" | "audio" | "video" | "file" | "sticker";
  metadata?: {
    replyTo?: string;
    forwardFrom?: string;
    mentions?: string[];
    groupId?: string;
    groupName?: string;
    platform?: string;
    userDisplayName?: string;
  };
  media?: MediaAttachment[];
  processing?: {
    transcription?: string;
    visionAnalysis?: string;
    sentiment?: "positive" | "negative" | "neutral";
    confidence?: number;
  };
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationState {
  id: string;
  channelId: string;
  userId: string;
  title?: string;
  lastMessageAt: Date;
  messageCount: number;
  participantIds: string[];
  metadata: {
    platform: string;
    isGroup: boolean;
    groupName?: string;
    channelName?: string;
  };
  context: {
    summary?: string;
    topics?: string[];
    sentiment?: "positive" | "negative" | "neutral";
    language?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageQuery {
  channelId?: string;
  conversationId?: string;
  userId?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
  type?: string[];
  tags?: string[];
  content?: string; // For full-text search
}

// ── Message Store Interface ───────────────────────────────────
export interface MessageStore {
  // Message operations
  storeMessage(message: PersistedMessage): Promise<void>;
  getMessage(messageId: string): Promise<PersistedMessage | null>;
  updateMessage(messageId: string, updates: Partial<PersistedMessage>): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;

  // Conversation operations
  createConversation(state: ConversationState): Promise<void>;
  getConversation(conversationId: string): Promise<ConversationState | null>;
  updateConversation(conversationId: string, updates: Partial<ConversationState>): Promise<void>;
  listConversations(query: MessageQuery): Promise<ConversationState[]>;

  // Query operations
  findMessages(query: MessageQuery): Promise<PersistedMessage[]>;
  searchMessages(query: string, filters?: MessageQuery): Promise<PersistedMessage[]>;

  // Bulk operations
  getConversationMessages(conversationId: string, options?: { limit?: number; offset?: number; since?: Date }): Promise<PersistedMessage[]>;
  getUserMessages(userId: string, options?: { limit?: number; since?: Date }): Promise<PersistedMessage[]>;

  // Statistics
  getStats(): Promise<{
    totalMessages: number;
    totalConversations: number;
    messagesByChannel: Record<string, number>;
    messagesByType: Record<string, number>;
    oldestMessage?: Date;
    newestMessage?: Date;
  }>;
}

// ── SQLite-based Message Store Implementation ──────────────────
export class SQLiteMessageStore implements MessageStore {
  private db: any = null;
  private initialized = false;

  constructor(private dbPath: string = "./data/messages.db") {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import for better compatibility
      const sqliteModule = await import("better-sqlite3");
      const Database = (sqliteModule as any).default ?? sqliteModule;

      this.db = new Database(this.dbPath);

      // Create tables
      this.createTables();

      // Create indexes for performance
      this.createIndexes();

      this.initialized = true;
      logger.info("[MessageStore] SQLite database initialized");

    } catch (error) {
      logger.error("[MessageStore] Failed to initialize database:", error);
      throw error;
    }
  }

  private createTables(): void {
    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        content TEXT,
        type TEXT NOT NULL,
        metadata TEXT,
        media TEXT,
        processing TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Conversations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT,
        last_message_at DATETIME NOT NULL,
        message_count INTEGER DEFAULT 0,
        participant_ids TEXT,
        metadata TEXT NOT NULL,
        context TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private createIndexes(): void {
    // Message indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
    `);

    // Conversation indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at);
    `);
  }

  // ── Message Operations ──────────────────────────────────────
  async storeMessage(message: PersistedMessage): Promise<void> {
    await this.ensureInitialized();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO messages
      (id, channel_id, conversation_id, user_id, timestamp, content, type, metadata, media, processing, tags, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      message.id,
      message.channelId,
      message.conversationId,
      message.userId,
      message.timestamp.toISOString(),
      message.content,
      message.type,
      message.metadata ? JSON.stringify(message.metadata) : null,
      message.media ? JSON.stringify(message.media) : null,
      message.processing ? JSON.stringify(message.processing) : null,
      message.tags ? JSON.stringify(message.tags) : null
    );

    // Update conversation state
    await this.updateConversationStats(message.conversationId);
  }

  async getMessage(messageId: string): Promise<PersistedMessage | null> {
    await this.ensureInitialized();

    const stmt = this.db.prepare("SELECT * FROM messages WHERE id = ?");
    const row = stmt.get(messageId);

    return row ? this.rowToMessage(row) : null;
  }

  async updateMessage(messageId: string, updates: Partial<PersistedMessage>): Promise<void> {
    await this.ensureInitialized();

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.content !== undefined) {
      fields.push("content = ?");
      values.push(updates.content);
    }
    if (updates.metadata !== undefined) {
      fields.push("metadata = ?");
      values.push(JSON.stringify(updates.metadata));
    }
    if (updates.media !== undefined) {
      fields.push("media = ?");
      values.push(JSON.stringify(updates.media));
    }
    if (updates.processing !== undefined) {
      fields.push("processing = ?");
      values.push(JSON.stringify(updates.processing));
    }
    if (updates.tags !== undefined) {
      fields.push("tags = ?");
      values.push(JSON.stringify(updates.tags));
    }

    if (fields.length === 0) return;

    fields.push("updated_at = CURRENT_TIMESTAMP");

    const stmt = this.db.prepare(`
      UPDATE messages SET ${fields.join(", ")} WHERE id = ?
    `);

    stmt.run(...values, messageId);
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.ensureInitialized();

    const stmt = this.db.prepare("DELETE FROM messages WHERE id = ?");
    stmt.run(messageId);
  }

  // ── Conversation Operations ────────────────────────────────
  async createConversation(state: ConversationState): Promise<void> {
    await this.ensureInitialized();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO conversations
      (id, channel_id, user_id, title, last_message_at, message_count, participant_ids, metadata, context, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      state.id,
      state.channelId,
      state.userId,
      state.title,
      state.lastMessageAt.toISOString(),
      state.messageCount,
      JSON.stringify(state.participantIds),
      JSON.stringify(state.metadata),
      JSON.stringify(state.context)
    );
  }

  async getConversation(conversationId: string): Promise<ConversationState | null> {
    await this.ensureInitialized();

    const stmt = this.db.prepare("SELECT * FROM conversations WHERE id = ?");
    const row = stmt.get(conversationId);

    return row ? this.rowToConversation(row) : null;
  }

  async updateConversation(conversationId: string, updates: Partial<ConversationState>): Promise<void> {
    await this.ensureInitialized();

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      fields.push("title = ?");
      values.push(updates.title);
    }
    if (updates.lastMessageAt !== undefined) {
      fields.push("last_message_at = ?");
      values.push(updates.lastMessageAt.toISOString());
    }
    if (updates.messageCount !== undefined) {
      fields.push("message_count = ?");
      values.push(updates.messageCount);
    }
    if (updates.participantIds !== undefined) {
      fields.push("participant_ids = ?");
      values.push(JSON.stringify(updates.participantIds));
    }
    if (updates.metadata !== undefined) {
      fields.push("metadata = ?");
      values.push(JSON.stringify(updates.metadata));
    }
    if (updates.context !== undefined) {
      fields.push("context = ?");
      values.push(JSON.stringify(updates.context));
    }

    if (fields.length === 0) return;

    fields.push("updated_at = CURRENT_TIMESTAMP");

    const stmt = this.db.prepare(`
      UPDATE conversations SET ${fields.join(", ")} WHERE id = ?
    `);

    stmt.run(...values, conversationId);
  }

  async listConversations(query: MessageQuery): Promise<ConversationState[]> {
    await this.ensureInitialized();

    let sql = "SELECT * FROM conversations WHERE 1=1";
    const params: any[] = [];

    if (query.channelId) {
      sql += " AND channel_id = ?";
      params.push(query.channelId);
    }
    if (query.userId) {
      sql += " AND user_id = ?";
      params.push(query.userId);
    }

    sql += " ORDER BY last_message_at DESC";

    if (query.limit) {
      sql += " LIMIT ?";
      params.push(query.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map((row: any) => this.rowToConversation(row));
  }

  // ── Query Operations ───────────────────────────────────────
  async findMessages(query: MessageQuery): Promise<PersistedMessage[]> {
    await this.ensureInitialized();

    let sql = "SELECT * FROM messages WHERE 1=1";
    const params: any[] = [];

    if (query.channelId) {
      sql += " AND channel_id = ?";
      params.push(query.channelId);
    }
    if (query.conversationId) {
      sql += " AND conversation_id = ?";
      params.push(query.conversationId);
    }
    if (query.userId) {
      sql += " AND user_id = ?";
      params.push(query.userId);
    }
    if (query.since) {
      sql += " AND timestamp >= ?";
      params.push(query.since.toISOString());
    }
    if (query.until) {
      sql += " AND timestamp <= ?";
      params.push(query.until.toISOString());
    }
    if (query.type && query.type.length > 0) {
      sql += ` AND type IN (${query.type.map(() => "?").join(",")})`;
      params.push(...query.type);
    }
    if (query.content) {
      sql += " AND content LIKE ?";
      params.push(`%${query.content}%`);
    }

    sql += " ORDER BY timestamp DESC";

    if (query.limit) {
      sql += " LIMIT ?";
      params.push(query.limit);
    }
    if (query.offset) {
      sql += " OFFSET ?";
      params.push(query.offset);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map((row: any) => this.rowToMessage(row));
  }

  async searchMessages(query: string, filters?: MessageQuery): Promise<PersistedMessage[]> {
    // Simple full-text search implementation
    // In production, you'd want FTS5 or similar
    const searchQuery: MessageQuery = {
      ...filters,
      content: query
    };

    return this.findMessages(searchQuery);
  }

  // ── Bulk Operations ────────────────────────────────────────
  async getConversationMessages(conversationId: string, options?: { limit?: number; offset?: number; since?: Date }): Promise<PersistedMessage[]> {
    const query: MessageQuery = {
      conversationId,
      ...options
    };

    return this.findMessages(query);
  }

  async getUserMessages(userId: string, options?: { limit?: number; since?: Date }): Promise<PersistedMessage[]> {
    const query: MessageQuery = {
      userId,
      ...options
    };

    return this.findMessages(query);
  }

  // ── Statistics ─────────────────────────────────────────────
  async getStats(): Promise<{
    totalMessages: number;
    totalConversations: number;
    messagesByChannel: Record<string, number>;
    messagesByType: Record<string, number>;
    oldestMessage?: Date;
    newestMessage?: Date;
  }> {
    await this.ensureInitialized();

    // Get basic counts
    const messageStats = this.db.prepare("SELECT COUNT(*) as count FROM messages").get();
    const conversationStats = this.db.prepare("SELECT COUNT(*) as count FROM conversations").get();

    // Messages by channel
    const channelStats = this.db.prepare(`
      SELECT channel_id, COUNT(*) as count
      FROM messages
      GROUP BY channel_id
    `).all();

    const messagesByChannel: Record<string, number> = {};
    channelStats.forEach((row: any) => {
      messagesByChannel[row.channel_id] = row.count;
    });

    // Messages by type
    const typeStats = this.db.prepare(`
      SELECT type, COUNT(*) as count
      FROM messages
      GROUP BY type
    `).all();

    const messagesByType: Record<string, number> = {};
    typeStats.forEach((row: any) => {
      messagesByType[row.type] = row.count;
    });

    // Date range
    const dateStats = this.db.prepare(`
      SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest
      FROM messages
    `).get();

    return {
      totalMessages: messageStats.count,
      totalConversations: conversationStats.count,
      messagesByChannel,
      messagesByType,
      oldestMessage: dateStats.oldest ? new Date(dateStats.oldest) : undefined,
      newestMessage: dateStats.newest ? new Date(dateStats.newest) : undefined
    };
  }

  // ── Helper Methods ─────────────────────────────────────────
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async updateConversationStats(conversationId: string): Promise<void> {
    const messageStats = this.db.prepare(`
      SELECT COUNT(*) as message_count, MAX(timestamp) as last_message_at
      FROM messages
      WHERE conversation_id = ?
    `).get(conversationId);

    if (messageStats.message_count > 0) {
      await this.updateConversation(conversationId, {
        messageCount: messageStats.message_count,
        lastMessageAt: new Date(messageStats.last_message_at)
      });
    }
  }

  private rowToMessage(row: any): PersistedMessage {
    return {
      id: row.id,
      channelId: row.channel_id,
      conversationId: row.conversation_id,
      userId: row.user_id,
      timestamp: new Date(row.timestamp),
      content: row.content,
      type: row.type,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      media: row.media ? JSON.parse(row.media) : undefined,
      processing: row.processing ? JSON.parse(row.processing) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private rowToConversation(row: any): ConversationState {
    return {
      id: row.id,
      channelId: row.channel_id,
      userId: row.user_id,
      title: row.title,
      lastMessageAt: new Date(row.last_message_at),
      messageCount: row.message_count,
      participantIds: JSON.parse(row.participant_ids || "[]"),
      metadata: JSON.parse(row.metadata),
      context: JSON.parse(row.context || "{}"),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

// ── State Manager for Cross-Channel Context ───────────────────
export class StateManager {
  private messageStore: MessageStore;
  private contextCache = new Map<string, any>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(messageStore: MessageStore) {
    this.messageStore = messageStore;
  }

  // ── Conversation State Management ──────────────────────────
  async getOrCreateConversation(
    channelId: string,
    userId: string,
    platform: string,
    options?: {
      groupId?: string;
      groupName?: string;
      participantIds?: string[];
    }
  ): Promise<ConversationState> {
    // Generate conversation ID based on channel and user/group
    const conversationId = options?.groupId
      ? `${channelId}:group:${options.groupId}`
      : `${channelId}:dm:${userId}`;

    let conversation = await this.messageStore.getConversation(conversationId);

    if (!conversation) {
      conversation = {
        id: conversationId,
        channelId,
        userId,
        lastMessageAt: new Date(),
        messageCount: 0,
        participantIds: options?.participantIds || [userId],
        metadata: {
          platform,
          isGroup: !!options?.groupId,
          groupName: options?.groupName,
          channelName: channelId
        },
        context: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.messageStore.createConversation(conversation);
      logger.debug(`[StateManager] Created conversation: ${conversationId}`);
    }

    return conversation;
  }

  // ── Message Processing and Storage ─────────────────────────
  async processAndStoreMessage(message: MultiModalMessage, conversation: ConversationState): Promise<PersistedMessage> {
    const persistedMessage: PersistedMessage = {
      id: message.id,
      channelId: conversation.channelId,
      conversationId: conversation.id,
      userId: message.sender.id,
      timestamp: message.timestamp,
      content: message.content,
      type: message.type,
      metadata: {
        ...message.metadata,
        platform: conversation.metadata.platform,
        userDisplayName: message.sender.displayName
      },
      media: message.media,
      processing: {
        transcription: message.transcription,
        visionAnalysis: (message as any).visionAnalysis ?? message.metadata?.forwardFrom
      },
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.messageStore.storeMessage(persistedMessage);

    // Update context cache
    this.updateContextCache(conversation.id, persistedMessage);

    return persistedMessage;
  }

  // ── Context Retrieval ──────────────────────────────────────
  async getConversationContext(conversationId: string, options?: {
    maxMessages?: number;
    since?: Date;
    includeMedia?: boolean;
  }): Promise<{
    conversation: ConversationState;
    messages: PersistedMessage[];
    summary?: string;
    topics?: string[];
  }> {
    const conversation = await this.messageStore.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const messages = await this.messageStore.getConversationMessages(conversationId, {
      limit: options?.maxMessages || 50,
      since: options?.since
    });

    // Generate summary if needed
    let summary = conversation.context.summary;
    let topics = conversation.context.topics;

    if (!summary && messages.length > 10) {
      // TODO: Implement automatic summary generation
      summary = `Conversation with ${messages.length} messages`;
    }

    return {
      conversation,
      messages,
      summary,
      topics
    };
  }

  // ── Cross-Channel Search ───────────────────────────────────
  async searchAcrossChannels(query: string, options?: {
    channels?: string[];
    users?: string[];
    since?: Date;
    limit?: number;
  }): Promise<{
    messages: PersistedMessage[];
    conversations: ConversationState[];
  }> {
    const messageQuery: MessageQuery = {
      content: query,
      limit: options?.limit || 50
    };

    if (options?.channels) {
      messageQuery.channelId = options.channels[0]; // TODO: Support multiple channels
    }

    if (options?.since) {
      messageQuery.since = options.since;
    }

    const messages = await this.messageStore.searchMessages(query, messageQuery);

    // Find related conversations
    const conversationIds = [...new Set(messages.map(m => m.conversationId))];
    const conversations = await Promise.all(
      conversationIds.map(id => this.messageStore.getConversation(id))
    );

    return {
      messages,
      conversations: conversations.filter((c): c is ConversationState => c !== null)
    };
  }

  // ── User State Management ──────────────────────────────────
  async getUserState(userId: string): Promise<{
    totalMessages: number;
    activeConversations: number;
    recentConversations: ConversationState[];
    lastActivity: Date | null;
  }> {
    const conversations = await this.messageStore.listConversations({
      userId,
      limit: 10
    });

    const userMessages = await this.messageStore.getUserMessages(userId, {
      limit: 1000 // For counting
    });

    const lastActivity = userMessages.length > 0
      ? userMessages[0].timestamp
      : null;

    return {
      totalMessages: userMessages.length,
      activeConversations: conversations.length,
      recentConversations: conversations.slice(0, 5),
      lastActivity
    };
  }

  // ── Private Methods ────────────────────────────────────────
  private updateContextCache(conversationId: string, message: PersistedMessage): void {
    const cacheKey = `ctx_${conversationId}`;
    const cached = this.contextCache.get(cacheKey) || {
      messages: [],
      lastUpdate: Date.now()
    };

    // Keep only recent messages in cache
    cached.messages.push(message);
    if (cached.messages.length > 20) {
      cached.messages = cached.messages.slice(-20);
    }

    cached.lastUpdate = Date.now();
    this.contextCache.set(cacheKey, cached);

    // Clean up old cache entries
    this.cleanupCache();
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.contextCache.entries()) {
      if (now - value.lastUpdate > this.CACHE_TTL) {
        this.contextCache.delete(key);
      }
    }
  }
}

// ── Export default instances ───────────────────────────────────
export const defaultMessageStore = new SQLiteMessageStore();
export const defaultStateManager = new StateManager(defaultMessageStore);
