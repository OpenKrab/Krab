// ============================================================
// 🦀 Krab — Cloud Tools Index
// ============================================================
import { cloudDeploymentTool } from './deployment.js';
import { cloudMonitoringTool } from './monitoring.js';

// Re-export everything
export {
  cloudDeploymentTool,
  cloudMonitoringTool
};

// Re-export types
export type {
  DeploymentConfig,
  DeploymentStatus
} from './deployment.js';

export type {
  MetricsData,
  AnalyticsData,
  AlertRule
} from './monitoring.js';

export type {
  CloudConfig,
  ChatMessage,
  ChatResponse,
  ToolExecution,
  ToolResult
} from './client.js';

// Cloud tools collection for easy registration
export const cloudTools = [
  cloudDeploymentTool,
  cloudMonitoringTool
];
