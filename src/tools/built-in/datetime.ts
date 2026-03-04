// ============================================================
// 🦀 Krab — Built-in Tool: DateTime
// ============================================================
import { z } from "zod";
import type { ToolDefinition } from "../../core/types.js";

export const datetimeTool: ToolDefinition = {
  name: "get_datetime",
  description:
    "Get the current date, time, and timezone. Use this when the user asks about the current time or date.",
  parameters: z.object({}),
  sideEffect: false,
  requireApproval: false,
  execute: async () => {
    const now = new Date();
    const output = JSON.stringify({
      iso: now.toISOString(),
      local: now.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      unix: Math.floor(now.getTime() / 1000),
    });
    return { success: true, output };
  },
};
