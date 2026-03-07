/**
 * 🦀 Krab — Obsidian CLI Commands (Knowledge Base)
 * ============================================================
 * Obsidian-style knowledge management commands for the CLI
 */

import { Command } from "commander";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../core/krab-config.js";
import {
  ObsidianAIKnowledgeBase,
  type ObsidianNote,
} from "../obsidian/knowledge-base.js";
import pc from "picocolors";

// Global knowledge base instance
let knowledgeBase: ObsidianAIKnowledgeBase | null = null;

async function getKnowledgeBase(): Promise<ObsidianAIKnowledgeBase> {
  if (!knowledgeBase) {
    const config = loadConfig();
    const vaultPath = config.obsidian?.vaultPath ||
      process.env.OBSIDIAN_VAULT_PATH ||
      "~/Documents/Obsidian Vault";

    knowledgeBase = new ObsidianAIKnowledgeBase(vaultPath.replace('~', process.env.HOME || process.env.USERPROFILE || '~'));
    await knowledgeBase.initialize();
  }
  return knowledgeBase;
}

function formatNoteList(notes: ObsidianNote[], showContent: boolean = false): string {
  if (notes.length === 0) {
    return pc.dim("No notes found.");
  }

  return notes.map((note, index) => {
    const date = note.modified.toLocaleDateString();
    const time = note.modified.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tags = note.tags.length > 0 ? ` ${pc.cyan(note.tags.map(t => `#${t}`).join(' '))}` : '';

    let output = `${index + 1}. ${pc.bold(note.title)}\n`;
    output += `   ${pc.dim(note.relativePath)} • ${date} ${time}${tags}\n`;

    if (showContent) {
      const content = note.content.length > 200 ? note.content.substring(0, 200) + '...' : note.content;
      output += `   ${pc.gray(content.replace(/\n/g, '\n   '))}\n`;
    }

    return output;
  }).join('\n');
}

// ── Search Command ───────────────────────────────
export const obsidianSearchCommand = new Command("obsidian:search")
  .description("Search Obsidian notes with advanced options")
  .argument("<query>", "Search query")
  .option("-t, --tags <tags>", "Filter by tags (comma-separated)")
  .option("-l, --limit <number>", "Limit results", "20")
  .option("-c, --content", "Show content previews")
  .option("-s, --semantic", "Use semantic search")
  .action(async (query: string, options: any) => {
    try {
      const kb = await getKnowledgeBase();

      console.log(pc.cyan(`🔍 Searching for: "${query}"`));
      if (options.semantic) {
        console.log(pc.dim("Using semantic search..."));
      }

      const tagFilter = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined;
      const limit = parseInt(options.limit);

      let results: ObsidianNote[];
      if (options.semantic) {
        const semanticResults = kb.semanticSearch(query, {
          limit,
          includeContext: options.content
        });
        results = semanticResults.map(r => r.note);
      } else {
        results = kb.search(query, {
          tags: tagFilter,
          limit
        });
      }

      console.log(pc.green(`\n📄 Found ${results.length} notes:\n`));
      console.log(formatNoteList(results, options.content));

      if (tagFilter) {
        console.log(pc.dim(`\nFiltered by tags: ${tagFilter.join(', ')}`));
      }

    } catch (error: any) {
      logger.error("Obsidian search failed:", error);
      console.error(pc.red(`❌ Search failed: ${error.message}`));
    }
  });

// ── Read Command ───────────────────────────────
export const obsidianReadCommand = new Command("obsidian:read")
  .description("Read a specific Obsidian note")
  .argument("<notePath>", "Path to the note")
  .option("-m, --metadata", "Show metadata (tags, links, frontmatter)")
  .option("-b, --backlinks", "Show notes that link to this note")
  .action(async (notePath: string, options: any) => {
    try {
      const kb = await getKnowledgeBase();
      const note = kb.getNote(notePath.replace('.md', ''));

      if (!note) {
        console.error(pc.red(`❌ Note not found: ${notePath}`));
        return;
      }

      console.log(pc.cyan(`📖 ${note.title}`));
      console.log(pc.dim(`Path: ${note.relativePath}`));
      console.log(pc.dim(`Modified: ${note.modified.toLocaleString()}`));
      console.log(pc.dim(`Size: ${note.size} bytes`));

      if (note.tags.length > 0) {
        console.log(pc.dim(`Tags: ${note.tags.map(t => `#${t}`).join(' ')}`));
      }

      console.log(pc.gray('\n' + '='.repeat(50) + '\n'));

      // Show frontmatter if requested
      if (options.metadata && Object.keys(note.frontmatter).length > 0) {
        console.log(pc.yellow('--- Frontmatter ---'));
        console.log(JSON.stringify(note.frontmatter, null, 2));
        console.log(pc.yellow('--- End Frontmatter ---\n'));
      }

      console.log(note.content);

      // Show links if requested
      if (options.metadata && note.links.length > 0) {
        console.log(pc.yellow('\n--- Links ---'));
        note.links.forEach(link => {
          console.log(`• ${link.type}: ${link.target}`);
        });
      }

      // Show backlinks if requested
      if (options.backlinks) {
        const backlinks = kb.getBacklinks(note.id);
        if (backlinks.length > 0) {
          console.log(pc.yellow('\n--- Backlinks ---'));
          backlinks.forEach(link => {
            console.log(`• ${link.title} (${link.relativePath})`);
          });
        }
      }

    } catch (error: any) {
      logger.error("Obsidian read failed:", error);
      console.error(pc.red(`❌ Read failed: ${error.message}`));
    }
  });

// ── Create Command ───────────────────────────────
export const obsidianCreateCommand = new Command("obsidian:create")
  .description("Create a new Obsidian note")
  .argument("<title>", "Note title")
  .option("-c, --content <content>", "Note content")
  .option("-f, --folder <folder>", "Target folder")
  .option("-t, --tags <tags>", "Tags (comma-separated)")
  .option("-l, --links <links>", "Link to other notes (comma-separated)")
  .option("-T, --template <template>", "Use template (project, meeting, idea)")
  .action(async (title: string, options: any) => {
    try {
      const kb = await getKnowledgeBase();

      let content = options.content || `# ${title}\n\n`;
      const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];
      const links = options.links ? options.links.split(',').map((l: string) => l.trim()) : [];

      // Apply template
      if (options.template) {
        const config = loadConfig();
        const templates = config.obsidian?.templates || {};

        switch (options.template) {
          case 'project':
            content = templates.project ||
              `# ${title}\n\n## Goals\n\n## Tasks\n\n## Notes\n\n## Resources\n\n`;
            if (!tags.includes('project')) tags.push('project');
            break;
          case 'meeting':
            content = templates.meeting ||
              `# ${title}\n\n## Attendees\n\n## Agenda\n\n## Notes\n\n## Action Items\n\n`;
            if (!tags.includes('meeting')) tags.push('meeting');
            break;
          case 'idea':
            content = templates.idea ||
              `# ${title}\n\n## Problem\n\n## Solution\n\n## Next Steps\n\n`;
            if (!tags.includes('idea')) tags.push('idea');
            break;
        }
      }

      const frontmatter: any = {
        created: new Date().toISOString(),
        ...(tags.length > 0 && { tags })
      };

      let notePath: string;
      if (links.length > 0) {
        // Create linked note
        notePath = await kb.createLinkedNote(title, content, links);
      } else {
        // Create regular note
        const folder = options.folder ? `${options.folder}/` : '';
        const filename = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
        const fullPath = `${folder}${filename}.md`;

        notePath = await kb.createNote(fullPath, content, {
          tags,
          frontmatter
        });
      }

      console.log(pc.green(`✅ Note created: ${notePath}`));
      if (links.length > 0) {
        console.log(pc.dim(`Linked to: ${links.join(', ')}`));
      }

    } catch (error: any) {
      logger.error("Obsidian create failed:", error);
      console.error(pc.red(`❌ Create failed: ${error.message}`));
    }
  });

// ── Daily Command ───────────────────────────────
export const obsidianDailyCommand = new Command("obsidian:daily")
  .description("Create or open today's daily note")
  .option("-d, --date <date>", "Specific date (YYYY-MM-DD)")
  .option("-t, --template <template>", "Custom template content")
  .action(async (options: any) => {
    try {
      const kb = await getKnowledgeBase();
      const targetDate = options.date ? new Date(options.date) : new Date();

      const dateStr = targetDate.toISOString().split('T')[0];
      const existingNote = kb.getNote(`Daily Notes/${dateStr}`);

      if (existingNote) {
        console.log(pc.cyan(`📅 Daily note already exists: ${existingNote.relativePath}`));
        console.log(pc.dim(`Modified: ${existingNote.modified.toLocaleString()}`));

        // Show recent content
        const lines = existingNote.content.split('\n').slice(0, 10);
        console.log(pc.gray('\nRecent content:'));
        console.log(lines.join('\n'));
      } else {
        const template = options.template ||
          `# ${dateStr}\n\n## Tasks\n\n## Notes\n\n## Reflections\n\n`;

        const notePath = await kb.createDailyNote(targetDate);
        console.log(pc.green(`✅ Daily note created: ${notePath}`));
      }

    } catch (error: any) {
      logger.error("Obsidian daily failed:", error);
      console.error(pc.red(`❌ Daily note failed: ${error.message}`));
    }
  });

// ── Tags Command ───────────────────────────────
export const obsidianTagsCommand = new Command("obsidian:tags")
  .description("List and manage tags in the vault")
  .option("-s, --stats", "Show tag usage statistics")
  .option("-t, --tag <tag>", "Show notes with specific tag")
  .option("-l, --limit <number>", "Limit results", "20")
  .action(async (options: any) => {
    try {
      const kb = await getKnowledgeBase();

      if (options.tag) {
        // Show notes with specific tag
        const notes = kb.getNotesByTag(options.tag);
        console.log(pc.cyan(`🏷️ Notes tagged with "${options.tag}":`));
        console.log(formatNoteList(notes.slice(0, parseInt(options.limit)), false));
        console.log(pc.dim(`\nTotal: ${notes.length} notes`));
      } else {
        // Show all tags
        const vault = kb.getVault();
        if (!vault) {
          console.error(pc.red("❌ Vault not loaded"));
          return;
        }

        const tagCounts: Record<string, number> = {};
        for (const note of vault.notes.values()) {
          for (const tag of note.tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }

        const sortedTags = Object.entries(tagCounts)
          .sort(([,a], [,b]) => b - a);

        console.log(pc.cyan("🏷️ Tags in vault:"));
        console.log('');

        if (options.stats) {
          sortedTags.slice(0, parseInt(options.limit)).forEach(([tag, count]) => {
            const percentage = ((count / vault.notes.size) * 100).toFixed(1);
            console.log(`${pc.bold(tag)}: ${count} notes (${percentage}%)`);
          });
        } else {
          const tags = sortedTags.map(([tag]) => tag);
          console.log(tags.slice(0, parseInt(options.limit)).join(', '));
        }

        console.log(pc.dim(`\nTotal unique tags: ${sortedTags.length}`));
      }

    } catch (error: any) {
      logger.error("Obsidian tags failed:", error);
      console.error(pc.red(`❌ Tags command failed: ${error.message}`));
    }
  });

// ── Graph Command ───────────────────────────────
export const obsidianGraphCommand = new Command("obsidian:graph")
  .description("Analyze and display knowledge graph")
  .option("-c, --central", "Show most central notes")
  .option("-C, --clusters", "Show knowledge clusters")
  .option("-l, --limit <number>", "Limit results", "10")
  .action(async (options: any) => {
    try {
      const kb = await getKnowledgeBase();

      if (options.central) {
        const centralNodes = kb.getCentralKnowledgeNodes();
        console.log(pc.cyan("🎯 Most central notes in knowledge graph:"));
        console.log('');

        centralNodes.slice(0, parseInt(options.limit)).forEach((node, index) => {
          console.log(`${index + 1}. ${pc.bold(node.label)} (${node.properties.path})`);
          if (node.properties.tags) {
            console.log(`   Tags: ${node.properties.tags.map((t: string) => `#${t}`).join(' ')}`);
          }
        });
      } else if (options.clusters) {
        const clusters = kb.discoverKnowledgeClusters();
        console.log(pc.cyan("🔗 Knowledge clusters:"));
        console.log('');

        clusters.slice(0, parseInt(options.limit)).forEach((cluster, index) => {
          console.log(`${pc.bold(`Cluster ${index + 1}`)} (${cluster.length} notes):`);
          cluster.slice(0, 5).forEach(note => {
            console.log(`  • ${note.label}`);
          });
          if (cluster.length > 5) {
            console.log(`  ... and ${cluster.length - 5} more`);
          }
          console.log('');
        });
      } else {
        const graph = kb.getKnowledgeGraph();
        console.log(pc.cyan("📊 Knowledge Graph Statistics:"));
        console.log(`Nodes: ${graph.nodes.length}`);
        console.log(`Edges: ${graph.edges.length}`);

        const nodeTypes = graph.nodes.reduce((acc, node) => {
          acc[node.type] = (acc[node.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        console.log(pc.dim("\nNode types:"));
        Object.entries(nodeTypes).forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });

        const edgeTypes = graph.edges.reduce((acc, edge) => {
          acc[edge.type] = (acc[edge.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        console.log(pc.dim("\nEdge types:"));
        Object.entries(edgeTypes).forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
      }

    } catch (error: any) {
      logger.error("Obsidian graph failed:", error);
      console.error(pc.red(`❌ Graph analysis failed: ${error.message}`));
    }
  });

// ── Related Command ───────────────────────────────
export const obsidianRelatedCommand = new Command("obsidian:related")
  .description("Find notes related to a specific note")
  .argument("<notePath>", "Path to the note")
  .option("-d, --depth <number>", "Search depth", "2")
  .option("-m, --method <method>", "Search method (links, semantic, both)", "both")
  .option("-c, --content", "Show content previews")
  .action(async (notePath: string, options: any) => {
    try {
      const kb = await getKnowledgeBase();

      console.log(pc.cyan(`🔗 Finding notes related to: ${notePath}`));

      const relatedNotes = await kb.findRelatedNotes(
        notePath.replace('.md', ''),
        parseInt(options.depth)
      );

      console.log(pc.green(`\n📄 Found ${relatedNotes.length} related notes:\n`));
      console.log(formatNoteList(relatedNotes, options.content));

      console.log(pc.dim(`\nSearch method: ${options.method}, depth: ${options.depth}`));

    } catch (error: any) {
      logger.error("Obsidian related failed:", error);
      console.error(pc.red(`❌ Find related failed: ${error.message}`));
    }
  });

// ── Synthesize Command ───────────────────────────────
export const obsidianSynthesizeCommand = new Command("obsidian:synthesize")
  .description("Synthesize knowledge about a topic from related notes")
  .argument("<topic>", "Topic to synthesize")
  .option("-r, --related", "Show related notes used")
  .option("-m, --max-notes <number>", "Maximum notes to analyze", "10")
  .action(async (topic: string, options: any) => {
    try {
      const kb = await getKnowledgeBase();

      console.log(pc.cyan(`🧠 Synthesizing knowledge about: "${topic}"`));

      const synthesis = await kb.synthesizeKnowledge(topic);

      console.log(pc.bold('\n📋 Summary:'));
      console.log(synthesis.summary);

      if (synthesis.keyPoints.length > 0) {
        console.log(pc.bold('\n🔑 Key Points:'));
        synthesis.keyPoints.forEach((point, index) => {
          console.log(`${index + 1}. ${point}`);
        });
      }

      if (options.related) {
        console.log(pc.bold(`\n📚 Related Notes (${synthesis.relatedNotes.length}):`));
        synthesis.relatedNotes.slice(0, parseInt(options.maxNotes)).forEach(note => {
          console.log(`• ${note.title} (${note.relativePath})`);
        });
      }

    } catch (error: any) {
      logger.error("Obsidian synthesize failed:", error);
      console.error(pc.red(`❌ Synthesis failed: ${error.message}`));
    }
  });

// ── Stats Command ───────────────────────────────
export const obsidianStatsCommand = new Command("obsidian:stats")
  .description("Show comprehensive vault statistics")
  .option("-t, --tags", "Include detailed tag statistics")
  .option("-r, --recent", "Include recently modified notes")
  .action(async (options: any) => {
    try {
      const kb = await getKnowledgeBase();
      const vault = kb.getVault();

      if (!vault) {
        console.error(pc.red("❌ Vault not loaded"));
        return;
      }

      console.log(pc.cyan("📊 Obsidian Vault Statistics"));
      console.log(pc.gray('='.repeat(50)));

      console.log(`📁 Vault: ${vault.name}`);
      console.log(`📍 Path: ${vault.path}`);
      console.log(`📄 Total Notes: ${vault.notes.size}`);
      console.log(`🏷️ Total Tags: ${vault.tags.size}`);
      console.log(`🔗 Total Links: ${vault.graph.edges.filter(e => e.type === 'link').length}`);

      // Calculate additional stats
      const notesArray = Array.from(vault.notes.values());
      const totalSize = notesArray.reduce((sum, note) => sum + (note.size || 0), 0);
      console.log(`💾 Total Size: ${Math.round(totalSize / 1024)}KB`);

      const oldestNote = notesArray
        .reduce((oldest, note) => note.created < oldest.created ? note : oldest);
      const newestNote = notesArray
        .reduce((newest, note) => note.modified > newest.modified ? note : newest);

      console.log(`📅 Oldest Note: ${oldestNote.title} (${oldestNote.created.toLocaleDateString()})`);
      console.log(`🆕 Newest Note: ${newestNote.title} (${newestNote.modified.toLocaleDateString()})`);

      if (options.tags) {
        console.log(pc.bold('\n🏷️ Tag Statistics:'));
        const tagCounts: Record<string, number> = {};
        for (const note of vault.notes.values()) {
          for (const tag of note.tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }

        const topTags = Object.entries(tagCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 15);

        topTags.forEach(([tag, count]) => {
          const percentage = ((count / vault.notes.size) * 100).toFixed(1);
          console.log(`  ${tag}: ${count} notes (${percentage}%)`);
        });
      }

      if (options.recent) {
        console.log(pc.bold('\n🕒 Recently Modified Notes:'));
        const recentNotes = notesArray
          .sort((a, b) => b.modified.getTime() - a.modified.getTime())
          .slice(0, 10);

        recentNotes.forEach(note => {
          console.log(`  ${note.title} (${note.modified.toLocaleDateString()})`);
        });
      }

    } catch (error: any) {
      logger.error("Obsidian stats failed:", error);
      console.error(pc.red(`❌ Stats failed: ${error.message}`));
    }
  });

// ── Vault Command ───────────────────────────────
export const obsidianVaultCommand = new Command("obsidian:vault")
  .description("Manage Obsidian vault configuration")
  .option("-s, --set-path <path>", "Set vault path")
  .option("-i, --info", "Show vault information")
  .option("-r, --refresh", "Refresh vault index")
  .action(async (options: any) => {
    try {
      if (options.setPath) {
        process.env.OBSIDIAN_VAULT_PATH = options.setPath;
        knowledgeBase = null; // Reset to reload with new path

        const kb = await getKnowledgeBase();
        console.log(pc.green(`✅ Vault path set to: ${options.setPath}`));
        console.log(pc.dim(`Loaded ${kb.getVault()?.notes.size || 0} notes`));
      } else if (options.info) {
        const kb = await getKnowledgeBase();
        const vault = kb.getVault();

        if (vault) {
          console.log(pc.cyan("📁 Vault Information"));
          console.log(`Name: ${vault.name}`);
          console.log(`Path: ${vault.path}`);
          console.log(`Notes: ${vault.notes.size}`);
          console.log(`Tags: ${vault.tags.size}`);
          console.log(`Backlinks: ${vault.backlinks.size}`);
        } else {
          console.log(pc.red("❌ Vault not loaded"));
        }
      } else if (options.refresh) {
        console.log(pc.dim("🔄 Refreshing vault index..."));
        knowledgeBase = null; // Reset to reload

        const startTime = Date.now();
        const kb = await getKnowledgeBase();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(pc.green(`✅ Vault refreshed in ${elapsed}s`));
        console.log(pc.dim(`Indexed ${kb.getVault()?.notes.size || 0} notes`));
      } else {
        console.log(pc.cyan("🦀 Krab Obsidian Integration"));
        console.log("");
        console.log("Commands:");
        console.log("  search <query>     Search notes");
        console.log("  read <path>        Read a note");
        console.log("  create <title>     Create a note");
        console.log("  daily              Open/create daily note");
        console.log("  tags               List tags");
        console.log("  graph              Analyze knowledge graph");
        console.log("  related <path>     Find related notes");
        console.log("  synthesize <topic> Synthesize knowledge");
        console.log("  stats              Show vault statistics");
        console.log("");
        console.log("Use 'krab obsidian:<command> --help' for more details.");
      }

    } catch (error: any) {
      logger.error("Obsidian vault command failed:", error);
      console.error(pc.red(`❌ Command failed: ${error.message}`));
    }
  });

// ── Export Main Command ───────────────────────────────
export const obsidianCommand = new Command("obsidian")
  .description("🦀 Obsidian Knowledge Base Integration")
  .addCommand(obsidianSearchCommand)
  .addCommand(obsidianReadCommand)
  .addCommand(obsidianCreateCommand)
  .addCommand(obsidianDailyCommand)
  .addCommand(obsidianTagsCommand)
  .addCommand(obsidianGraphCommand)
  .addCommand(obsidianRelatedCommand)
  .addCommand(obsidianSynthesizeCommand)
  .addCommand(obsidianStatsCommand)
  .addCommand(obsidianVaultCommand);
