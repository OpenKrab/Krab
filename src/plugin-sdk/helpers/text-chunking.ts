// ============================================================
// 🦀 Krab — Plugin SDK: Text Chunking Helper
// Split long messages into chunks for channels with limits
// ============================================================

export interface ChunkOptions {
  maxLength: number;
  overlap?: number;
  suffix?: string;
  prefix?: string;
}

export function createTextChunking(options: ChunkOptions) {
  const { maxLength, overlap = 0, suffix = "...", prefix = "" } = options;
  const effectiveMax = maxLength - suffix.length - prefix.length;
  
  return {
    chunk(text: string): string[] {
      if (text.length <= maxLength) {
        return [text];
      }
      
      const chunks: string[] = [];
      let start = 0;
      
      while (start < text.length) {
        let end = start + effectiveMax;
        
        // Try to break at word boundary
        if (end < text.length) {
          const lastSpace = text.lastIndexOf(" ", end);
          if (lastSpace > start) {
            end = lastSpace;
          }
        }
        
        const chunk = prefix + text.slice(start, end) + suffix;
        chunks.push(chunk);
        
        start = end - overlap;
        if (start < 0) start = 0;
        
        // Prevent infinite loop
        if (chunks.length > 0 && chunks[chunks.length - 1] === chunk) {
          start = end;
        }
      }
      
      return chunks;
    },
    
    estimateChunks(text: string): number {
      return Math.ceil(text.length / effectiveMax);
    },
  };
}
