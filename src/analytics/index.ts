// ============================================================
// 🦀 Krab — Analytics Index
// ============================================================
import { analyticsReportTool, createAnalyticsTools } from './tools.js';
import { analyticsMonitoringTool } from './tools.js';
import { analyticsAlertTool } from './tools.js';
import { analyticsTracingTool } from './tools.js';

// Re-export everything
export {
  analyticsReportTool,
  createAnalyticsTools,
  analyticsMonitoringTool,
  analyticsAlertTool,
  analyticsTracingTool,
  vercelTracingTool,
  debugConsoleTool,
  learningSystemTool
};

// Re-export types
export type {
  AnalyticsReport,
  TraceSpan,
  PerformanceMetrics,
  AlertConfig
} from './advanced-analytics.js';

// Analytics tools collection for easy registration
export const analyticsTools = [
  analyticsReportTool,
  analyticsMonitoringTool,
  analyticsAlertTool,
  analyticsTracingTool
];
