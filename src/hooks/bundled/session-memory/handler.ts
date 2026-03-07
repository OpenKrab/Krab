// ============================================================
// 🦀 Krab — Bundled Hook: Session Memory Handler
// ============================================================
import { HookHandler, HookEvent } from "../../index.js";
import { logger } from "../../../utils/logger.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const sessionMemoryHandler: HookHandler = {
  async execute(event: HookEvent): Promise<void> {
    try {
      if (event.type === "message:assistant") {
        // Save session snapshot when assistant responds
        const sessionId = event.sessionId || "default";
        const memoryDir = path.join(os.homedir(), ".krab", "sessions");

        if (!fs.existsSync(memoryDir)) {
          fs.mkdirSync(memoryDir, { recursive: true });
        }

        const snapshotPath = path.join(memoryDir, `${sessionId}-snapshot.json`);
        const snapshot = {
          sessionId,
          timestamp: event.timestamp,
          lastMessage: event.data.content.substring(0, 500), // Truncate for storage
          eventType: event.type
        };

        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
        logger.debug(`[SessionMemory] Saved snapshot for session ${sessionId}`);
      }
    } catch (error) {
      logger.error("[SessionMemory] Failed to save session snapshot:", error);
    }
  }
};

export default sessionMemoryHandler;
