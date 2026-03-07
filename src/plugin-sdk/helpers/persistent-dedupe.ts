// ============================================================
// 🦀 Krab — Plugin SDK: Persistent Dedupe Helper
// Deduplicate messages based on content hash
// ============================================================
import { createHash } from "crypto";

export interface DedupeEntry {
  hash: string;
  timestamp: number;
  messageId?: string;
}

export function createPersistentDedupe(
  getEntries: () => DedupeEntry[],
  addEntry: (entry: DedupeEntry) => void,
  options: { ttlMs?: number; maxSize?: number } = {}
) {
  const { ttlMs = 60000, maxSize = 1000 } = options;
  
  function hashContent(content: string): string {
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  }
  
  function cleanup() {
    const now = Date.now();
    const entries = getEntries();
    const valid = entries.filter((e) => now - e.timestamp < ttlMs);
    
    if (valid.length < entries.length) {
      // Remove expired entries - in real impl, would call storage
    }
  }
  
  return {
    check(content: string): string | null {
      cleanup();
      
      const hash = hashContent(content);
      const entries = getEntries();
      const existing = entries.find((e) => e.hash === hash);
      
      return existing?.messageId || null;
    },
    
    add(content: string, messageId?: string) {
      cleanup();
      
      const hash = hashContent(content);
      const entries = getEntries();
      
      // Trim if needed
      if (entries.length >= maxSize) {
        entries.shift();
      }
      
      addEntry({
        hash,
        timestamp: Date.now(),
        messageId,
      });
    },
    
    clear() {
      // Clear all entries
    },
  };
}
