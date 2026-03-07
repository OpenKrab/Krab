/**
 * 🦀 Krab — Obsidian Tools
 * ============================================================
 * Tools for interacting with Obsidian vaults and knowledge base
 */

import { z } from "zod";
import { ToolDefinition, ToolResult } from '../core/types.js';
import { ObsidianAIKnowledgeBase, type ObsidianNote } from './knowledge-base.js';
import { logger } from '../utils/logger.js';

// Global knowledge base instance (will be initialized when vault path is set)
let knowledgeBase: ObsidianAIKnowledgeBase | null = null;

// Configuration
let vaultPath: string = process.env.OBSIDIAN_VAULT_PATH || '~/Documents/Obsidian Vault';

// Initialize knowledge base
async function getKnowledgeBase(): Promise<ObsidianAIKnowledgeBase> {
  if (!knowledgeBase) {
    const kb = new ObsidianAIKnowledgeBase(vaultPath.replace('~', process.env.HOME || process.env.USERPROFILE || '~'));
    await kb.initialize();
    knowledgeBase = kb;
  }
  return knowledgeBase;
}
  if (!knowledgeBase) {
    // Resolve home directory
    if (vaultPath.startsWith('~')) {
      vaultPath = vaultPath.replace('~', process.env.HOME || process.env.USERPROFILE || '~');
    }

    knowledgeBase = new ObsidianKnowledgeBase(vaultPath);
    await knowledgeBase.initialize();
  }
  return knowledgeBase;
}

// ============================================================
// 📖 Reading Tools
// ============================================================

export const obsidianReadNoteTool: Tool = {
  name: 'obsidian_read_note',
  description: 'Read the content of a specific Obsidian note by its path or ID',
  parameters: z.object({
    notePath: z.string().describe('Path to the note (e.g., "My Note.md" or "folder/My Note")'),
    includeMetadata: z.boolean().optional().describe('Include metadata like tags, links, and frontmatter')
  }),

  async execute(args: any): Promise<ToolResult> {
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
        result.links = note.links;
        result.frontmatter = note.frontmatter;
        result.backlinks = kb.getBacklinks(note.id).map(n => n.title);
      }

      return { success: true, output: JSON.stringify(result) };
    } catch (error: any) {
      logger.error('[Obsidian] Read note failed:', error);
      return {
        success: false,
        output: `Failed to read note: ${error.message}`
      };
    }
  }
};

export const obsidianSearchNotesTool: ToolDefinition = {
  name: 'obsidian_search_notes',
  description: 'Search for Obsidian notes by content, title, or tags',
  parameters: z.object({
    query: z.string().describe('Search query to match against note content, titles, or tags'),
    tags: z.array(z.string()).optional().describe('Filter by specific tags'),
    limit: z.number().optional().describe('Maximum number of results to return'),
    includeContent: z.boolean().optional().describe('Include full content in results (default: false)')
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const notes = kb.search(args.query, {
        tags: args.tags,
        limit: args.limit || 20
      });

      const results = notes.map(note => ({
        id: note.id,
        title: note.title,
        path: note.relativePath,
        tags: note.tags,
        modified: note.modified.toISOString(),
        ...(args.includeContent && { content: note.content.substring(0, 500) + (note.content.length > 500 ? '...' : '') })
      }));

      return {
        success: true,
        output: {
          query: args.query,
          totalResults: notes.length,
          notes: results
        }
      };
    } catch (error: any) {
      logger.error('[Obsidian] Search failed:', error);
      return {
        success: false,
        output: `Failed to search notes: ${error.message}`
      };
    }
  }
};

export const obsidianListNotesByTagTool: Tool = {
  name: 'obsidian_list_notes_by_tag',
  description: 'List all notes that have a specific tag',
  parameters: z.object({
    tag: z.string().describe('Tag to search for (without #)'),
    includeContent: z.boolean().optional().describe('Include note content in results')
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const notes = kb.getNotesByTag(args.tag);

      const results = notes.map(note => ({
        id: note.id,
        title: note.title,
        path: note.relativePath,
        tags: note.tags,
        modified: note.modified.toISOString(),
        ...(args.includeContent && { content: note.content })
      }));

      return {
        success: true,
        result: {
          tag: args.tag,
          totalNotes: notes.length,
          notes: results
        }
      };
    } catch (error: any) {
      logger.error('[Obsidian] List by tag failed:', error);
      return {
        success: false,
        result: `Failed to list notes by tag: ${error.message}`
      };
    }
  }
};

export const obsidianGetBacklinksTool: Tool = {
  name: 'obsidian_get_backlinks',
  description: 'Get all notes that link to a specific note',
  parameters: z.object({
    noteId: z.string().describe('ID or path of the note to find backlinks for'),
    includeContent: z.boolean().optional().describe('Include content of linking notes')
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const backlinks = kb.getBacklinks(args.noteId);

      const results = backlinks.map(note => ({
        id: note.id,
        title: note.title,
        path: note.relativePath,
        tags: note.tags,
        modified: note.modified.toISOString(),
        ...(args.includeContent && { content: note.content })
      }));

      return {
        success: true,
        result: {
          noteId: args.noteId,
          totalBacklinks: backlinks.length,
          backlinks: results
        }
      };
    } catch (error: any) {
      logger.error('[Obsidian] Get backlinks failed:', error);
      return {
        success: false,
        result: `Failed to get backlinks: ${error.message}`
      };
    }
  }
};

// ============================================================
// ✏️ Writing Tools
// ============================================================

export const obsidianCreateNoteTool: Tool = {
  name: 'obsidian_create_note',
  description: 'Create a new note in the Obsidian vault',
  parameters: z.object({
    title: z.string().describe('Title of the new note'),
    content: z.string().describe('Content of the note (Markdown)'),
    folder: z.string().optional().describe('Folder path within the vault (e.g., "projects" or "inbox/meetings")'),
    tags: z.array(z.string()).optional().describe('Tags to add to the note'),
    frontmatter: z.record(z.any()).optional().describe('Additional frontmatter properties')
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();

      // Build note path
      const folder = args.folder ? `${args.folder}/` : '';
      const filename = args.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
      const notePath = `${folder}${filename}.md`;

      const frontmatter = {
        ...args.frontmatter,
        title: args.title,
        created: new Date().toISOString(),
        ...(args.tags && { tags: args.tags })
      };

      const fullPath = await kb.createNote(notePath, args.content, {
        tags: args.tags || [],
        frontmatter
      });

      return {
        success: true,
        result: {
          message: `Note created successfully`,
          notePath,
          fullPath,
          title: args.title
        }
      };
    } catch (error: any) {
      logger.error('[Obsidian] Create note failed:', error);
      return {
        success: false,
        result: `Failed to create note: ${error.message}`
      };
    }
  }
};

export const obsidianUpdateNoteTool: Tool = {
  name: 'obsidian_update_note',
  description: 'Update the content of an existing note',
  parameters: z.object({
    notePath: z.string().describe('Path to the note to update (e.g., "My Note.md")'),
    content: z.string().describe('New content for the note (will replace existing content)'),
    append: z.boolean().optional().describe('If true, append content instead of replacing')
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();

      if (args.append) {
        await kb.appendToNote(args.notePath, args.content);
        return {
          success: true,
          result: {
            message: `Content appended to note: ${args.notePath}`,
            action: 'append'
          }
        };
      } else {
        await kb.updateNote(args.notePath, args.content);
        return {
          success: true,
          result: {
            message: `Note updated: ${args.notePath}`,
            action: 'replace'
          }
        };
      }
    } catch (error: any) {
      logger.error('[Obsidian] Update note failed:', error);
      return {
        success: false,
        result: `Failed to update note: ${error.message}`
      };
    }
  }
};

export const obsidianDeleteNoteTool: Tool = {
  name: 'obsidian_delete_note',
  description: 'Delete a note from the Obsidian vault',
  parameters: z.object({
    notePath: z.string().describe('Path to the note to delete'),
    confirm: z.boolean().describe('Must be true to confirm deletion')
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      if (!args.confirm) {
        return {
          success: false,
          result: `Deletion not confirmed. Set confirm=true to delete note: ${args.notePath}`
        };
      }

      const kb = await getKnowledgeBase();
      await kb.deleteNote(args.notePath);

      return {
        success: true,
        result: {
          message: `Note deleted: ${args.notePath}`,
          deleted: true
        }
      };
    } catch (error: any) {
      logger.error('[Obsidian] Delete note failed:', error);
      return {
        success: false,
        result: `Failed to delete note: ${error.message}`
      };
    }
  }
};

// ============================================================
// 🧠 Knowledge Management Tools
// ============================================================

export const obsidianCreateLinkedNoteTool: Tool = {
  name: 'obsidian_create_linked_note',
  description: 'Create a new note with links to other notes (knowledge linking)',
  parameters: z.object({
    title: z.string().describe('Title of the new note'),
    content: z.string().describe('Main content of the note'),
    links: z.array(z.string()).describe('List of note titles or IDs to link to'),
    folder: z.string().optional().describe('Folder to create the note in'),
    tags: z.array(z.string()).optional().describe('Tags for the note')
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();

      const fullPath = await kb.createLinkedNote(
        args.title,
        args.content,
        args.links
      );

      // Move to folder if specified
      if (args.folder) {
        // Note: This is a simplified implementation
        // In a full implementation, you'd need to move the file
      }

      return {
        success: true,
        result: {
          message: `Linked note created: ${args.title}`,
          links: args.links,
          fullPath
        }
      };
    } catch (error: any) {
      logger.error('[Obsidian] Create linked note failed:', error);
      return {
        success: false,
        result: `Failed to create linked note: ${error.message}`
      };
    }
  }
};

export const obsidianFindRelatedNotesTool: Tool = {
  name: 'obsidian_find_related_notes',
  description: 'Find notes related to a given note through links and backlinks',
  parameters: z.object({
    noteId: z.string().describe('ID or path of the note to find relations for'),
    depth: z.number().optional().describe('How deep to search for relationships (default: 2)'),
    includeContent: z.boolean().optional().describe('Include content in results')
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const relatedNotes = await kb.findRelatedNotes(args.noteId, args.depth || 2);

      const results = relatedNotes.map(note => ({
        id: note.id,
        title: note.title,
        path: note.relativePath,
        tags: note.tags,
        modified: note.modified.toISOString(),
        ...(args.includeContent && { content: note.content.substring(0, 300) + '...' })
      }));

      return {
        success: true,
        result: {
          noteId: args.noteId,
          depth: args.depth || 2,
          totalRelated: relatedNotes.length,
          relatedNotes: results
        }
      };
    } catch (error: any) {
      logger.error('[Obsidian] Find related notes failed:', error);
      return {
        success: false,
        result: `Failed to find related notes: ${error.message}`
      };
    }
  }
};

export const obsidianGetVaultStatsTool: Tool = {
  name: 'obsidian_get_vault_stats',
  description: 'Get statistics about the Obsidian vault',
  parameters: z.object({}),

  async execute(args: any): Promise<ToolResult> {
    try {
      const kb = await getKnowledgeBase();
      const vault = kb.getVault();

      if (!vault) {
        return {
          success: false,
          result: 'Vault not loaded'
        };
      }

      // Calculate statistics
      const totalNotes = vault.notes.size;
      const totalTags = vault.tags.size;
      const totalLinks = vault.graph.edges.filter(e => e.type === 'link').length;

      // Most used tags
      const tagCounts = Array.from(vault.tags.entries())
        .map(([tag, notes]) => ({ tag, count: notes.length }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Recent notes
      const recentNotes = Array.from(vault.notes.values())
        .sort((a, b) => b.modified.getTime() - a.modified.getTime())
        .slice(0, 5)
        .map(note => ({
          title: note.title,
          modified: note.modified.toISOString()
        }));

      return {
        success: true,
        result: {
          vaultName: vault.name,
          vaultPath: vault.path,
          totalNotes,
          totalTags,
          totalLinks,
          topTags: tagCounts,
          recentNotes
        }
      };
    } catch (error: any) {
      logger.error('[Obsidian] Get vault stats failed:', error);
      return {
        success: false,
        result: `Failed to get vault statistics: ${error.message}`
      };
    }
  }
};

// ============================================================
// 🛠️ Utility Tools
// ============================================================

export const obsidianSetVaultPathTool: Tool = {
  name: 'obsidian_set_vault_path',
  description: 'Set the path to the Obsidian vault to use',
  parameters: z.object({
    vaultPath: z.string().describe('Absolute path to the Obsidian vault directory')
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      vaultPath = args.vaultPath;

      // Close existing knowledge base
      if (knowledgeBase) {
        knowledgeBase.close();
        knowledgeBase = null;
      }

      // Initialize new knowledge base
      const kb = await getKnowledgeBase();

      return {
        success: true,
        result: {
          message: `Vault path set to: ${vaultPath}`,
          vaultName: kb.getVault()?.name || 'Unknown'
        }
      };
    } catch (error: any) {
      logger.error('[Obsidian] Set vault path failed:', error);
      return {
        success: false,
        result: `Failed to set vault path: ${error.message}`
      };
    }
  }
};

// ============================================================
// 📚 Tool Collection
// ============================================================

export const obsidianTools: Tool[] = [
  // Reading tools
  obsidianReadNoteTool,
  obsidianSearchNotesTool,
  obsidianListNotesByTagTool,
  obsidianGetBacklinksTool,

  // Writing tools
  obsidianCreateNoteTool,
  obsidianUpdateNoteTool,
  obsidianDeleteNoteTool,

  // Knowledge management
  obsidianCreateLinkedNoteTool,
  obsidianFindRelatedNotesTool,
  obsidianGetVaultStatsTool,

  // Utilities
  obsidianSetVaultPathTool
];

// Export functions for programmatic use
export {
  getKnowledgeBase,
  setVaultPath
};

function setVaultPath(path: string): void {
  vaultPath = path;
  if (knowledgeBase) {
    knowledgeBase.close();
    knowledgeBase = null;
  }
}
