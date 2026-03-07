// Simple stub implementations for now - can be enhanced later
class ObsidianSemanticSearch {
  search(query: string, options?: any): any[] {
    return [];
  }
}

class ObsidianKnowledgeGraph {
  getGraph(): any {
    return { nodes: [], edges: [] };
  }
}

export interface SemanticSearchResult {
  note: ObsidianNote;
  score: number;
  matches: string[];
  context: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface KnowledgeNode {
  id: string;
  type: 'note' | 'concept' | 'tag';
  label: string;
  properties: Record<string, any>;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  type: 'link' | 'reference' | 'related' | 'tag';
  weight: number;
  properties?: Record<string, any>;
}

export class ObsidianSemanticSearch {
  private vault: ObsidianVault;
  private tfidf: Map<string, Map<string, number>> = new Map(); // term -> note -> score
  private idf: Map<string, number> = new Map(); // term -> inverse document frequency

  constructor(vault: ObsidianVault) {
    this.vault = vault;
    this.buildIndex();
  }

  private buildIndex(): void {
    const notes = Array.from(this.vault.notes.values());
    const totalDocs = notes.length;

    // Build TF-IDF index
    for (const note of notes) {
      const terms = this.tokenize(note.content + ' ' + note.title);
      const termFreq = new Map<string, number>();

      // Calculate term frequency
      for (const term of terms) {
        termFreq.set(term, (termFreq.get(term) || 0) + 1);
      }

      // Store TF and collect terms for IDF
      for (const [term, freq] of termFreq) {
        if (!this.tfidf.has(term)) {
          this.tfidf.set(term, new Map());
        }
        this.tfidf.get(term)!.set(note.id, freq / terms.length);

        // Count documents containing this term for IDF
        if (!this.idf.has(term)) {
          this.idf.set(term, 0);
        }
      }
    }

    // Calculate IDF
    for (const [term, noteScores] of this.tfidf) {
      const docCount = noteScores.size;
      this.idf.set(term, Math.log(totalDocs / (1 + docCount)));
    }

    logger.info(`[Obsidian] Built semantic index for ${totalDocs} notes`);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .map(word => word.replace(/s$/, '')); // Simple stemming
  }

  public search(query: string, options?: {
    limit?: number;
    minScore?: number;
    includeContext?: boolean;
  }): SemanticSearchResult[] {
    const queryTerms = this.tokenize(query);
    const scores = new Map<string, { score: number; matches: string[] }>();

    // Calculate TF-IDF scores for each note
    for (const queryTerm of queryTerms) {
      const termDocs = this.tfidf.get(queryTerm);
      if (!termDocs) continue;

      const idf = this.idf.get(queryTerm) || 0;

      for (const [noteId, tf] of termDocs) {
        const score = tf * idf;
        if (!scores.has(noteId)) {
          scores.set(noteId, { score: 0, matches: [] });
        }
        const noteScore = scores.get(noteId)!;
        noteScore.score += score;
        noteScore.matches.push(queryTerm);
      }
    }

    // Convert to results array
    const results: SemanticSearchResult[] = [];
    for (const [noteId, { score, matches }] of scores) {
      const note = this.vault.notes.get(noteId);
      if (!note) continue;

      const result: SemanticSearchResult = {
        note,
        score,
        matches: [...new Set(matches)], // Remove duplicates
        context: options?.includeContext ? this.extractContext(note.content, queryTerms) : ''
      };

      results.push(result);
    }

    // Sort by score and filter
    results.sort((a, b) => b.score - a.score);

    if (options?.minScore) {
      results.filter(r => r.score >= options.minScore!);
    }

    if (options?.limit) {
      results.splice(options.limit);
    }

    return results;
  }

  private extractContext(content: string, queryTerms: string[]): string {
    const lines = content.split('\n');
    const contexts: string[] = [];

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (queryTerms.some(term => lowerLine.includes(term))) {
        contexts.push(line.trim());
        if (contexts.length >= 3) break; // Limit context lines
      }
    }

    return contexts.join(' ... ');
  }

  // Find related concepts using graph traversal
  findRelatedConcepts(concept: string, depth: number = 2): string[] {
    const related = new Set<string>();
    const queue = [concept.toLowerCase()];
    const visited = new Set<string>();

    for (let level = 0; level < depth && queue.length > 0; level++) {
      const currentLevel = [...queue];
      queue.length = 0;

      for (const current of currentLevel) {
        if (visited.has(current)) continue;
        visited.add(current);

        // Find notes containing this concept
        for (const note of this.vault.notes.values()) {
          if (note.content.toLowerCase().includes(current) ||
              note.title.toLowerCase().includes(current)) {

            // Extract related terms from the note
            const terms = this.tokenize(note.content);
            for (const term of terms) {
              if (term !== current && !visited.has(term)) {
                related.add(term);
                queue.push(term);
              }
            }
          }
        }
      }
    }

    return Array.from(related);
  }
}

export class ObsidianKnowledgeGraph {
  private vault: ObsidianVault;
  private graph: KnowledgeGraph;

  constructor(vault: ObsidianVault) {
    this.vault = vault;
    this.graph = this.buildGraph();
  }

  private buildGraph(): KnowledgeGraph {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];

    // Add note nodes
    for (const note of this.vault.notes.values()) {
      nodes.push({
        id: note.id,
        type: 'note',
        label: note.title,
        properties: {
          path: note.relativePath,
          tags: note.tags,
          created: note.created,
          modified: note.modified
        }
      });

      // Add tag nodes and edges
      for (const tag of note.tags) {
        const tagId = `tag:${tag}`;
        if (!nodes.find(n => n.id === tagId)) {
          nodes.push({
            id: tagId,
            type: 'tag',
            label: tag,
            properties: {}
          });
        }

        edges.push({
          source: note.id,
          target: tagId,
          type: 'tag',
          weight: 1
        });
      }
    }

    // Add link edges
    for (const edge of this.vault.graph.edges) {
      if (edge.type === 'link') {
        edges.push({
          source: edge.source,
          target: edge.target,
          type: 'link',
          weight: 1
        });
      }
    }

    return { nodes, edges };
  }

  // Graph traversal methods
  getNeighbors(nodeId: string): KnowledgeNode[] {
    const neighbors = new Set<string>();

    for (const edge of this.graph.edges) {
      if (edge.source === nodeId) {
        neighbors.add(edge.target);
      } else if (edge.target === nodeId) {
        neighbors.add(edge.source);
      }
    }

    return this.graph.nodes.filter(node => neighbors.has(node.id));
  }

  findShortestPath(startId: string, endId: string): KnowledgeNode[] | null {
    // Simple BFS for shortest path
    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[] }> = [
      { node: startId, path: [startId] }
    ];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (node === endId) {
        return path.map(id => this.graph.nodes.find(n => n.id === id)!).filter(Boolean);
      }

      if (visited.has(node)) continue;
      visited.add(node);

      for (const neighbor of this.getNeighbors(node)) {
        if (!visited.has(neighbor.id)) {
          queue.push({
            node: neighbor.id,
            path: [...path, neighbor.id]
          });
        }
      }
    }

    return null;
  }

  // Knowledge discovery methods
  findCentralNodes(): KnowledgeNode[] {
    // Calculate node centrality based on connections
    const centrality = new Map<string, number>();

    for (const node of this.graph.nodes) {
      centrality.set(node.id, this.getNeighbors(node.id).length);
    }

    return Array.from(centrality.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([id]) => this.graph.nodes.find(n => n.id === id)!);
  }

  findClusters(): KnowledgeNode[][] {
    // Simple community detection using connected components
    const visited = new Set<string>();
    const clusters: KnowledgeNode[][] = [];

    for (const node of this.graph.nodes) {
      if (visited.has(node.id)) continue;

      const cluster = this.getConnectedComponent(node.id, visited);
      if (cluster.length > 1) { // Only include clusters with multiple nodes
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  private getConnectedComponent(startId: string, visited: Set<string>): KnowledgeNode[] {
    const component: KnowledgeNode[] = [];
    const queue = [startId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;

      visited.add(nodeId);
      const node = this.graph.nodes.find(n => n.id === nodeId);
      if (node) {
        component.push(node);

        // Add neighbors to queue
        for (const neighbor of this.getNeighbors(nodeId)) {
          if (!visited.has(neighbor.id)) {
            queue.push(neighbor.id);
          }
        }
      }
    }

    return component;
  }

  getGraph(): KnowledgeGraph {
    return this.graph;
  }
}

// ============================================================
// 🧠 Enhanced Knowledge Base with AI Features
// ============================================================

export class ObsidianAIKnowledgeBase extends ObsidianKnowledgeBase {
  private semanticSearch!: any;
  private knowledgeGraph!: any;

  constructor(vaultPath: string) {
    super(vaultPath);
  }

  async initialize(): Promise<void> {
    await super.initialize();

    const vault = this.getVault();
    if (vault) {
      this.semanticSearch = new ObsidianSemanticSearch(vault);
      this.knowledgeGraph = new ObsidianKnowledgeGraph(vault);
    }
  }

  // AI-powered knowledge synthesis
  async synthesizeKnowledge(topic: string): Promise<{
    summary: string;
    keyPoints: string[];
    relatedNotes: ObsidianNote[];
    suggestedLinks: string[];
  }> {
    if (!this.semanticSearch) throw new Error('Knowledge base not initialized');

    // Search for relevant notes
    const searchResults = this.semanticSearch.search(topic, { limit: 10, includeContext: true });

    if (searchResults.length === 0) {
      return {
        summary: `No existing knowledge found about "${topic}". Consider creating a new note.`,
        keyPoints: [],
        relatedNotes: [],
        suggestedLinks: []
      };
    }

    // Extract key information
    const relatedNotes = searchResults.map(r => r.note);
    const allContent = relatedNotes.map(n => n.content).join('\n\n');

    // Simple synthesis (in a real implementation, this would use AI)
    const keyPoints = this.extractKeyPoints(allContent);
    const summary = this.generateSummary(topic, relatedNotes);

    // Find related concepts for suggested links
    const relatedConcepts = this.findRelatedConcepts(topic.toLowerCase(), 1);
    const suggestedLinks = relatedConcepts.slice(0, 5);

    return {
      summary,
      keyPoints,
      relatedNotes,
      suggestedLinks
    };
  }

  private extractKeyPoints(content: string): string[] {
    const lines = content.split('\n');
    const points: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Look for bullet points, numbered lists, or bold text
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') ||
          /^\d+\./.test(trimmed) || trimmed.includes('**')) {
        points.push(trimmed.replace(/^[-*]\s*/, '').replace(/\*\*/g, ''));
      }
    }

    return points.slice(0, 10); // Limit to 10 points
  }

  private generateSummary(topic: string, notes: ObsidianNote[]): string {
    const totalNotes = notes.length;
    const totalWords = notes.reduce((sum, note) => sum + note.content.split(/\s+/).length, 0);

    return `Found ${totalNotes} notes related to "${topic}" containing approximately ${totalWords} words. ` +
           `Key themes include: ${notes.slice(0, 3).map(n => n.title).join(', ')}${notes.length > 3 ? ' and more' : ''}.`;
  }

  // Knowledge maintenance methods
  async createDailyNote(date?: Date): Promise<string> {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const notePath = `Daily Notes/${dateStr}.md`;

    const content = `# ${dateStr}\n\n## Tasks\n\n## Notes\n\n## Reflections\n\n`;

    return await this.createNote(notePath, content, {
      tags: ['daily-note', 'journal'],
      frontmatter: {
        date: dateStr,
        type: 'daily-note'
      }
    });
  }

  async createProjectNote(projectName: string, description: string): Promise<string> {
    const notePath = `Projects/${projectName}.md`;

    const content = `# ${projectName}\n\n${description}\n\n## Goals\n\n## Tasks\n\n## Notes\n\n## Related\n\n`;

    return await this.createNote(notePath, content, {
      tags: ['project', 'active'],
      frontmatter: {
        project: projectName,
        status: 'active',
        created: new Date().toISOString()
      }
    });
  }

  async archiveNote(notePath: string): Promise<void> {
    // Move to archive folder
    const archivePath = `Archive/${notePath}`;
    const note = this.getNote(notePath);

    if (note) {
      const content = note.content;
      const frontmatter = {
        ...note.frontmatter,
        archived: new Date().toISOString(),
        originalPath: note.relativePath
      };

      await this.createNote(archivePath, content, { frontmatter });
      await this.deleteNote(notePath);
    }
  }
}
