// ============================================================
// 🦀 Krab — Plugin SDK: Channel Plugin Types
// Type for declaring channel plugins
// ============================================================
import type { ChannelPlugin } from "./types/adapters.js";

export interface KrabChannelPlugin {
  /** Unique channel identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Version string */
  version?: string;
  
  /** The channel implementation */
  channel: ChannelPlugin;
  
  /** Configuration schema */
  configSchema?: Record<string, any>;
  
  /** Tools provided by this channel */
  tools?: Array<{
    name: string;
    description: string;
    execute: (args: any) => Promise<any>;
  }>;
}
