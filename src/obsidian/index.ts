/**
 * 🦀 Krab — Obsidian Integration (Knowledge Base)
 * ============================================================
 * Obsidian Vault Reader, Note Manager, and Knowledge Base Integration
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';

// ============================================================
// 📚 Obsidian Note Types
// ============================================================

export interface ObsidianNote {
  id: string;
  title: string;
  content: string;
  path: string;
  relativePath: string;
  tags: string[];
  links: ObsidianLink[];
  frontmatter: Record<string, any>;
  created: Date;
  modified: Date;
  size: number;
}

export interface ObsidianLink {
  text: string;
  target: string;
  type: 'wiki' | 'markdown' | 'external';
  line: number;
  column: number;
}

export interface ObsidianVault {
  path: string;
  name: string;
  notes: Map<string, ObsidianNote>;
  tags: Map<string, ObsidianNote[]>;
  backlinks: Map<string, ObsidianNote[]>;
  graph: ObsidianGraph;
}

export interface ObsidianGraph {
  nodes: ObsidianNote[];
  edges: ObsidianEdge[];
}

export interface ObsidianEdge {
  source: string;
  target: string;
  type: 'link' | 'reference' | 'tag';
}

// ============================================================
// 🔍 Obsidian Vault Reader
// ============================================================

export class ObsidianVaultReader {
  private vault: ObsidianVault;
  private watcher?: fs.FSWatcher;

  constructor(vaultPath: string) {
    this.vault = {
      path: vaultPath,
      name: path.basename(vaultPath),
      notes: new Map(),
      tags: new Map(),
      backlinks: new Map(),
      graph: {
        nodes: [],
        edges: []
      }
    };
  }

  async loadVault(): Promise<ObsidianVault> {
    logger.info(`[Obsidian] Loading vault: ${this.vault.name}`);

    // Find all markdown files
    const noteFiles = await this.findNoteFiles();

    // Load each note
    for (const filePath of noteFiles) {
      const note = await this.loadNote(filePath);
      if (note) {
        this.vault.notes.set(note.id, note);
      }
    }

    // Build relationships
    this.buildRelationships();

    logger.info(`[Obsidian] Loaded ${this.vault.notes.size} notes from vault: ${this.vault.name}`);
    return this.vault;
  }

  private async findNoteFiles(): Promise<string[]> {
    const files: string[] = [];

    function scanDirectory(dirPath: string): void {
      try {
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            // Skip hidden directories and common ignore patterns
            if (!item.startsWith('.') && item !== 'node_modules' && item !== '.obsidian') {
              scanDirectory(itemPath);
            }
          } else if (stat.isFile() && item.endsWith('.md')) {
            files.push(itemPath);
          }
        }
      } catch (error) {
        logger.warn(`[Obsidian] Failed to scan directory ${dirPath}:`, error);
      }
    }

    scanDirectory(this.vault.path);
    return files;
  }

  private async loadNote(filePath: string): Promise<ObsidianNote | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const stat = fs.statSync(filePath);

      const relativePath = path.relative(this.vault.path, filePath);
      const title = this.extractTitle(filePath, content);
      const id = this.generateNoteId(relativePath);

      const note: ObsidianNote = {
        id,
        title,
        content,
        path: filePath,
        relativePath,
        tags: this.extractTags(content),
        links: this.extractLinks(content),
        frontmatter: this.extractFrontmatter(content),
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

  private extractTitle(filePath: string, content: string): string {
    // Try frontmatter title first
    const frontmatter = this.extractFrontmatter(content);
    if (frontmatter.title) {
      return frontmatter.title;
    }

    // Try first heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }

    // Use filename without extension
    return path.basename(filePath, '.md');
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];

    // Extract tags from frontmatter
    const frontmatter = this.extractFrontmatter(content);
    if (frontmatter.tags) {
      if (Array.isArray(frontmatter.tags)) {
        tags.push(...frontmatter.tags);
      } else if (typeof frontmatter.tags === 'string') {
        tags.push(...frontmatter.tags.split(',').map(t => t.trim()));
      }
    }

    // Extract inline tags (#tag)
    const inlineTagMatches = content.matchAll(/#([a-zA-Z][a-zA-Z0-9_-]*)/g);
    for (const match of inlineTagMatches) {
      tags.push(match[1]);
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  private extractLinks(content: string): ObsidianLink[] {
    const links: ObsidianLink[] = [];
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      // Wiki links [[Note]] or [[Note|Display Text]]
      const wikiLinkMatches = line.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g);
      for (const match of wikiLinkMatches) {
        const target = match[1];
        const displayText = match[2] || target;

        links.push({
          text: displayText,
          target,
          type: 'wiki',
          line: lineIndex + 1,
          column: match.index!
        });
      }

      // Markdown links [text](url)
      const markdownLinkMatches = line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
      for (const match of markdownLinkMatches) {
        const text = match[1];
        const url = match[2];

        links.push({
          text,
          target: url,
          type: url.startsWith('http') ? 'external' : 'markdown',
          line: lineIndex + 1,
          column: match.index!
        });
      }
    }

    return links;
  }

  private extractFrontmatter(content: string): Record<string, any> {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = content.match(frontmatterRegex);

    if (!match) return {};

    try {
      // Simple YAML-like parsing (could be enhanced with proper YAML parser)
      const frontmatter: Record<string, any> = {};
      const lines = match[1].split('\n');

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        // Parse simple values
        if (value.startsWith('[') && value.endsWith(']')) {
          // Array
          frontmatter[key] = value.slice(1, -1).split(',').map(v => v.trim());
        } else if (value === 'true' || value === 'false') {
          // Boolean
          frontmatter[key] = value === 'true';
        } else if (!isNaN(Number(value))) {
          // Number
          frontmatter[key] = Number(value);
        } else {
          // String
          frontmatter[key] = value;
        }
      }

      return frontmatter;
    } catch (error) {
      logger.warn(`[Obsidian] Failed to parse frontmatter:`, error);
      return {};
    }
  }

  private generateNoteId(relativePath: string): string {
    return relativePath.replace(/\\/g, '/').replace(/\.md$/, '');
  }

  private buildRelationships(): void {
    // Build tag index
    for (const note of this.vault.notes.values()) {
      for (const tag of note.tags) {
        if (!this.vault.tags.has(tag)) {
          this.vault.tags.set(tag, []);
        }
        this.vault.tags.get(tag)!.push(note);
      }
    }

    // Build backlinks
    for (const note of this.vault.notes.values()) {
      for (const link of note.links) {
        if (link.type === 'wiki') {
          const targetNote = this.vault.notes.get(link.target) || this.vault.notes.get(link.target + '.md');
          if (targetNote) {
            if (!this.vault.backlinks.has(targetNote.id)) {
              this.vault.backlinks.set(targetNote.id, []);
            }
            this.vault.backlinks.get(targetNote.id)!.push(note);
          }
        }
      }
    }

    // Build graph
    this.vault.graph.nodes = Array.from(this.vault.notes.values());
    this.vault.graph.edges = [];

    for (const note of this.vault.notes.values()) {
      for (const link of note.links) {
        if (link.type === 'wiki') {
          const targetNote = this.vault.notes.get(link.target) || this.vault.notes.get(link.target + '.md');
          if (targetNote) {
            this.vault.graph.edges.push({
              source: note.id,
              target: targetNote.id,
              type: 'link'
            });
          }
        }
      }

      // Add tag relationships
      for (const tag of note.tags) {
        const taggedNotes = this.vault.tags.get(tag) || [];
        for (const taggedNote of taggedNotes) {
          if (taggedNote.id !== note.id) {
            this.vault.graph.edges.push({
              source: note.id,
              target: taggedNote.id,
              type: 'tag'
            });
          }
        }
      }
    }
  }

  // Query methods
  getNote(id: string): ObsidianNote | undefined {
    return this.vault.notes.get(id);
  }

  getNotesByTag(tag: string): ObsidianNote[] {
    return this.vault.tags.get(tag) || [];
  }

  getBacklinks(noteId: string): ObsidianNote[] {
    return this.vault.backlinks.get(noteId) || [];
  }

  searchNotes(query: string): ObsidianNote[] {
    const results: ObsidianNote[] = [];
    const lowerQuery = query.toLowerCase();

    for (const note of this.vault.notes.values()) {
      if (
        note.title.toLowerCase().includes(lowerQuery) ||
        note.content.toLowerCase().includes(lowerQuery) ||
        note.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      ) {
        results.push(note);
      }
    }

    return results;
  }

  getVault(): ObsidianVault {
    return this.vault;
  }

  // File watching (optional)
  watchVault(callback: (event: string, filename: string) => void): void {
    if (this.watcher) {
      this.watcher.close();
    }

    this.watcher = fs.watch(this.vault.path, { recursive: true }, (event, filename) => {
      if (filename && filename.endsWith('.md')) {
        callback(event, filename);
      }
    });

    logger.info(`[Obsidian] Started watching vault: ${this.vault.name}`);
  }

  close(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

// ============================================================
// ✏️ Obsidian Note Writer
// ============================================================

export class ObsidianNoteWriter {
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  async createNote(notePath: string, content: string, frontmatter?: Record<string, any>): Promise<string> {
    const fullPath = path.join(this.vaultPath, notePath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Build content with frontmatter
    let fullContent = content;
    if (frontmatter && Object.keys(frontmatter).length > 0) {
      const frontmatterStr = Object.entries(frontmatter)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return `${key}: [${value.map(v => `"${v}"`).join(', ')}]`;
          }
          return `${key}: ${value}`;
        })
        .join('\n');

      fullContent = `---\n${frontmatterStr}\n---\n\n${content}`;
    }

    // Write file
    fs.writeFileSync(fullPath, fullContent, 'utf-8');

    logger.info(`[Obsidian] Created note: ${notePath}`);
    return fullPath;
  }

  async updateNote(notePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, notePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Note does not exist: ${notePath}`);
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
    logger.info(`[Obsidian] Updated note: ${notePath}`);
  }

  async appendToNote(notePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, notePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Note does not exist: ${notePath}`);
    }

    const existingContent = fs.readFileSync(fullPath, 'utf-8');
    const newContent = existingContent + '\n\n' + content;

    fs.writeFileSync(fullPath, newContent, 'utf-8');
    logger.info(`[Obsidian] Appended to note: ${notePath}`);
  }

  async deleteNote(notePath: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, notePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Note does not exist: ${notePath}`);
    }

    fs.unlinkSync(fullPath);
    logger.info(`[Obsidian] Deleted note: ${notePath}`);
  }
}

// ============================================================
// 🧠 Knowledge Base Manager
// ============================================================

export class ObsidianKnowledgeBase {
  private reader: ObsidianVaultReader;
  private writer: ObsidianNoteWriter;
  private vault: ObsidianVault | null = null;

  constructor(vaultPath: string) {
    this.reader = new ObsidianVaultReader(vaultPath);
    this.writer = new ObsidianNoteWriter(vaultPath);
  }

  async initialize(): Promise<void> {
    this.vault = await this.reader.loadVault();
    logger.info(`[Obsidian] Knowledge base initialized with ${this.vault.notes.size} notes`);
  }

  // Search and query methods
  search(query: string, options?: { tags?: string[], limit?: number }): ObsidianNote[] {
    if (!this.vault) throw new Error('Knowledge base not initialized');

    let results = this.reader.searchNotes(query);

    // Filter by tags if specified
    if (options?.tags && options.tags.length > 0) {
      results = results.filter(note =>
        options.tags!.some(tag => note.tags.includes(tag))
      );
    }

    // Limit results
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  getNote(id: string): ObsidianNote | undefined {
    if (!this.vault) throw new Error('Knowledge base not initialized');
    return this.reader.getNote(id);
  }

  getNotesByTag(tag: string): ObsidianNote[] {
    if (!this.vault) throw new Error('Knowledge base not initialized');
    return this.reader.getNotesByTag(tag);
  }

  getBacklinks(noteId: string): ObsidianNote[] {
    if (!this.vault) throw new Error('Knowledge base not initialized');
    return this.reader.getBacklinks(noteId);
  }

  // Writing methods
  async createNote(notePath: string, content: string, options?: {
    tags?: string[];
    frontmatter?: Record<string, any>;
  }): Promise<string> {
    const frontmatter = {
      ...options?.frontmatter,
      created: new Date().toISOString(),
      tags: options?.tags || []
    };

    return await this.writer.createNote(notePath, content, frontmatter);
  }

  async updateNote(notePath: string, content: string): Promise<void> {
    await this.writer.updateNote(notePath, content);
    // Optionally reload vault to update indexes
    await this.refresh();
  }

  async appendToNote(notePath: string, content: string): Promise<void> {
    await this.writer.appendToNote(notePath, content);
    await this.refresh();
  }

  async deleteNote(notePath: string): Promise<void> {
    await this.writer.deleteNote(notePath);
    await this.refresh();
  }

  // Knowledge management methods
  async createLinkedNote(title: string, content: string, links: string[] = []): Promise<string> {
    const notePath = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    const linkText = links.map(link => `[[${link}]]`).join(' ');

    const fullContent = `${content}\n\n## Links\n${linkText}`;

    return await this.createNote(notePath, fullContent, {
      tags: ['knowledge', 'linked'],
      frontmatter: {
        links: links
      }
    });
  }

  async findRelatedNotes(noteId: string, depth: number = 2): Promise<ObsidianNote[]> {
    if (!this.vault) throw new Error('Knowledge base not initialized');

    const visited = new Set<string>();
    const queue = [noteId];
    const related: ObsidianNote[] = [];

    for (let level = 0; level < depth && queue.length > 0; level++) {
      const currentLevel = [...queue];
      queue.length = 0;

      for (const currentId of currentLevel) {
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const note = this.reader.getNote(currentId);
        if (note) {
          related.push(note);

          // Add linked notes to queue
          for (const link of note.links) {
            if (link.type === 'wiki' && !visited.has(link.target)) {
              queue.push(link.target);
            }
          }

          // Add backlinks to queue
          const backlinks = this.reader.getBacklinks(currentId);
          for (const backlink of backlinks) {
            if (!visited.has(backlink.id)) {
              queue.push(backlink.id);
            }
          }
        }
      }
    }

    return related.slice(1); // Exclude the original note
  }

  async refresh(): Promise<void> {
    this.vault = await this.reader.loadVault();
    logger.info(`[Obsidian] Knowledge base refreshed`);
  }

  getVault(): ObsidianVault | null {
    return this.vault;
  }

  close(): void {
    this.reader.close();
  }
}
