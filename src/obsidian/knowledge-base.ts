import {
  ObsidianKnowledgeBase,
  type ObsidianNote,
  type ObsidianVault,
} from "./index.js";

export type { ObsidianNote, ObsidianVault } from "./index.js";

export interface SemanticSearchResult {
  note: ObsidianNote;
  score: number;
  matches: string[];
  context: string;
}

export interface KnowledgeNode {
  id: string;
  type: "note" | "tag";
  label: string;
  properties: Record<string, any>;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  type: "link" | "tag";
  weight: number;
  properties?: Record<string, any>;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export class ObsidianSemanticSearch {
  private readonly vault: ObsidianVault;
  private readonly notes: ObsidianNote[];

  constructor(vault: ObsidianVault) {
    this.vault = vault;
    this.notes = Array.from(vault.notes.values());
  }

  search(
    query: string,
    options: { limit?: number; minScore?: number; includeContext?: boolean } = {},
  ): SemanticSearchResult[] {
    const terms = tokenize(query);
    if (terms.length === 0) {
      return [];
    }

    const minScore = options.minScore ?? 0.01;
    const results = this.notes
      .map((note) => {
        const haystack = `${note.title}\n${note.content}`.toLowerCase();
        const matches = terms.filter((term) => haystack.includes(term));
        const score = matches.length / terms.length;

        return {
          note,
          score,
          matches,
          context: options.includeContext
            ? buildContext(note.content, matches[0] ?? terms[0])
            : "",
        };
      })
      .filter((result) => result.score >= minScore)
      .sort((a, b) => b.score - a.score);

    return results.slice(0, options.limit ?? 20);
  }
}

export class ObsidianKnowledgeGraph {
  private readonly graph: KnowledgeGraph;

  constructor(vault: ObsidianVault) {
    this.graph = this.buildGraph(vault);
  }

  getGraph(): KnowledgeGraph {
    return this.graph;
  }

  getNeighbors(nodeId: string): KnowledgeNode[] {
    const neighborIds = new Set<string>();

    for (const edge of this.graph.edges) {
      if (edge.source === nodeId) neighborIds.add(edge.target);
      if (edge.target === nodeId) neighborIds.add(edge.source);
    }

    return this.graph.nodes.filter((node) => neighborIds.has(node.id));
  }

  findCentralNodes(limit = 10): KnowledgeNode[] {
    return [...this.graph.nodes]
      .sort(
        (a, b) => this.getNeighbors(b.id).length - this.getNeighbors(a.id).length,
      )
      .slice(0, limit);
  }

  findShortestPath(startId: string, endId: string): KnowledgeNode[] | null {
    const queue: Array<{ nodeId: string; path: string[] }> = [
      { nodeId: startId, path: [startId] },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.nodeId === endId) {
        return current.path
          .map((id) => this.graph.nodes.find((node) => node.id === id))
          .filter((node): node is KnowledgeNode => Boolean(node));
      }

      if (visited.has(current.nodeId)) {
        continue;
      }
      visited.add(current.nodeId);

      for (const neighbor of this.getNeighbors(current.nodeId)) {
        if (!visited.has(neighbor.id)) {
          queue.push({
            nodeId: neighbor.id,
            path: [...current.path, neighbor.id],
          });
        }
      }
    }

    return null;
  }

  findClusters(): KnowledgeNode[][] {
    const clusters: KnowledgeNode[][] = [];
    const visited = new Set<string>();

    for (const node of this.graph.nodes) {
      if (visited.has(node.id)) {
        continue;
      }

      const cluster: KnowledgeNode[] = [];
      const queue = [node.id];

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) {
          continue;
        }

        visited.add(currentId);
        const currentNode = this.graph.nodes.find((candidate) => candidate.id === currentId);
        if (!currentNode) {
          continue;
        }

        cluster.push(currentNode);
        for (const neighbor of this.getNeighbors(currentId)) {
          if (!visited.has(neighbor.id)) {
            queue.push(neighbor.id);
          }
        }
      }

      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }

    return clusters.sort((a, b) => b.length - a.length);
  }

  private buildGraph(vault: ObsidianVault): KnowledgeGraph {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];
    const tagIds = new Set<string>();

    for (const note of vault.notes.values()) {
      nodes.push({
        id: note.id,
        type: "note",
        label: note.title,
        properties: {
          path: note.relativePath,
          tags: note.tags,
          modified: note.modified,
        },
      });

      for (const tag of note.tags) {
        const tagId = `tag:${tag}`;
        if (!tagIds.has(tagId)) {
          tagIds.add(tagId);
          nodes.push({
            id: tagId,
            type: "tag",
            label: tag,
            properties: {},
          });
        }

        edges.push({
          source: note.id,
          target: tagId,
          type: "tag",
          weight: 1,
        });
      }
    }

    for (const edge of vault.graph.edges) {
      edges.push({
        source: edge.source,
        target: edge.target,
        type: edge.type === "tag" ? "tag" : "link",
        weight: 1,
      });
    }

    return { nodes, edges };
  }
}

export class ObsidianAIKnowledgeBase extends ObsidianKnowledgeBase {
  private semanticEngine: ObsidianSemanticSearch | null = null;
  private graphEngine: ObsidianKnowledgeGraph | null = null;

  async initialize(): Promise<void> {
    await super.initialize();
    this.rebuildIndexes();
  }

  override async refresh(): Promise<void> {
    await super.refresh();
    this.rebuildIndexes();
  }

  semanticSearch(
    query: string,
    options: number | { limit?: number; minScore?: number; includeContext?: boolean } = {},
  ): SemanticSearchResult[] {
    this.ensureIndexes();

    const normalizedOptions =
      typeof options === "number" ? { limit: options } : options;

    return this.semanticEngine!.search(query, normalizedOptions);
  }

  getKnowledgeGraph(): KnowledgeGraph {
    this.ensureIndexes();
    return this.graphEngine!.getGraph();
  }

  getCentralNodes(limit = 10): KnowledgeNode[] {
    this.ensureIndexes();
    return this.graphEngine!.findCentralNodes(limit);
  }

  getCentralKnowledgeNodes(limit = 10): KnowledgeNode[] {
    return this.getCentralNodes(limit);
  }

  findKnowledgePath(startId: string, endId: string): KnowledgeNode[] | null {
    this.ensureIndexes();
    return this.graphEngine!.findShortestPath(startId, endId);
  }

  discoverKnowledgeClusters(): KnowledgeNode[][] {
    this.ensureIndexes();
    return this.graphEngine!.findClusters();
  }

  async synthesizeKnowledge(topic: string): Promise<{
    summary: string;
    keyPoints: string[];
    relatedNotes: ObsidianNote[];
    suggestedLinks: string[];
  }> {
    const searchResults = this.semanticSearch(topic, {
      limit: 10,
      includeContext: true,
    });

    if (searchResults.length === 0) {
      return {
        summary: `No existing knowledge found about "${topic}".`,
        keyPoints: [],
        relatedNotes: [],
        suggestedLinks: [],
      };
    }

    const relatedNotes = searchResults.map((result) => result.note);
    const keyPoints = relatedNotes
      .flatMap((note) => note.content.split("\n"))
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.startsWith("- ") ||
          line.startsWith("* ") ||
          /^\d+\./.test(line) ||
          line.startsWith("#"),
      )
      .map((line) => line.replace(/^[-*]\s*/, ""))
      .slice(0, 10);

    return {
      summary: `Found ${relatedNotes.length} notes related to "${topic}". Top notes: ${relatedNotes
        .slice(0, 3)
        .map((note) => note.title)
        .join(", ")}.`,
      keyPoints,
      relatedNotes,
      suggestedLinks: dedupe(
        relatedNotes.flatMap((note) => note.links.map((link) => link.target)),
      ).slice(0, 5),
    };
  }

  async createDailyNote(date = new Date()): Promise<string> {
    const dateStr = date.toISOString().split("T")[0];
    return this.createNote(
      `Daily Notes/${dateStr}.md`,
      `# ${dateStr}\n\n## Tasks\n\n## Notes\n\n## Reflections\n`,
      { tags: ["daily"] },
    );
  }

  async createProjectNote(projectName: string, description: string): Promise<string> {
    const fileName = projectName.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_");
    return this.createNote(
      `Projects/${fileName}.md`,
      `# ${projectName}\n\n${description}\n\n## Goals\n\n## Tasks\n\n## Notes\n`,
      { tags: ["project"] },
    );
  }

  async archiveNote(notePath: string): Promise<void> {
    const note = this.getNote(notePath.replace(/\.md$/, ""));
    if (!note) {
      throw new Error(`Note not found: ${notePath}`);
    }

    await this.createNote(`Archive/${note.relativePath}`, note.content, {
      frontmatter: note.frontmatter,
      tags: note.tags,
    });
    await this.deleteNote(`${note.relativePath}.md`.replace(/\.md\.md$/, ".md"));
  }

  private rebuildIndexes(): void {
    const vault = this.getVault();
    if (!vault) {
      this.semanticEngine = null;
      this.graphEngine = null;
      return;
    }

    this.semanticEngine = new ObsidianSemanticSearch(vault);
    this.graphEngine = new ObsidianKnowledgeGraph(vault);
  }

  private ensureIndexes(): void {
    if (!this.semanticEngine || !this.graphEngine) {
      throw new Error("Knowledge base not initialized");
    }
  }
}

function tokenize(text: string): string[] {
  return dedupe(
    text
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((term) => term.length > 2),
  );
}

function buildContext(content: string, term: string): string {
  const lower = content.toLowerCase();
  const index = lower.indexOf(term.toLowerCase());
  if (index === -1) {
    return content.slice(0, 200);
  }

  const start = Math.max(0, index - 80);
  const end = Math.min(content.length, index + 120);
  return content.slice(start, end).trim();
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}
