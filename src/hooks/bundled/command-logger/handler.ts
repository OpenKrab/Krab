// ============================================================
// 🦀 Krab — Bundled Hook: Command Logger Handler
// ============================================================
import { HookHandler, HookEvent } from "../../index.js";
import { logger } from "../../../utils/logger.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const commandLoggerHandler: HookHandler = {
  async execute(event: HookEvent): Promise<void> {
    try {
      if (event.type === "message:user") {
        // Log user commands for auditing
        const sessionId = event.sessionId || "default";
        const logDir = path.join(os.homedir(), ".krab", "logs");

        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }

        const logPath = path.join(logDir, `commands-${sessionId}.log`);
        const logEntry = `[${event.timestamp.toISOString()}] ${event.data.content}\n`;

        fs.appendFileSync(logPath, logEntry);
        logger.debug(`[CommandLogger] Logged command for session ${sessionId}`);
      }
    } catch (error) {
      logger.error("[CommandLogger] Failed to log command:", error);
    }
  }
};

export default commandLoggerHandler;
