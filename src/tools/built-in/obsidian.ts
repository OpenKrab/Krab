// ============================================================
// 🦀 Krab — Obsidian Integration (Knowledge Base)
// Read, Write, Search, and Manage your Obsidian Vault with AI
// ============================================================
import { z } from "zod";
import { readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises";
import { resolve, join, relative, basename, extname, dirname } from "node:path";
import type { ToolDefinition, ToolResult } from "../../core/types.js";

// Import advanced knowledge base features
import {
  ObsidianAIKnowledgeBase,
  type ObsidianNote,
  type SemanticSearchResult
} from "../../obsidian/knowledge-base.js";

// Global knowledge base instance
let knowledgeBase: ObsidianAIKnowledgeBase | null = null;

// Initialize knowledge base
async function getKnowledgeBase(): Promise<ObsidianAIKnowledgeBase> {
  if (!knowledgeBase) {
    const vaultPath = process.env.OBSIDIAN_VAULT_PATH || "~/Documents/Obsidian Vault";
    knowledgeBase = new ObsidianAIKnowledgeBase(vaultPath.replace('~', process.env.HOME || process.env.USERPROFILE || '~'));
    await knowledgeBase.initialize();
  }
  return knowledgeBase;
}

// ============================================================
// 📖 BASIC READING TOOLS (Enhanced)
// ============================================================

export const obsidianReadTool: ToolDefinition = {
  name: "obsidian_read_note",
  description: "Read the content of a specific Obsidian note by path or ID with optional metadata",
  parameters: z.object({
    notePath: z.string().describe("Path to the note (e.g., 'My Note.md' or 'folder/My Note')"),
    includeMetadata: z.boolean().optional().describe("Include tags, links, and frontmatter"),
    includeBacklinks: z.boolean().optional().describe("Include notes that link to this one")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const note = kb.getNote(args.notePath.replace('.md', ''));

      if (!note) {
        return { success: false, output: `Note not found: ${args.notePath}` };
      }

      const result: any = {
        title: note.title,
        content: note.content,
        path: note.relativePath,
        modified: note.modified.toISOString(),
        size: note.size
      };

      if (args.includeMetadata) {
        result.tags = note.tags;
        result.links = note.links.map(l => ({ text: l.text, target: l.target, type: l.type }));
        result.frontmatter = note.frontmatter;
      }

      if (args.includeBacklinks) {
        const backlinks = kb.getBacklinks(note.id);
        result.backlinks = backlinks.map(n => ({
          title: n.title,
          path: n.relativePath,
          tags: n.tags
        }));
      }

      return { success: true, output: result };
    } catch (error: any) {
      return { success: false, output: `Failed to read note: ${error.message}` };
    }
  }
};

export const obsidianSearchTool: ToolDefinition = {
  name: "obsidian_search_notes",
  description: "Search Obsidian notes by content, title, or tags with advanced filtering",
  parameters: z.object({
    query: z.string().describe("Search query to match against note content, titles, or tags"),
    tags: z.array(z.string()).optional().describe("Filter by specific tags"),
    limit: z.number().optional().describe("Maximum number of results (default: 20)"),
    includeContent: z.boolean().optional().describe("Include full content in results"),
    semantic: z.boolean().optional().describe("Use semantic search instead of keyword matching")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();

      let results: ObsidianNote[] | SemanticSearchResult[];
      if (args.semantic) {
        // Use semantic search
        results = kb.semanticSearch(args.query, {
          limit: args.limit || 20,
          includeContext: args.includeContent
        });
      } else {
        // Use regular search
        results = kb.search(args.query, {
          tags: args.tags,
          limit: args.limit || 20
        });
      }

      const formattedResults = results.map(result => {
        if ('score' in result) {
          // Semantic search result
          return {
            id: result.note.id,
            title: result.note.title,
            path: result.note.relativePath,
            tags: result.note.tags,
            score: result.score,
            matches: result.matches,
            ...(args.includeContent && { content: result.context || result.note.content.substring(0, 500) + '...' })
          };
        } else {
          // Regular search result
          return {
            id: result.id,
            title: result.title,
            path: result.relativePath,
            tags: result.tags,
            modified: result.modified.toISOString(),
            ...(args.includeContent && { content: result.content })
          };
        }
      });

      return {
        success: true,
        output: {
          query: args.query,
          totalResults: results.length,
          searchType: args.semantic ? 'semantic' : 'keyword',
          notes: formattedResults
        }
      };
    } catch (error: any) {
      return { success: false, output: `Search failed: ${error.message}` };
    }
  }
};

export const obsidianListTool: ToolDefinition = {
  name: "obsidian_list_notes",
  description: "List Obsidian notes with optional filtering by tags, date range, or folder",
  parameters: z.object({
    tags: z.array(z.string()).optional().describe("Filter by tags"),
    folder: z.string().optional().describe("Filter by folder path"),
    since: z.string().optional().describe("Show notes modified after this date (ISO string)"),
    until: z.string().optional().describe("Show notes modified before this date (ISO string)"),
    limit: z.number().optional().describe("Maximum number of results"),
    sortBy: z.enum(["modified", "created", "title", "size"]).optional().describe("Sort results by field")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const vault = kb.getVault();

      if (!vault) {
        return { success: false, output: "Vault not loaded" };
      }

      let notes = Array.from(vault.notes.values());

      // Apply filters
      if (args.tags && args.tags.length > 0) {
        notes = notes.filter(note =>
          args.tags!.some(tag => note.tags.includes(tag))
        );
      }

      if (args.folder) {
        const folderPrefix = args.folder.endsWith('/') ? args.folder : args.folder + '/';
        notes = notes.filter(note => note.relativePath.startsWith(folderPrefix));
      }

      if (args.since) {
        const sinceDate = new Date(args.since);
        notes = notes.filter(note => note.modified >= sinceDate);
      }

      if (args.until) {
        const untilDate = new Date(args.until);
        notes = notes.filter(note => note.modified <= untilDate);
      }

      // Sort
      const sortBy = args.sortBy || 'modified';
      notes.sort((a, b) => {
        switch (sortBy) {
          case 'title':
            return a.title.localeCompare(b.title);
          case 'created':
            return a.created.getTime() - b.created.getTime();
          case 'size':
            return b.size - a.size;
          case 'modified':
          default:
            return b.modified.getTime() - a.modified.getTime();
        }
      });

      // Limit
      if (args.limit) {
        notes = notes.slice(0, args.limit);
      }

      const results = notes.map(note => ({
        id: note.id,
        title: note.title,
        path: note.relativePath,
        tags: note.tags,
        modified: note.modified.toISOString(),
        created: note.created.toISOString(),
        size: note.size
      }));

      return {
        success: true,
        output: {
          totalNotes: notes.length,
          filters: {
            tags: args.tags,
            folder: args.folder,
            since: args.since,
            until: args.until,
            sortBy
          },
          notes: results
        }
      };
    } catch (error: any) {
      return { success: false, output: `Failed to list notes: ${error.message}` };
    }
  }
};

// ============================================================
// ✏️ WRITING TOOLS (Enhanced)
// ============================================================

export const obsidianWriteTool: ToolDefinition = {
  name: "obsidian_create_note",
  description: "Create a new note in the Obsidian vault with advanced features",
  parameters: z.object({
    title: z.string().describe("Title of the new note"),
    content: z.string().describe("Content of the note (Markdown)"),
    folder: z.string().optional().describe("Folder path within the vault"),
    tags: z.array(z.string()).optional().describe("Tags to add to the note"),
    frontmatter: z
      .record(z.string(), z.any())
      .optional()
      .describe("Additional frontmatter properties"),
    links: z.array(z.string()).optional().describe("Note titles/IDs to link to")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();

      // Build frontmatter
      const frontmatter = {
        ...args.frontmatter,
        title: args.title,
        created: new Date().toISOString(),
        ...(args.tags && { tags: args.tags })
      };

      // Create linked note if links are provided
      if (args.links && args.links.length > 0) {
        const fullPath = await kb.createLinkedNote(args.title, args.content, args.links);
        return {
          success: true,
          output: {
            message: `Linked note created successfully`,
            notePath: fullPath,
            title: args.title,
            links: args.links
          }
        };
      } else {
        // Create regular note
        const folder = args.folder ? `${args.folder}/` : '';
        const filename = args.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
        const notePath = `${folder}${filename}.md`;

        const fullPath = await kb.createNote(notePath, args.content, {
          tags: args.tags || [],
          frontmatter
        });

        return {
          success: true,
          output: {
            message: `Note created successfully`,
            notePath,
            fullPath,
            title: args.title
          }
        };
      }
    } catch (error: any) {
      return { success: false, output: `Failed to create note: ${error.message}` };
    }
  }
};

export const obsidianAppendTool: ToolDefinition = {
  name: "obsidian_append_note",
  description: "Append content to an existing note",
  parameters: z.object({
    notePath: z.string().describe("Path to the note to append to"),
    content: z.string().describe("Content to append"),
    addTimestamp: z.boolean().optional().describe("Add timestamp before appended content")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();

      let contentToAppend = args.content;
      if (args.addTimestamp) {
        const timestamp = new Date().toISOString();
        contentToAppend = `\n\n---\n*Appended on ${timestamp}*\n\n${contentToAppend}`;
      } else {
        contentToAppend = '\n\n' + contentToAppend;
      }

      await kb.appendToNote(args.notePath, contentToAppend);

      return {
        success: true,
        output: {
          message: `Content appended to note: ${args.notePath}`,
          appendedLength: contentToAppend.length
        }
      };
    } catch (error: any) {
      return { success: false, output: `Failed to append to note: ${error.message}` };
    }
  }
};

export const obsidianUpdateNoteTool: ToolDefinition = {
  name: "obsidian_update_note",
  description: "Update the content of an existing note (replaces entire content)",
  parameters: z.object({
    notePath: z.string().describe("Path to the note to update"),
    content: z.string().describe("New content for the note"),
    preserveFrontmatter: z.boolean().optional().describe("Keep existing frontmatter")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();

      if (args.preserveFrontmatter) {
        const existingNote = kb.getNote(args.notePath.replace('.md', ''));
        if (existingNote && existingNote.frontmatter && Object.keys(existingNote.frontmatter).length > 0) {
          // Extract frontmatter and prepend to new content
          const frontmatterStr = Object.entries(existingNote.frontmatter)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join('\n');
          const contentWithFrontmatter = `---\n${frontmatterStr}\n---\n\n${args.content}`;
          await kb.updateNote(args.notePath, contentWithFrontmatter);
        } else {
          await kb.updateNote(args.notePath, args.content);
        }
      } else {
        await kb.updateNote(args.notePath, args.content);
      }

      return {
        success: true,
        output: {
          message: `Note updated: ${args.notePath}`,
          preserveFrontmatter: args.preserveFrontmatter
        }
      };
    } catch (error: any) {
      return { success: false, output: `Failed to update note: ${error.message}` };
    }
  }
};

export const obsidianDeleteNoteTool: ToolDefinition = {
  name: "obsidian_delete_note",
  description: "Delete a note from the Obsidian vault (with confirmation)",
  parameters: z.object({
    notePath: z.string().describe("Path to the note to delete"),
    confirm: z.boolean().describe("Must be true to confirm deletion")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      if (!args.confirm) {
        return {
          success: false,
          output: `Deletion not confirmed. Set confirm=true to delete note: ${args.notePath}`
        };
      }

      const kb = await getKnowledgeBase();
      await kb.deleteNote(args.notePath);

      return {
        success: true,
        output: {
          message: `Note deleted: ${args.notePath}`,
          deleted: true
        }
      };
    } catch (error: any) {
      return { success: false, output: `Failed to delete note: ${error.message}` };
    }
  }
};

// ============================================================
// 🧠 KNOWLEDGE MANAGEMENT TOOLS
// ============================================================

export const obsidianTagsTool: ToolDefinition = {
  name: "obsidian_get_tags",
  description: "Get all tags used in the vault or notes with a specific tag",
  parameters: z.object({
    tag: z.string().optional().describe("Specific tag to get notes for"),
    includeStats: z.boolean().optional().describe("Include usage statistics for each tag")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const vault = kb.getVault();

      if (!vault) {
        return { success: false, output: "Vault not loaded" };
      }

      if (args.tag) {
        // Get notes with specific tag
        const notes = kb.getNotesByTag(args.tag);
        const results = notes.map(note => ({
          id: note.id,
          title: note.title,
          path: note.relativePath,
          tags: note.tags,
          modified: note.modified.toISOString()
        }));

        return {
          success: true,
          output: {
            tag: args.tag,
            totalNotes: notes.length,
            notes: results
          }
        };
      } else {
        // Get all tags with statistics
        const tagCounts: Record<string, number> = {};
        for (const note of vault.notes.values()) {
          for (const tag of note.tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }

        const sortedTags = Object.entries(tagCounts)
          .sort(([,a], [,b]) => b - a)
          .map(([tag, count]) => ({ tag, count }));

        return {
          success: true,
          output: {
            totalUniqueTags: sortedTags.length,
            tags: args.includeStats ? sortedTags : sortedTags.map(t => t.tag)
          }
        };
      }
    } catch (error: any) {
      return { success: false, output: `Failed to get tags: ${error.message}` };
    }
  }
};

export const obsidianLinksTool: ToolDefinition = {
  name: "obsidian_get_links",
  description: "Get links from a note or find notes that link to a specific note",
  parameters: z.object({
    notePath: z.string().describe("Path to the note to analyze"),
    direction: z.enum(["outgoing", "incoming", "both"]).optional().describe("Link direction to analyze")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const note = kb.getNote(args.notePath.replace('.md', ''));

      if (!note) {
        return { success: false, output: `Note not found: ${args.notePath}` };
      }

      const result: any = {
        note: {
          id: note.id,
          title: note.title,
          path: note.relativePath
        }
      };

      const direction = args.direction || 'both';

      if (direction === 'outgoing' || direction === 'both') {
        result.outgoingLinks = note.links.map(link => ({
          text: link.text,
          target: link.target,
          type: link.type,
          line: link.line,
          column: link.column
        }));
      }

      if (direction === 'incoming' || direction === 'both') {
        const backlinks = kb.getBacklinks(note.id);
        result.incomingLinks = backlinks.map(linkNote => ({
          id: linkNote.id,
          title: linkNote.title,
          path: linkNote.relativePath,
          tags: linkNote.tags
        }));
      }

      return {
        success: true,
        output: result
      };
    } catch (error: any) {
      return { success: false, output: `Failed to get links: ${error.message}` };
    }
  }
};

export const obsidianFindRelatedTool: ToolDefinition = {
  name: "obsidian_find_related",
  description: "Find notes related to a given note through links and content similarity",
  parameters: z.object({
    notePath: z.string().describe("Path to the note to find relations for"),
    depth: z.number().optional().describe("How deep to search for relationships (default: 2)"),
    includeContent: z.boolean().optional().describe("Include content snippets in results"),
    method: z.enum(["links", "semantic", "both"]).optional().describe("Search method to use")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const method = args.method || 'both';

      let relatedNotes: ObsidianNote[] = [];

      if (method === 'links' || method === 'both') {
        // Find related through links
        const linkedNotes = await kb.findRelatedNotes(args.notePath.replace('.md', ''), args.depth || 2);
        relatedNotes.push(...linkedNotes);
      }

      if (method === 'semantic' || method === 'both') {
        // Find related through semantic similarity
        const note = kb.getNote(args.notePath.replace('.md', ''));
        if (note) {
          const semanticResults = kb.semanticSearch(note.content.substring(0, 200), {
            limit: args.depth * 3,
            includeContext: args.includeContent
          });

          // Filter out the original note and duplicates
          const semanticNotes = semanticResults
            .filter(r => r.note.id !== note.id)
            .map(r => r.note)
            .filter(n => !relatedNotes.find(rn => rn.id === n.id));

          relatedNotes.push(...semanticNotes.slice(0, args.depth * 2));
        }
      }

      // Remove duplicates
      const uniqueNotes = relatedNotes.filter((note, index, self) =>
        index === self.findIndex(n => n.id === n.id)
      );

      const results = uniqueNotes.slice(0, (args.depth || 2) * 5).map(note => ({
        id: note.id,
        title: note.title,
        path: note.relativePath,
        tags: note.tags,
        modified: note.modified.toISOString(),
        ...(args.includeContent && { content: note.content.substring(0, 200) + '...' })
      }));

      return {
        success: true,
        output: {
          sourceNote: args.notePath,
          method,
          depth: args.depth || 2,
          totalRelated: results.length,
          relatedNotes: results
        }
      };
    } catch (error: any) {
      return { success: false, output: `Failed to find related notes: ${error.message}` };
    }
  }
};

export const obsidianSynthesizeTool: ToolDefinition = {
  name: "obsidian_synthesize_knowledge",
  description: "Synthesize knowledge about a topic from multiple related notes",
  parameters: z.object({
    topic: z.string().describe("Topic to synthesize knowledge about"),
    includeRelatedNotes: z.boolean().optional().describe("Include list of related notes used"),
    maxNotes: z.number().optional().describe("Maximum number of notes to analyze")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const synthesis = await kb.synthesizeKnowledge(args.topic);

      const result: any = {
        topic: args.topic,
        summary: synthesis.summary,
        keyPoints: synthesis.keyPoints,
        totalRelatedNotes: synthesis.relatedNotes.length
      };

      if (args.includeRelatedNotes) {
        result.relatedNotes = synthesis.relatedNotes.map(note => ({
          id: note.id,
          title: note.title,
          path: note.relativePath,
          tags: note.tags,
          modified: note.modified.toISOString()
        }));
      }

      if (args.maxNotes && synthesis.relatedNotes.length > args.maxNotes) {
        result.note = `Limited to ${args.maxNotes} most relevant notes`;
      }

      return {
        success: true,
        output: result
      };
    } catch (error: any) {
      return { success: false, output: `Failed to synthesize knowledge: ${error.message}` };
    }
  }
};

// ============================================================
// 📊 MANAGEMENT TOOLS
// ============================================================

export const obsidianDailyTool: ToolDefinition = {
  name: "obsidian_create_daily_note",
  description: "Create or get today's daily note in the Daily Notes folder",
  parameters: z.object({
    date: z.string().optional().describe("Date for the daily note (ISO string, default: today)"),
    template: z.string().optional().describe("Custom template content to use")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const targetDate = args.date ? new Date(args.date) : new Date();

      // Check if daily note already exists
      const dateStr = targetDate.toISOString().split('T')[0];
      const existingNote = kb.getNote(`Daily Notes/${dateStr}`);

      if (existingNote) {
        return {
          success: true,
          output: {
            message: `Daily note already exists: ${existingNote.relativePath}`,
            notePath: existingNote.relativePath,
            created: false,
            content: existingNote.content.substring(0, 500) + '...'
          }
        };
      }

      // Create new daily note
      const template = args.template || `# ${dateStr}\n\n## Tasks\n\n## Notes\n\n## Reflections\n\n`;
      const notePath = await kb.createDailyNote(targetDate);

      return {
        success: true,
        output: {
          message: `Daily note created: ${notePath}`,
          notePath,
          date: dateStr,
          created: true
        }
      };
    } catch (error: any) {
      return { success: false, output: `Failed to create daily note: ${error.message}` };
    }
  }
};

export const obsidianStatsTool: ToolDefinition = {
  name: "obsidian_vault_stats",
  description: "Get comprehensive statistics about the Obsidian vault",
  parameters: z.object({
    includeTagStats: z.boolean().optional().describe("Include detailed tag usage statistics"),
    includeRecentNotes: z.boolean().optional().describe("Include recently modified notes")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const vault = kb.getVault();

      if (!vault) {
        return { success: false, output: "Vault not loaded" };
      }

      // Basic stats
      const totalNotes = vault.notes.size;
      const totalTags = vault.tags.size;
      const totalLinks = vault.graph.edges.filter(e => e.type === 'link').length;

      // Calculate more stats
      const totalSize = Array.from(vault.notes.values()).reduce((sum, note) => sum + note.size, 0);
      const avgNoteSize = Math.round(totalSize / totalNotes);

      const oldestNote = Array.from(vault.notes.values())
        .reduce((oldest, note) => note.created < oldest.created ? note : oldest);

      const newestNote = Array.from(vault.notes.values())
        .reduce((newest, note) => note.modified > newest.modified ? note : newest);

      const result: any = {
        vaultName: vault.name,
        vaultPath: vault.path,
        totalNotes,
        totalTags,
        totalLinks,
        totalSize: `${Math.round(totalSize / 1024)}KB`,
        avgNoteSize: `${avgNoteSize} bytes`,
        oldestNote: {
          title: oldestNote.title,
          created: oldestNote.created.toISOString()
        },
        newestNote: {
          title: newestNote.title,
          modified: newestNote.modified.toISOString()
        }
      };

      if (args.includeTagStats) {
        const tagCounts: Record<string, number> = {};
        for (const note of vault.notes.values()) {
          for (const tag of note.tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }

        const topTags = Object.entries(tagCounts)
          .sort(([,a], [,b]) => b - a)
          .map(([tag, count]) => ({ tag, count }));

        result.tagStats = {
          uniqueTags: Object.keys(tagCounts).length,
          topTags
        };
      }

      if (args.includeRecentNotes) {
        const recentNotes = Array.from(vault.notes.values())
          .sort((a, b) => b.modified.getTime() - a.modified.getTime())
          .slice(0, 10)
          .map(note => ({
            title: note.title,
            path: note.relativePath,
            modified: note.modified.toISOString()
          }));

        result.recentNotes = recentNotes;
      }

      return {
        success: true,
        output: result
      };
    } catch (error: any) {
      return { success: false, output: `Failed to get vault stats: ${error.message}` };
    }
  }
};

export const obsidianSetVaultTool: ToolDefinition = {
  name: "obsidian_set_vault_path",
  description: "Set the path to the Obsidian vault to use for operations",
  parameters: z.object({
    vaultPath: z.string().describe("Absolute path to the Obsidian vault directory")
  }),
  async execute(args): Promise<ToolResult> {
    try {
      // Reset global knowledge base
      knowledgeBase = null;

      // Set environment variable
      process.env.OBSIDIAN_VAULT_PATH = args.vaultPath;

      // Test initialization
      const kb = await getKnowledgeBase();

      return {
        success: true,
        output: {
          message: `Vault path set to: ${args.vaultPath}`,
          vaultName: kb.getVault()?.name || 'Unknown',
          notesLoaded: kb.getVault()?.notes.size || 0
        }
      };
    } catch (error: any) {
      return { success: false, output: `Failed to set vault path: ${error.message}` };
    }
  }
};

// ============================================================
// 📚 EXPORT ALL OBSIDIAN TOOLS
// ============================================================

export const obsidianTools: ToolDefinition[] = [
  // Reading tools
  obsidianReadTool,
  obsidianSearchTool,
  obsidianListTool,

  // Writing tools
  obsidianWriteTool,
  obsidianAppendTool,
  obsidianUpdateNoteTool,
  obsidianDeleteNoteTool,

  // Knowledge management
  obsidianTagsTool,
  obsidianLinksTool,
  obsidianFindRelatedTool,
  obsidianSynthesizeTool,

  // Management tools
  obsidianDailyTool,
  obsidianStatsTool,
  obsidianSetVaultTool
];
