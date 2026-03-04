// ============================================================
// 🦀 Krab — System Tools Index
// ============================================================
import { ProcessManager, processTool, enhancedExecTool, createProcessManager } from "./process.js";
import { SystemIntegration, systemIntegrationTool, createSystemIntegration } from "./integration.js";

// Re-export everything
export { ProcessManager, processTool, enhancedExecTool, createProcessManager };
export { SystemIntegration, systemIntegrationTool, createSystemIntegration };

// Re-export types
export type { ProcessOptions, ProcessResult, ProcessInfo } from "./process.js";
export type { SystemOptions, SystemResult } from "./integration.js";

// System tools collection for easy registration
export const systemTools = [
  processTool,
  enhancedExecTool,
  systemIntegrationTool
];
