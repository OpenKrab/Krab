// ============================================================
// 🦀 Krab — Plugin SDK: Allow-From Helper
// Check if sender is in allowlist
// ============================================================
import { createHash } from "crypto";

export function createAllowFrom(options: { normalized?: boolean } = {}) {
  const { normalized = true } = options;
  
  function normalizeId(id: string): string {
    if (!normalized) return id;
    return id.toLowerCase().replace(/[@\s]/g, "");
  }
  
  function createIdHash(id: string): string {
    return createHash("sha256").update(normalizeId(id)).digest("hex").slice(0, 8);
  }
  
  return {
    isAllowed(sender: string, allowList: string[]): boolean {
      const normalizedSender = normalizeId(sender);
      
      for (const allowed of allowList) {
        const normalizedAllowed = normalizeId(allowed);
        
        if (
          normalizedSender === normalizedAllowed ||
          normalizedSender.includes(normalizedAllowed) ||
          normalizedAllowed.includes(normalizedSender)
        ) {
          return true;
        }
      }
      
      return false;
    },
    
    matchesAny(sender: string, patterns: string[]): boolean {
      const senderHash = createIdHash(sender);
      const senderNormalized = normalizeId(sender);
      
      for (const pattern of patterns) {
        if (pattern.startsWith("hash:")) {
          // Match by hash prefix
          const hashPrefix = pattern.slice(5);
          if (senderHash.startsWith(hashPrefix)) return true;
        } else if (pattern.includes("*")) {
          // Glob match
          const regex = new RegExp(
            "^" + pattern.replace(/\*/g, ".*") + "$",
            "i"
          );
          if (regex.test(senderNormalized)) return true;
        } else {
          // Direct match
          if (normalizeId(pattern) === senderNormalized) return true;
        }
      }
      
      return false;
    },
  };
}
