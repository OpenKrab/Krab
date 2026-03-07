// ============================================================
// 🦀 Krab — Plugin SDK: Outbound Media Helper
// Format media for outbound messages
// ============================================================
import type { OutboundMessage } from "../types/adapters.js";

export interface MediaPayload {
  type: "image" | "audio" | "video" | "file";
  url?: string;
  buffer?: Buffer;
  filename?: string;
  mimeType?: string;
  caption?: string;
}

export function createOutboundMedia() {
  return {
    image(url: string, caption?: string): OutboundMessage {
      return {
        recipient: "",
        content: caption || "",
        type: "image",
        metadata: { mediaUrl: url },
      };
    },
    
    audio(url: string): OutboundMessage {
      return {
        recipient: "",
        content: "",
        type: "audio",
        metadata: { mediaUrl: url },
      };
    },
    
    video(url: string, caption?: string): OutboundMessage {
      return {
        recipient: "",
        content: caption || "",
        type: "video",
        metadata: { mediaUrl: url },
      };
    },
    
    file(url: string, filename: string): OutboundMessage {
      return {
        recipient: "",
        content: filename,
        type: "file",
        metadata: { mediaUrl: url } as any,
      };
    },
  };
}
