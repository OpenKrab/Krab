// ============================================================
// 🦀 Krab — Obsidian Integration (Simplified Knowledge Base)
// Basic working version with essential functionality
// ============================================================
import { z } from "zod";
import { ToolDefinition, ToolResult } from '../core/types.js';
import { logger } from '../utils/logger.js';

// Simple Obsidian note interface
export interface ObsidianNote {
  id: string;
  title: string;
  content: string;
  path: string;
  relativePath: string;
  tags: string[];
  links: Array<{ text: string; target: string; type: string }>;
  frontmatter: Record<string, any>;
  created: Date;
  modified: Date;
  size: number;
}

// Simple vault interface
export interface ObsidianVault {
  path: string;
  name: string;
  notes: Map<string, ObsidianNote>;
  tags: Map<string, ObsidianNote[]>;
  backlinks: Map<string, ObsidianNote[]>;
}

// Basic vault reader
export class ObsidianVaultReader {
  private vault: ObsidianVault;

  constructor(vaultPath: string) {
    this.vault = {
      path: vaultPath,
      name: require('path').basename(vaultPath),
      notes: new Map(),
      tags: new Map(),
      backlinks: new Map()
    };
  }

  async loadVault(): Promise<ObsidianVault> {
    // Basic implementation - scan for .md files
    const fs = require('fs');
    const path = require('path');

    function scanDirectory(dirPath: string): void {
      try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const item of items) {
          if (item.name.startsWith('.') || item.name === 'node_modules') continue;

          const itemPath = path.join(dirPath, item.name);

          if (item.isDirectory()) {
            scanDirectory(itemPath);
          } else if (item.isFile() && item.name.endsWith('.md')) {
            const note = loadNote(itemPath);
            if (note) {
              this.vault.notes.set(note.id, note);
            }
          }
        }
      } catch (error) {
        logger.warn(`[Obsidian] Failed to scan directory ${dirPath}:`, error);
      }
    }

    function loadNote(filePath: string): ObsidianNote | null {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const stat = fs.statSync(filePath);
        const relativePath = path.relative(this.vault.path, filePath);
        const title = path.basename(filePath, '.md');

        const note: ObsidianNote = {
          id: relativePath.replace(/\.md$/, ''),
          title,
          content,
          path: filePath,
          relativePath,
          tags: extractTags(content),
          links: [],
          frontmatter: {},
          created: stat.birthtime,
          modified: stat.mtime,
          size: stat.size
        };

        return note;
      } catch (error) {
        logger.error(`[Obsidian] Failed to load note ${filePath}:`, error);
        return null;
      }
    }

    function extractTags(content: string): string[] {
      const tags: string[] = [];
      const tagRegex = /#([a-zA-Z][a-zA-Z0-9_-]*)/g;
      let match;
      while ((match = tagRegex.exec(content)) !== null) {
        tags.push(match[1]);
      }
      return [...new Set(tags)];
    }

    scanDirectory(this.vault.path);

    // Build tag index
    for (const note of this.vault.notes.values()) {
      for (const tag of note.tags) {
        if (!this.vault.tags.has(tag)) {
          this.vault.tags.set(tag, []);
        }
        this.vault.tags.get(tag)!.push(note);
      }
    }

    logger.info(`[Obsidian] Loaded ${this.vault.notes.size} notes from vault: ${this.vault.name}`);
    return this.vault;
  }

  getNote(id: string): ObsidianNote | undefined {
    return this.vault.notes.get(id);
  }

  getNotesByTag(tag: string): ObsidianNote[] {
    return this.vault.tags.get(tag) || [];
  }

  searchNotes(query: string, limit: number = 20): ObsidianNote[] {
    const results: ObsidianNote[] = [];
    const lowerQuery = query.toLowerCase();

    for (const note of this.vault.notes.values()) {
      if (note.title.toLowerCase().includes(lowerQuery) ||
          note.content.toLowerCase().includes(lowerQuery)) {
        results.push(note);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  getVault(): ObsidianVault {
    return this.vault;
  }
}

// Basic note writer
export class ObsidianNoteWriter {
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  async createNote(notePath: string, content: string, frontmatter?: Record<string, any>): Promise<string> {
    const fs = require('fs');
    const path = require('path');

    const fullPath = path.join(this.vaultPath, notePath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Build content with frontmatter if provided
    let fullContent = content;
    if (frontmatter && Object.keys(frontmatter).length > 0) {
      const frontmatterStr = Object.entries(frontmatter)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n');
      fullContent = `---\n${frontmatterStr}\n---\n\n${content}`;
    }

    // Write file
    fs.writeFileSync(fullPath, fullContent, 'utf-8');

    logger.info(`[Obsidian] Created note: ${notePath}`);
    return fullPath;
  }
}

// Knowledge Graph Data Structures
export interface KnowledgeNode {
  id: string;
  title: string;
  type: 'note' | 'tag' | 'concept';
  tags: string[];
  connections: number;
  centrality: number;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  type: 'link' | 'tag' | 'semantic';
  weight: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

// Knowledge Graph Builder
export class ObsidianKnowledgeGraph {
  private vault: ObsidianVault;
  private graph: KnowledgeGraph = { nodes: [], edges: [] };

  constructor(vault: ObsidianVault) {
    this.vault = vault;
    this.buildGraph();
  }

  private buildGraph(): void {
    const nodes = new Map<string, KnowledgeNode>();
    const edges: KnowledgeEdge[] = [];

    // Create note nodes
    for (const note of this.vault.notes.values()) {
      nodes.set(note.id, {
        id: note.id,
        title: note.title,
        type: 'note',
        tags: note.tags,
        connections: 0,
        centrality: 0
      });
    }

    // Create tag nodes and note-tag relationships
    for (const [tag, taggedNotes] of this.vault.tags.entries()) {
      if (taggedNotes.length > 1) { // Only include tags used by multiple notes
        nodes.set(`tag:${tag}`, {
          id: `tag:${tag}`,
          title: `#${tag}`,
          type: 'tag',
          tags: [],
          connections: taggedNotes.length,
          centrality: 0
        });

        // Create edges between notes sharing the same tag
        for (let i = 0; i < taggedNotes.length; i++) {
          for (let j = i + 1; j < taggedNotes.length; j++) {
            edges.push({
              source: taggedNotes[i].id,
              target: taggedNotes[j].id,
              type: 'tag',
              weight: 0.5 // Tag-based connections are moderately strong
            });
          }
        }
      }
    }

    // Analyze wiki links between notes
    for (const note of this.vault.notes.values()) {
      const linkRegex = /\[\[([^\]|]+)(\|[^\]]+)?\]\]/g;
      let match;

      while ((match = linkRegex.exec(note.content)) !== null) {
        const linkTarget = match[1];
        const targetNote = Array.from(this.vault.notes.values())
          .find(n => n.title === linkTarget || n.id === linkTarget);

        if (targetNote && targetNote.id !== note.id) {
          edges.push({
            source: note.id,
            target: targetNote.id,
            type: 'link',
            weight: 1.0 // Direct links are strongest
          });
        }
      }
    }

    // Calculate centrality scores
    this.calculateCentrality(nodes, edges);

    // Update node connections count
    nodes.forEach(node => {
      node.connections = edges.filter(edge =>
        edge.source === node.id || edge.target === node.id
      ).length;
    });

  }
}

// TF-IDF Semantic Search Implementation
export class TFIDFVectorizer {
  private documents: string[] = [];
  private vocab: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private tfidfVectors: Map<string, Map<string, number>> = new Map();

  constructor() {
    // Initialize with empty state
  }

  // Preprocess text: lowercase, remove punctuation, tokenize
  private preprocess(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.isStopWord(word));
  }

  // Basic stop words filter
  private isStopWord(word: string): boolean {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall']);
    return stopWords.has(word);
  }

  // Fit TF-IDF on documents
  fit(documents: { id: string; content: string }[]): void {
    this.documents = documents.map(doc => doc.content);

    // Build vocabulary and calculate TF-IDF
    documents.forEach(doc => {
      const tokens = this.preprocess(doc.content);
      const termFreq = new Map<string, number>();

      // Calculate term frequency for this document
      tokens.forEach(token => {
        termFreq.set(token, (termFreq.get(token) || 0) + 1);
      });

      // Store TF-IDF vector for this document
      const tfidfVector = new Map<string, number>();
      const docLength = tokens.length;

      termFreq.forEach((freq, term) => {
        const tf = freq / docLength;
        const idf = this.calculateIDF(term, documents);
        const tfidf = tf * idf;

        tfidfVector.set(term, tfidf);
        this.vocab.set(term, (this.vocab.get(term) || 0) + 1);
      });

      this.tfidfVectors.set(doc.id, tfidfVector);
    });
  }

  // Calculate Inverse Document Frequency
  private calculateIDF(term: string, documents: { id: string; content: string }[]): number {
    if (this.idf.has(term)) {
      return this.idf.get(term)!;
    }

    let docCount = 0;
    documents.forEach(doc => {
      if (this.preprocess(doc.content).includes(term)) {
        docCount++;
      }
    });

    const idf = Math.log(documents.length / (1 + docCount));
    this.idf.set(term, idf);
    return idf;
  }

  // Transform query to TF-IDF vector
  private transformQuery(query: string): Map<string, number> {
    const tokens = this.preprocess(query);
    const queryVector = new Map<string, number>();
    const termFreq = new Map<string, number>();

    // Calculate term frequency for query
    tokens.forEach(token => {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    });

    const queryLength = tokens.length;
    termFreq.forEach((freq, term) => {
      const tf = freq / queryLength;
      const idf = this.idf.get(term) || Math.log(this.documents.length + 1);
      const tfidf = tf * idf;
      queryVector.set(term, tfidf);
    });

    return queryVector;
  }

  // Calculate cosine similarity between two vectors
  private cosineSimilarity(vec1: Map<string, number>, vec2: Map<string, number>): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    // Get all terms from both vectors
    const allTerms = new Set([...vec1.keys(), ...vec2.keys()]);

    for (const term of allTerms) {
      const val1 = vec1.get(term) || 0;
      const val2 = vec2.get(term) || 0;

      dotProduct += val1 * val2;
      norm1 += val1 * val1;
      norm2 += val2 * val2;
    }

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // Search documents by semantic similarity
  search(query: string, limit: number = 10): Array<{ id: string; score: number }> {
    const queryVector = this.transformQuery(query);
    const results: Array<{ id: string; score: number }> = [];

    this.tfidfVectors.forEach((docVector, docId) => {
      const similarity = this.cosineSimilarity(queryVector, docVector);
      results.push({ id: docId, score: similarity });
    });

    // Sort by similarity score (descending) and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .filter(result => result.score > 0.01); // Filter out very low similarity
  }
}

// Real-time file watching and sync
import * as chokidar from 'chokidar';
export class ObsidianKnowledgeBase {
  private reader: ObsidianVaultReader;
  private writer: ObsidianNoteWriter;
  private vault: ObsidianVault | null = null;
  private tfidfVectorizer: TFIDFVectorizer | null = null;
  private knowledgeGraph: ObsidianKnowledgeGraph | null = null;
  private syncManager: ObsidianSyncManager | null = null;

  constructor(vaultPath: string) {
    this.reader = new ObsidianVaultReader(vaultPath);
    this.writer = new ObsidianNoteWriter(vaultPath);
  }

  async initialize(): Promise<void> {
    this.vault = await this.reader.loadVault();

    // Initialize TF-IDF vectorizer
    this.tfidfVectorizer = new TFIDFVectorizer();

    if (this.vault) {
      const documents = Array.from(this.vault.notes.values()).map(note => ({
        id: note.id,
        content: `${note.title} ${note.content}`
      }));

      this.tfidfVectorizer.fit(documents);

      // Initialize knowledge graph
      this.knowledgeGraph = new ObsidianKnowledgeGraph(this.vault);

      // Initialize sync manager
      this.syncManager = new ObsidianSyncManager(this);
    }

    logger.info(`[Obsidian] Knowledge base initialized with ${this.vault?.notes.size || 0} notes, semantic search, graph analysis, and real-time sync`);
  }

  // Real-time sync methods
  async startSync(): Promise<void> {
    if (!this.syncManager) {
      throw new Error('Sync manager not initialized');
    }
    await this.syncManager.startWatching();
  }

  async stopSync(): Promise<void> {
    if (this.syncManager) {
      await this.syncManager.stopWatching();
    }
  }

  isSyncActive(): boolean {
    return this.syncManager?.isActive() || false;
async function getKnowledgeBase(): Promise<ObsidianKnowledgeBase> {
  if (!knowledgeBase) {
    const vaultPath = process.env.OBSIDIAN_VAULT_PATH || '~/Documents/Obsidian Vault';
    knowledgeBase = new ObsidianKnowledgeBase(vaultPath.replace('~', process.env.HOME || process.env.USERPROFILE || '~'));
    await knowledgeBase.initialize();
  }
  return knowledgeBase;
}

// ============================================================
// 📖 BASIC READING TOOLS
// ============================================================

export const obsidianReadNoteTool: ToolDefinition = {
  name: 'obsidian_read_note',
  description: 'Read the content of a specific Obsidian note',
  parameters: z.object({
    notePath: z.string().describe('Path to the note (e.g., "My Note.md" or "folder/My Note")')
  }),

  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const note = kb.getNote(args.notePath.replace('.md', ''));

      if (!note) {
        return { success: false, output: `Note not found: ${args.notePath}` };
      }

      const result = {
        title: note.title,
        content: note.content,
        path: note.relativePath,
        modified: note.modified.toISOString(),
        tags: note.tags
      };

      return { success: true, output: JSON.stringify(result) };
    } catch (error: any) {
      logger.error('[Obsidian] Read note failed:', error);
      return { success: false, output: `Failed to read note: ${error.message}` };
    }
  }
};

export const obsidianFindRelatedNotesTool: ToolDefinition = {
  name: 'obsidian_find_related_notes',
  description: 'Find notes related to a specific note through graph connections',
  parameters: z.object({
    noteId: z.string().describe('ID or path of the note to find relations for'),
    maxDepth: z.number().optional().describe('Maximum connection depth to search')
  }),

  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const maxDepth = args.maxDepth || 2;

      const relatedNotes = kb.findRelatedNotes(args.noteId, maxDepth);

      const result = {
        noteId: args.noteId,
        maxDepth,
        relatedNotes: relatedNotes.map(note => ({
          id: note.id,
          title: note.title,
          type: note.type,
          connections: note.connections,
          centrality: Math.round(note.centrality * 100) / 100
        }))
      };

      return { success: true, output: JSON.stringify(result) };
    } catch (error: any) {
      logger.error('[Obsidian] Find related notes failed:', error);
      return { success: false, output: `Failed to find related notes: ${error.message}` };
    }
  }
};

export const obsidianGetKnowledgeGraphTool: ToolDefinition = {
  name: 'obsidian_get_knowledge_graph',
  description: 'Get the complete knowledge graph structure of the vault',
  parameters: z.object({
    includeTags: z.boolean().optional().describe('Include tag nodes in the graph'),
    maxNodes: z.number().optional().describe('Maximum number of nodes to return')
  }),

  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const graph = kb.getKnowledgeGraph();

      let filteredNodes = graph.nodes;
      let filteredEdges = graph.edges;

      // Filter tag nodes if not requested
      if (!args.includeTags) {
        const noteIds = new Set(filteredNodes.filter(n => n.type === 'note').map(n => n.id));
        filteredNodes = filteredNodes.filter(n => n.type === 'note');
        filteredEdges = filteredEdges.filter(e =>
          noteIds.has(e.source) && noteIds.has(e.target)
        );
      }

      // Limit nodes if specified
      if (args.maxNodes && filteredNodes.length > args.maxNodes) {
        // Sort by centrality and take top nodes
        filteredNodes = filteredNodes
          .sort((a, b) => b.centrality - a.centrality)
          .slice(0, args.maxNodes);

        const nodeIds = new Set(filteredNodes.map(n => n.id));
        filteredEdges = filteredEdges.filter(e =>
          nodeIds.has(e.source) && nodeIds.has(e.target)
        );
      }

      const result = {
        nodes: filteredNodes.map(node => ({
          id: node.id,
          title: node.title,
          type: node.type,
          connections: node.connections,
          centrality: Math.round(node.centrality * 100) / 100
        })),
        edges: filteredEdges.map(edge => ({
          source: edge.source,
          target: edge.target,
          type: edge.type,
          weight: edge.weight
        })),
        totalNodes: graph.nodes.length,
        totalEdges: graph.edges.length,
        filteredNodes: filteredNodes.length,
        filteredEdges: filteredEdges.length
      };

      return { success: true, output: JSON.stringify(result) };
    } catch (error: any) {
      logger.error('[Obsidian] Get knowledge graph failed:', error);
      return { success: false, output: `Failed to get knowledge graph: ${error.message}` };
    }
  }
};

export const obsidianGetCentralNodesTool: ToolDefinition = {
  name: 'obsidian_get_central_nodes',
  description: 'Get the most central/connected notes in the knowledge graph',
  parameters: z.object({
    limit: z.number().optional().describe('Maximum number of central nodes to return')
  }),

  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const limit = args.limit || 10;

      const centralNodes = kb.getCentralKnowledgeNodes(limit);

      const result = {
        centralNodes: centralNodes.map(node => ({
          id: node.id,
          title: node.title,
          connections: node.connections,
          centrality: Math.round(node.centrality * 100) / 100,
          tags: node.tags
        })),
        totalRequested: limit
      };

      return { success: true, output: JSON.stringify(result) };
    } catch (error: any) {
      logger.error('[Obsidian] Get central nodes failed:', error);
      return { success: false, output: `Failed to get central nodes: ${error.message}` };
    }
  }
};

export const obsidianSynthesizeKnowledgeTool: ToolDefinition = {
  name: 'obsidian_synthesize_knowledge',
  description: 'AI-powered synthesis of knowledge from related notes on a specific topic',
  parameters: z.object({
    topic: z.string().describe('Topic or concept to synthesize knowledge about'),
    maxNotes: z.number().optional().describe('Maximum number of related notes to include'),
    includeSemantic: z.boolean().optional().describe('Include semantic search for related notes')
  }),

  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const maxNotes = args.maxNotes || 10;
      const includeSemantic = args.includeSemantic || true;

      // Find related notes using multiple strategies
      let relatedNotes: ObsidianNote[] = [];

      if (includeSemantic) {
        // Use semantic search to find related notes
        const semanticResults = kb.semanticSearch(args.topic, maxNotes);
        relatedNotes = semanticResults.map(result => result.note);
      } else {
        // Use basic text search
        relatedNotes = kb.search(args.topic, maxNotes);
      }

      // Also include notes found through graph relationships
      const graphRelated = kb.findRelatedNotes(args.topic, 2);
      const graphNoteIds = new Set(graphRelated.map(n => n.id));

      // Add graph-related notes that aren't already included
      for (const graphNode of graphRelated) {
        const existingNote = relatedNotes.find(n => n.id === graphNode.id);
        if (!existingNote) {
          const note = kb.getNote(graphNode.id);
          if (note) {
            relatedNotes.push(note);
          }
        }
      }

      // Limit to maxNotes
      relatedNotes = relatedNotes.slice(0, maxNotes);

      // Generate synthesis
      const synthesis = await kb.synthesizeKnowledge(args.topic, relatedNotes);

      const result = {
        topic: args.topic,
        notesAnalyzed: relatedNotes.length,
        synthesis: synthesis,
        includedNotes: relatedNotes.map(note => ({
          id: note.id,
          title: note.title,
          tags: note.tags
        }))
      };

      return { success: true, output: JSON.stringify(result) };
    } catch (error: any) {
      logger.error('[Obsidian] Synthesize knowledge failed:', error);
      return { success: false, output: `Failed to synthesize knowledge: ${error.message}` };
    }
  }
};

export const obsidianStartSyncTool: ToolDefinition = {
  name: 'obsidian_start_sync',
  description: 'Start real-time file watching and automatic knowledge base updates',
  parameters: z.object({}),

  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      await kb.startSync();

      const result = {
        message: 'Real-time sync started successfully',
        status: 'active'
      };

      return { success: true, output: JSON.stringify(result) };
    } catch (error: any) {
      logger.error('[Obsidian] Failed to start sync:', error);
      return { success: false, output: `Failed to start real-time sync: ${error.message}` };
    }
  }
};

export const obsidianStopSyncTool: ToolDefinition = {
  name: 'obsidian_stop_sync',
  description: 'Stop real-time file watching and automatic knowledge base updates',
  parameters: z.object({}),

  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      await kb.stopSync();

      const result = {
        message: 'Real-time sync stopped successfully',
        status: 'inactive'
      };

      return { success: true, output: JSON.stringify(result) };
    } catch (error: any) {
      logger.error('[Obsidian] Failed to stop sync:', error);
      return { success: false, output: `Failed to stop real-time sync: ${error.message}` };
    }
  }
};

export const obsidianSyncStatusTool: ToolDefinition = {
  name: 'obsidian_sync_status',
  description: 'Get the current status of real-time file watching and sync',
  parameters: z.object({}),

  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const status = kb.getSyncStatus();

      const result = {
        isWatching: status.isWatching,
        pendingChanges: status.pendingChanges,
        status: status.isWatching ? 'active' : 'inactive'
      };

      return { success: true, output: JSON.stringify(result) };
    } catch (error: any) {
      logger.error('[Obsidian] Failed to get sync status:', error);
      return { success: false, output: `Failed to get sync status: ${error.message}` };
    }
  }
};

export const obsidianSearchNotesTool: ToolDefinition = {
  name: 'obsidian_search_notes',
  description: 'Search for Obsidian notes by content or title',
  parameters: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().optional().describe('Maximum number of results')
  }),

  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const notes = kb.search(args.query, args.limit || 20);

      const results = notes.map(note => ({
        id: note.id,
        title: note.title,
        path: note.relativePath,
        tags: note.tags,
        modified: note.modified.toISOString()
      }));

      const result = {
        query: args.query,
        totalResults: notes.length,
        notes: results
      };

      return { success: true, output: JSON.stringify(result) };
    } catch (error: any) {
      logger.error('[Obsidian] Search failed:', error);
      return { success: false, output: `Search failed: ${error.message}` };
    }
  }
};

export const obsidianListNotesByTagTool: ToolDefinition = {
  name: 'obsidian_list_notes_by_tag',
  description: 'List all notes that have a specific tag',
  parameters: z.object({
    tag: z.string().describe('Tag to search for (without #)')
  }),

  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const notes = kb.getNotesByTag(args.tag);

      const results = notes.map(note => ({
        id: note.id,
        title: note.title,
        path: note.relativePath,
        modified: note.modified.toISOString()
      }));

      const result = {
        tag: args.tag,
        totalNotes: notes.length,
        notes: results
      };

      return { success: true, output: JSON.stringify(result) };
    } catch (error: any) {
      logger.error('[Obsidian] List by tag failed:', error);
      return { success: false, output: `Failed to list notes by tag: ${error.message}` };
    }
  }
};

export const obsidianCreateNoteTool: ToolDefinition = {
  name: 'obsidian_create_note',
  description: 'Create a new note in the Obsidian vault',
  parameters: z.object({
    title: z.string().describe('Title of the new note'),
    content: z.string().describe('Content of the note (Markdown)'),
    folder: z.string().optional().describe('Folder path within the vault'),
    tags: z.array(z.string()).optional().describe('Tags to add to the note')
  }),

  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();

      // Build note path
      const folder = args.folder ? `${args.folder}/` : '';
      const filename = args.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
      const notePath = `${folder}${filename}.md`;

      const frontmatter: any = {
        title: args.title,
        created: new Date().toISOString(),
        ...(args.tags && { tags: args.tags })
      };

      const fullPath = await kb.createNote(notePath, args.content, frontmatter);

      const result = {
        message: `Note created successfully`,
        notePath,
        fullPath,
        title: args.title
      };

      return { success: true, output: JSON.stringify(result) };
    } catch (error: any) {
      logger.error('[Obsidian] Create note failed:', error);
      return { success: false, output: `Failed to create note: ${error.message}` };
    }
  }
};

// ============================================================
// 📚 TOOL COLLECTION
// ============================================================

export const obsidianTools: ToolDefinition[] = [
  obsidianReadNoteTool,
  obsidianSearchNotesTool,
  obsidianSemanticSearchTool,
  obsidianFindRelatedNotesTool,
  obsidianGetKnowledgeGraphTool,
  obsidianGetCentralNodesTool,
  obsidianFindKnowledgePathTool,
  obsidianSynthesizeKnowledgeTool,
  obsidianDiscoverClustersTool,
  obsidianStartSyncTool,
  obsidianStopSyncTool,
  obsidianSyncStatusTool,
  obsidianListNotesByTagTool,
  obsidianCreateNoteTool,
  obsidianStatsTool
];
