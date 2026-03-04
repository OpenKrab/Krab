// ============================================================
// 🦀 Krab — Logger (tslog)
// ============================================================
import { Logger } from "tslog";

export const logger = new Logger({
  name: "🦀 Krab",
  prettyLogTemplate: "{{logLevelName}} {{name}} ",
  prettyLogTimeZone: "local",
  minLevel: process.env.KRAB_DEBUG === "true" ? 0 : 3, // 0=silly, 3=info
});
