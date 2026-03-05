// ============================================================
// 🦀 Krab — Built-in Tool: Obsidian Integration (Knowledge Base)
// Read, Write, Search, and Manage your Obsidian Vault
// ============================================================
import { z } from "zod";
import { readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises";
import { resolve, join, relative, basename, extname, dirname } from "node:path";
import type { ToolDefinition, ToolResult } from "../../core/types.js";

// ── Helpers ────────────────────────────────────────────────

function getVaultPath(): string {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (!vaultPath) {
    throw new Error(
      "OBSIDIAN_VAULT_PATH is not set. Please set it in .env to your Obsidian vault directory.",
    );
  }
  return resolve(vaultPath);
}

/** Ensure a path is within the vault (security) */
function ensureInsideVault(targetPath: string, vaultRoot: string): string {
  const resolved = resolve(vaultRoot, targetPath);
  if (!resolved.startsWith(vaultRoot)) {
    throw new Error(
      `Security: Path "${targetPath}" is outside the vault boundary.`,
    );
  }
  return resolved;
}

/** Recursively walk a directory and collect .md files */
async function walkMarkdown(
  dir: string,
  maxDepth: number = 10,
  currentDepth: number = 0,
): Promise<string[]> {
  if (currentDepth > maxDepth) return [];

  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      // Skip hidden directories and .obsidian config
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;

      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        const sub = await walkMarkdown(fullPath, maxDepth, currentDepth + 1);
        files.push(...sub);
      } else if (
        entry.isFile() &&
        extname(entry.name).toLowerCase() === ".md"
      ) {
        files.push(fullPath);
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return files;
}

/** Extract frontmatter (YAML between ---) */
function extractFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      result[key] = val;
    }
  }
  return result;
}

/** Extract all [[wikilinks]] from content */
function extractWikilinks(content: string): string[] {
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return Array.from(new Set(links));
}

/** Extract all #tags from content */
function extractTags(content: string): string[] {
  // Match #tag but not inside code blocks or URLs
  const regex = /(?:^|\s)#([a-zA-Z0-9_\-/]+)/g;
  const tags: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    tags.push(match[1]);
  }
  return Array.from(new Set(tags));
}

/** Simple text search scoring */
function scoreMatch(content: string, query: string): number {
  const lower = content.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  let score = 0;
  for (const term of terms) {
    // Title/filename match gets higher weight
    const count = (
      lower.match(
        new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      ) || []
    ).length;
    score += count;
  }
  return score;
}

/** Get today's date in YYYY-MM-DD format */
function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

// ════════════════════════════════════════════════════════════
// 📖 OBSIDIAN READ — Read a note from the vault
// ════════════════════════════════════════════════════════════
export const obsidianReadTool: ToolDefinition = {
  name: "obsidian_read",
  description:
    "Read a note from the Obsidian vault. Provide the note path relative to vault root (e.g. 'Projects/my-note.md' or just 'my-note'). Returns the full markdown content, frontmatter, tags, and outgoing links.",
  parameters: z.object({
    path: z
      .string()
      .describe(
        "Path to the note relative to vault root. Can omit .md extension.",
      ),
    maxLines: z
      .number()
      .optional()
      .default(500)
      .describe("Maximum lines to return"),
  }),
  sideEffect: false,
  requireApproval: false,
  execute: async (args): Promise<ToolResult> => {
    try {
      const vaultRoot = getVaultPath();
      let notePath = args.path;

      // Auto-append .md if missing
      if (!notePath.endsWith(".md")) {
        notePath += ".md";
      }

      const fullPath = ensureInsideVault(notePath, vaultRoot);
      const content = await readFile(fullPath, "utf-8");

      const lines = content.split("\n");
      const truncated =
        lines.length > args.maxLines
          ? lines.slice(0, args.maxLines).join("\n") +
            `\n\n... (truncated, ${lines.length} total lines)`
          : content;

      // Extract metadata
      const frontmatter = extractFrontmatter(content);
      const tags = extractTags(content);
      const links = extractWikilinks(content);
      const relativePath = relative(vaultRoot, fullPath);

      const metadata = [
        `📄 **Note:** ${relativePath}`,
        tags.length > 0
          ? `🏷️ **Tags:** ${tags.map((t) => `#${t}`).join(", ")}`
          : "",
        links.length > 0
          ? `🔗 **Links:** ${links.map((l) => `[[${l}]]`).join(", ")}`
          : "",
        frontmatter ? `📋 **Frontmatter:** ${JSON.stringify(frontmatter)}` : "",
        `---`,
        truncated,
      ]
        .filter(Boolean)
        .join("\n");

      return { success: true, output: metadata };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
};

// ════════════════════════════════════════════════════════════
// ✍️ OBSIDIAN WRITE — Create or update a note in the vault
// ════════════════════════════════════════════════════════════
export const obsidianWriteTool: ToolDefinition = {
  name: "obsidian_write",
  description:
    "Create or overwrite a note in the Obsidian vault. Supports frontmatter, tags, and wikilinks. Creates parent directories if needed.",
  parameters: z.object({
    path: z
      .string()
      .describe(
        "Path to the note relative to vault root (e.g. 'Projects/new-idea.md')",
      ),
    content: z.string().describe("Full markdown content for the note"),
    createDirs: z
      .boolean()
      .optional()
      .default(true)
      .describe("Create parent directories if they don't exist"),
  }),
  sideEffect: true,
  requireApproval: true,
  execute: async (args): Promise<ToolResult> => {
    try {
      const vaultRoot = getVaultPath();
      let notePath = args.path;
      if (!notePath.endsWith(".md")) notePath += ".md";

      const fullPath = ensureInsideVault(notePath, vaultRoot);

      // Create parent directories if needed
      if (args.createDirs) {
        await mkdir(dirname(fullPath), { recursive: true });
      }

      await writeFile(fullPath, args.content, "utf-8");

      const relativePath = relative(vaultRoot, fullPath);
      const charCount = args.content.length;
      const lineCount = args.content.split("\n").length;

      return {
        success: true,
        output: `✅ Written note: ${relativePath} (${lineCount} lines, ${charCount} chars)`,
      };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
};

// ════════════════════════════════════════════════════════════
// ➕ OBSIDIAN APPEND — Append content to an existing note
// ════════════════════════════════════════════════════════════
export const obsidianAppendTool: ToolDefinition = {
  name: "obsidian_append",
  description:
    "Append content to an existing note in the Obsidian vault. Useful for adding entries to daily notes, journals, or running logs.",
  parameters: z.object({
    path: z.string().describe("Path to the note relative to vault root"),
    content: z.string().describe("Content to append"),
    separator: z
      .string()
      .optional()
      .default("\n\n")
      .describe("Separator between existing content and new content"),
  }),
  sideEffect: true,
  requireApproval: true,
  execute: async (args): Promise<ToolResult> => {
    try {
      const vaultRoot = getVaultPath();
      let notePath = args.path;
      if (!notePath.endsWith(".md")) notePath += ".md";

      const fullPath = ensureInsideVault(notePath, vaultRoot);

      let existing = "";
      try {
        existing = await readFile(fullPath, "utf-8");
      } catch {
        // File doesn't exist yet, create it
        await mkdir(dirname(fullPath), { recursive: true });
      }

      const newContent = existing
        ? existing + args.separator + args.content
        : args.content;

      await writeFile(fullPath, newContent, "utf-8");

      const relativePath = relative(vaultRoot, fullPath);
      return {
        success: true,
        output: `✅ Appended ${args.content.length} chars to: ${relativePath}`,
      };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
};

// ════════════════════════════════════════════════════════════
// 🔍 OBSIDIAN SEARCH — Full-text search across the vault
// ════════════════════════════════════════════════════════════
export const obsidianSearchTool: ToolDefinition = {
  name: "obsidian_search",
  description:
    "Search across all notes in the Obsidian vault by keyword/phrase. Returns matching notes ranked by relevance with context snippets.",
  parameters: z.object({
    query: z.string().describe("Search query (keywords or phrase)"),
    maxResults: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of results to return"),
    folder: z
      .string()
      .optional()
      .describe(
        "Optional folder to limit search scope (e.g. 'Projects' or 'Daily')",
      ),
    includeContent: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include a snippet of matching content"),
  }),
  sideEffect: false,
  requireApproval: false,
  execute: async (args): Promise<ToolResult> => {
    try {
      const vaultRoot = getVaultPath();
      const searchDir = args.folder
        ? ensureInsideVault(args.folder, vaultRoot)
        : vaultRoot;

      const allFiles = await walkMarkdown(searchDir);

      if (allFiles.length === 0) {
        return {
          success: true,
          output: "No markdown files found in the vault.",
        };
      }

      // Score each file
      const scored: {
        path: string;
        score: number;
        snippet: string;
        tags: string[];
      }[] = [];

      const queryLower = args.query.toLowerCase();
      const searchTerms = queryLower.split(/\s+/).filter(Boolean);

      for (const filePath of allFiles) {
        try {
          const content = await readFile(filePath, "utf-8");
          const fileName = basename(filePath, ".md").toLowerCase();

          let score = 0;

          // Filename match (high weight)
          for (const term of searchTerms) {
            if (fileName.includes(term)) score += 10;
          }

          // Content match
          score += scoreMatch(content, args.query);

          // Tag match
          const tags = extractTags(content);
          for (const term of searchTerms) {
            if (tags.some((t) => t.toLowerCase().includes(term))) score += 5;
          }

          if (score > 0) {
            // Extract context snippet around first match
            let snippet = "";
            if (args.includeContent) {
              const idx = content.toLowerCase().indexOf(queryLower);
              if (idx >= 0) {
                const start = Math.max(0, idx - 80);
                const end = Math.min(
                  content.length,
                  idx + queryLower.length + 80,
                );
                snippet = content.slice(start, end).replace(/\n/g, " ").trim();
                if (start > 0) snippet = "..." + snippet;
                if (end < content.length) snippet += "...";
              } else {
                // Fall back to first non-frontmatter content
                const body = content
                  .replace(/^---\n[\s\S]*?\n---\n?/, "")
                  .trim();
                snippet = body.slice(0, 120).replace(/\n/g, " ");
                if (body.length > 120) snippet += "...";
              }
            }

            scored.push({
              path: relative(vaultRoot, filePath),
              score,
              snippet,
              tags,
            });
          }
        } catch {
          // Skip unreadable files
        }
      }

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);
      const results = scored.slice(0, args.maxResults);

      if (results.length === 0) {
        return {
          success: true,
          output: `No notes found matching "${args.query}".`,
        };
      }

      const output = [
        `🔍 Found ${results.length} note(s) matching "${args.query}":`,
        "",
        ...results.map((r, i) => {
          const parts = [`${i + 1}. **${r.path}** (score: ${r.score})`];
          if (r.tags.length > 0) {
            parts.push(`   🏷️ ${r.tags.map((t) => `#${t}`).join(", ")}`);
          }
          if (r.snippet) {
            parts.push(`   > ${r.snippet}`);
          }
          return parts.join("\n");
        }),
      ].join("\n");

      return { success: true, output };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
};

// ════════════════════════════════════════════════════════════
// 📂 OBSIDIAN LIST — List notes and folders in the vault
// ════════════════════════════════════════════════════════════
export const obsidianListTool: ToolDefinition = {
  name: "obsidian_list",
  description:
    "List notes and folders in the Obsidian vault. Can list a specific folder or the vault root. Shows file sizes and modification times.",
  parameters: z.object({
    path: z
      .string()
      .optional()
      .default("")
      .describe("Folder path relative to vault root (empty = vault root)"),
    recursive: z
      .boolean()
      .optional()
      .default(false)
      .describe("List files recursively"),
    onlyMarkdown: z
      .boolean()
      .optional()
      .default(false)
      .describe("Only show .md files"),
  }),
  sideEffect: false,
  requireApproval: false,
  execute: async (args): Promise<ToolResult> => {
    try {
      const vaultRoot = getVaultPath();
      const targetDir = args.path
        ? ensureInsideVault(args.path, vaultRoot)
        : vaultRoot;

      if (args.recursive) {
        const files = await walkMarkdown(targetDir);
        const items = files.map((f) => relative(vaultRoot, f));

        if (items.length === 0) {
          return { success: true, output: "No markdown files found." };
        }

        const output = [
          `📂 Vault: ${relative(vaultRoot, targetDir) || "/"}`,
          `Found ${items.length} markdown file(s):`,
          "",
          ...items.map((f) => `  📄 ${f}`),
        ].join("\n");

        return { success: true, output };
      }

      // Non-recursive listing
      const entries = await readdir(targetDir, { withFileTypes: true });
      const items: string[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;

        if (entry.isDirectory()) {
          items.push(`  📁 ${entry.name}/`);
        } else if (
          !args.onlyMarkdown ||
          extname(entry.name).toLowerCase() === ".md"
        ) {
          const fileStat = await stat(join(targetDir, entry.name));
          const sizeKB = (fileStat.size / 1024).toFixed(1);
          items.push(`  📄 ${entry.name} (${sizeKB} KB)`);
        }
      }

      if (items.length === 0) {
        return { success: true, output: "Empty directory." };
      }

      const relPath = relative(vaultRoot, targetDir) || "/";
      const output = [
        `📂 ${relPath}`,
        `${items.length} item(s):`,
        "",
        ...items,
      ].join("\n");

      return { success: true, output };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
};

// ════════════════════════════════════════════════════════════
// 🏷️ OBSIDIAN TAGS — Browse and search by tags
// ════════════════════════════════════════════════════════════
export const obsidianTagsTool: ToolDefinition = {
  name: "obsidian_tags",
  description:
    "List all tags used across the Obsidian vault, or find all notes with a specific tag. Great for discovering topics and connections.",
  parameters: z.object({
    tag: z
      .string()
      .optional()
      .describe(
        "Specific tag to search for (without #). If omitted, lists all tags with counts.",
      ),
    maxResults: z
      .number()
      .optional()
      .default(20)
      .describe("Maximum number of results"),
  }),
  sideEffect: false,
  requireApproval: false,
  execute: async (args): Promise<ToolResult> => {
    try {
      const vaultRoot = getVaultPath();
      const allFiles = await walkMarkdown(vaultRoot);

      if (args.tag) {
        // Find notes with a specific tag
        const targetTag = args.tag.replace(/^#/, "").toLowerCase();
        const matches: { path: string; tags: string[] }[] = [];

        for (const filePath of allFiles) {
          try {
            const content = await readFile(filePath, "utf-8");
            const tags = extractTags(content);
            if (
              tags.some(
                (t) =>
                  t.toLowerCase() === targetTag ||
                  t.toLowerCase().startsWith(targetTag + "/"),
              )
            ) {
              matches.push({
                path: relative(vaultRoot, filePath),
                tags,
              });
            }
          } catch {
            // skip
          }
        }

        if (matches.length === 0) {
          return {
            success: true,
            output: `No notes found with tag #${args.tag}.`,
          };
        }

        const output = [
          `🏷️ Notes tagged #${args.tag} (${matches.length}):`,
          "",
          ...matches.slice(0, args.maxResults).map(
            (m) =>
              `  📄 ${m.path}${
                m.tags.length > 1
                  ? ` (also: ${m.tags
                      .filter((t) => t.toLowerCase() !== targetTag)
                      .map((t) => `#${t}`)
                      .join(", ")})`
                  : ""
              }`,
          ),
        ].join("\n");

        return { success: true, output };
      }

      // List all tags with counts
      const tagCounts = new Map<string, number>();

      for (const filePath of allFiles) {
        try {
          const content = await readFile(filePath, "utf-8");
          const tags = extractTags(content);
          for (const tag of tags) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        } catch {
          // skip
        }
      }

      if (tagCounts.size === 0) {
        return { success: true, output: "No tags found in the vault." };
      }

      // Sort by count descending
      const sorted = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, args.maxResults);

      const output = [
        `🏷️ Tags in vault (${tagCounts.size} total):`,
        "",
        ...sorted.map(([tag, count]) => `  #${tag} — ${count} note(s)`),
      ].join("\n");

      return { success: true, output };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
};

// ════════════════════════════════════════════════════════════
// 🔗 OBSIDIAN LINKS — Analyze wikilink graph connections
// ════════════════════════════════════════════════════════════
export const obsidianLinksTool: ToolDefinition = {
  name: "obsidian_links",
  description:
    "Analyze wikilink connections in the Obsidian vault. Find outgoing links from a note, or find all notes that link TO a specific note (backlinks). Useful for understanding knowledge connections.",
  parameters: z.object({
    note: z.string().describe("Note name or path to analyze links for"),
    direction: z
      .enum(["outgoing", "backlinks", "both"])
      .optional()
      .default("both")
      .describe("Direction of links to find"),
  }),
  sideEffect: false,
  requireApproval: false,
  execute: async (args): Promise<ToolResult> => {
    try {
      const vaultRoot = getVaultPath();
      const targetNote = basename(args.note, ".md");
      const allFiles = await walkMarkdown(vaultRoot);

      const sections: string[] = [
        `🔗 Link analysis for: **${targetNote}**`,
        "",
      ];

      // Outgoing links
      if (args.direction === "outgoing" || args.direction === "both") {
        // Find the target note file
        const noteFile = allFiles.find(
          (f) => basename(f, ".md").toLowerCase() === targetNote.toLowerCase(),
        );

        if (noteFile) {
          const content = await readFile(noteFile, "utf-8");
          const outgoing = extractWikilinks(content);
          sections.push(`📤 **Outgoing links** (${outgoing.length}):`);
          if (outgoing.length > 0) {
            for (const link of outgoing) {
              // Check if the target exists
              const exists = allFiles.some(
                (f) => basename(f, ".md").toLowerCase() === link.toLowerCase(),
              );
              sections.push(
                `  ${exists ? "✅" : "❌"} [[${link}]]${exists ? "" : " (not found)"}`,
              );
            }
          } else {
            sections.push("  (no outgoing links)");
          }
          sections.push("");
        } else {
          sections.push(`⚠️ Note "${targetNote}" not found in vault.`);
          sections.push("");
        }
      }

      // Backlinks
      if (args.direction === "backlinks" || args.direction === "both") {
        const backlinks: string[] = [];

        for (const filePath of allFiles) {
          try {
            const content = await readFile(filePath, "utf-8");
            const links = extractWikilinks(content);
            if (
              links.some((l) => l.toLowerCase() === targetNote.toLowerCase())
            ) {
              backlinks.push(relative(vaultRoot, filePath));
            }
          } catch {
            // skip
          }
        }

        sections.push(`📥 **Backlinks** (${backlinks.length}):`);
        if (backlinks.length > 0) {
          for (const bl of backlinks) {
            sections.push(`  ← ${bl}`);
          }
        } else {
          sections.push("  (no backlinks found)");
        }
      }

      return { success: true, output: sections.join("\n") };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
};

// ════════════════════════════════════════════════════════════
// 📅 OBSIDIAN DAILY NOTE — Create or read today's daily note
// ════════════════════════════════════════════════════════════
export const obsidianDailyTool: ToolDefinition = {
  name: "obsidian_daily",
  description:
    "Create or read the daily note in Obsidian. Defaults to today's date. Supports customizable daily note folder and template.",
  parameters: z.object({
    date: z
      .string()
      .optional()
      .describe("Date in YYYY-MM-DD format (defaults to today)"),
    folder: z
      .string()
      .optional()
      .default("Daily Notes")
      .describe("Folder for daily notes (default: 'Daily Notes')"),
    action: z
      .enum(["read", "create", "append"])
      .optional()
      .default("read")
      .describe(
        "Action: 'read' to view, 'create' to create with template, 'append' to add content",
      ),
    content: z
      .string()
      .optional()
      .describe("Content to add (for 'create' or 'append' action)"),
    template: z
      .string()
      .optional()
      .describe(
        "Template to use for creating daily note. Use {date}, {day}, {time} placeholders.",
      ),
  }),
  sideEffect: true,
  requireApproval: false, // Daily notes are safe
  execute: async (args): Promise<ToolResult> => {
    try {
      const vaultRoot = getVaultPath();
      const dateStr = args.date || getTodayDate();
      const notePath = join(args.folder, `${dateStr}.md`);
      const fullPath = ensureInsideVault(notePath, vaultRoot);

      if (args.action === "read") {
        try {
          const content = await readFile(fullPath, "utf-8");
          return {
            success: true,
            output: `📅 Daily Note: ${dateStr}\n---\n${content}`,
          };
        } catch {
          return {
            success: true,
            output: `📅 No daily note found for ${dateStr}. Use action: 'create' to create one.`,
          };
        }
      }

      if (args.action === "create") {
        // Create parent directory
        await mkdir(dirname(fullPath), { recursive: true });

        const dayName = new Date(dateStr).toLocaleDateString("en-US", {
          weekday: "long",
        });
        const time = new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const defaultTemplate = `---
date: ${dateStr}
day: ${dayName}
tags: [daily]
---

# 📅 ${dateStr} (${dayName})

## 🎯 Today's Goals
- 

## 📝 Notes
${args.content || ""}

## 📋 Tasks
- [ ] 

## 💭 Reflections

`;

        const finalContent = args.template
          ? args.template
              .replace(/\{date\}/g, dateStr)
              .replace(/\{day\}/g, dayName)
              .replace(/\{time\}/g, time)
          : defaultTemplate;

        await writeFile(fullPath, finalContent, "utf-8");

        return {
          success: true,
          output: `✅ Created daily note: ${notePath}`,
        };
      }

      if (args.action === "append") {
        if (!args.content) {
          return {
            success: false,
            output: "",
            error: "Content is required for 'append' action",
          };
        }

        let existing = "";
        try {
          existing = await readFile(fullPath, "utf-8");
        } catch {
          // Create the daily note first if it doesn't exist
          await mkdir(dirname(fullPath), { recursive: true });
          const dayName = new Date(dateStr).toLocaleDateString("en-US", {
            weekday: "long",
          });
          existing = `---\ndate: ${dateStr}\nday: ${dayName}\ntags: [daily]\n---\n\n# 📅 ${dateStr} (${dayName})\n`;
        }

        const time = new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const newContent = existing + `\n\n### ${time}\n${args.content}`;
        await writeFile(fullPath, newContent, "utf-8");

        return {
          success: true,
          output: `✅ Appended to daily note: ${notePath}`,
        };
      }

      return {
        success: false,
        output: "",
        error: `Unknown action: ${args.action}`,
      };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
};

// ════════════════════════════════════════════════════════════
// 📊 OBSIDIAN STATS — Vault statistics and overview
// ════════════════════════════════════════════════════════════
export const obsidianStatsTool: ToolDefinition = {
  name: "obsidian_stats",
  description:
    "Get comprehensive statistics about the Obsidian vault: total notes, tags, links, folder sizes, recent files, etc.",
  parameters: z.object({
    includeRecent: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include recently modified files"),
    recentCount: z
      .number()
      .optional()
      .default(10)
      .describe("Number of recent files to show"),
  }),
  sideEffect: false,
  requireApproval: false,
  execute: async (args): Promise<ToolResult> => {
    try {
      const vaultRoot = getVaultPath();
      const allFiles = await walkMarkdown(vaultRoot);

      let totalWords = 0;
      let totalChars = 0;
      const allTags = new Map<string, number>();
      const allLinks = new Set<string>();
      const folderCounts = new Map<string, number>();
      const recentFiles: { path: string; mtime: Date }[] = [];

      for (const filePath of allFiles) {
        try {
          const content = await readFile(filePath, "utf-8");
          const fileStat = await stat(filePath);
          const relPath = relative(vaultRoot, filePath);

          // Word/char count
          totalChars += content.length;
          totalWords += content.split(/\s+/).filter(Boolean).length;

          // Tags
          for (const tag of extractTags(content)) {
            allTags.set(tag, (allTags.get(tag) || 0) + 1);
          }

          // Links
          for (const link of extractWikilinks(content)) {
            allLinks.add(link);
          }

          // Folder distribution
          const folder = dirname(relPath);
          folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);

          // Recent files
          recentFiles.push({ path: relPath, mtime: fileStat.mtime });
        } catch {
          // skip
        }
      }

      // Sort recent files
      recentFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Top tags
      const topTags = Array.from(allTags.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      // Top folders
      const topFolders = Array.from(folderCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const sections = [
        `📊 **Obsidian Vault Statistics**`,
        ``,
        `📄 **Notes:** ${allFiles.length}`,
        `📝 **Total words:** ${totalWords.toLocaleString()}`,
        `📏 **Total characters:** ${totalChars.toLocaleString()}`,
        `🏷️ **Unique tags:** ${allTags.size}`,
        `🔗 **Unique links:** ${allLinks.size}`,
        `📁 **Folders:** ${folderCounts.size}`,
        ``,
        `**Top Tags:**`,
        ...topTags.map(([tag, count]) => `  #${tag} (${count})`),
        ``,
        `**Top Folders:**`,
        ...topFolders.map(
          ([folder, count]) => `  📁 ${folder || "/"} — ${count} note(s)`,
        ),
      ];

      if (args.includeRecent) {
        sections.push(
          ``,
          `**Recently Modified (${Math.min(args.recentCount, recentFiles.length)}):**`,
          ...recentFiles
            .slice(0, args.recentCount)
            .map(
              (f) =>
                `  📄 ${f.path} — ${f.mtime.toLocaleDateString()} ${f.mtime.toLocaleTimeString()}`,
            ),
        );
      }

      return { success: true, output: sections.join("\n") };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
};

// ════════════════════════════════════════════════════════════
// 🧠 EXPORT ALL OBSIDIAN TOOLS
// ════════════════════════════════════════════════════════════
export const obsidianTools: ToolDefinition[] = [
  obsidianReadTool,
  obsidianWriteTool,
  obsidianAppendTool,
  obsidianSearchTool,
  obsidianListTool,
  obsidianTagsTool,
  obsidianLinksTool,
  obsidianDailyTool,
  obsidianStatsTool,
];
