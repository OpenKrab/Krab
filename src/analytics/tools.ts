// ============================================================
// 🦀 Krab — Analytics Tools
// ============================================================
import {
  AdvancedAnalytics,
  AnalyticsReport,
  TraceSpan,
  PerformanceMetrics,
} from "./advanced-analytics.js";
import { logger } from "../utils/logger.js";
import { ToolDefinition as ToolDefinition, ToolResult } from "../core/types.js";
import { z } from "zod";

export interface AnalyticsToolOptions {
  action: "report" | "traces" | "metrics" | "alerts" | "export";
  startDate?: string;
  endDate?: string;
  format?: "json" | "csv";
  includeTrends?: boolean;
  includeTraces?: boolean;
  alertId?: string;
  alertName?: string;
  alertMetric?: "responseTime" | "errorRate" | "cost" | "tokenUsage";
  alertOperator?: ">" | "<" | ">=" | "<=" | "==";
  alertThreshold?: number;
  alertChannels?: string[];
}

export class AnalyticsTools {
  private analytics: AdvancedAnalytics;

  constructor() {
    this.analytics = new AdvancedAnalytics();
  }

  async executeTool(options: AnalyticsToolOptions): Promise<ToolResult> {
    try {
      logger.info(`[AnalyticsTools] Executing: ${options.action}`);
      let report, traces, metrics, alerts, exportData;

      switch (options.action) {
        case "report":
          report = await this.generateReport(options);
          break;

        case "traces":
          traces = this.getTraces();
          break;

        case "metrics":
          metrics = this.getMetrics();
          break;

        case "alerts":
          alerts = this.getAlerts();
          break;

        case "export":
          exportData = await this.exportData(options);
          break;

        default:
          throw new Error(`Unknown analytics action: ${options.action}`);
      }

      const result = {
        success: true,
        output: JSON.stringify(
          {
            action: options.action,
            timestamp: new Date().toISOString(),
            ...(options.action === "report" && { report }),
            ...(options.action === "traces" && { traces }),
            ...(options.action === "metrics" && { metrics }),
            ...(options.action === "alerts" && { alerts }),
            ...(options.action === "export" && { exportData }),
          },
          null,
          2,
        ),
      };

      logger.info(`[AnalyticsTools] Action completed: ${options.action}`);
      return result;
    } catch (error) {
      logger.error(`[AnalyticsTools] Action failed: ${options.action}`, error);
      return {
        success: false,
        output: "",
        error: `Analytics action failed: ${(error as Error).message}`,
      };
    }
  }

  private async generateReport(
    options: AnalyticsToolOptions,
  ): Promise<AnalyticsReport> {
    const startDate = options.startDate
      ? new Date(options.startDate)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = options.endDate ? new Date(options.endDate) : new Date();

    return await this.analytics.generateReport(startDate, endDate, {
      includeTrends: options.includeTrends,
      generateInsights: true,
    });
  }

  private getTraces(): Array<{
    id: string;
    name: string;
    duration: number;
    startTime: Date;
    children: number;
  }> {
    // Get all active traces (simplified)
    const traces: TraceSpan[] = [];
    this.analytics["traces"].forEach((trace: TraceSpan) => {
      if (!trace.endTime) return; // Skip unfinished traces
      traces.push(trace);
    });

    return traces.slice(-50).map((trace) => ({
      id: trace.id,
      name: trace.name,
      duration: trace.duration || 0,
      startTime: trace.startTime,
      children: trace.children.length,
    }));
  }

  private getMetrics(): Array<{
    timestamp: string;
    model: string;
    responseTime: number;
    cost: number;
    success: boolean;
  }> {
    // Get recent metrics (simplified - would load from files in real implementation)
    const metrics: PerformanceMetrics[] = [];
    this.analytics["metrics"].forEach((metric: PerformanceMetrics) => {
      metrics.push(metric);
    });

    return metrics.slice(-100).map((metric) => ({
      timestamp: metric.timestamp.toISOString(),
      model: metric.model,
      responseTime: metric.responseTime,
      cost: metric.cost.total,
      success: metric.success,
    }));
  }

  private getAlerts(): Array<{
    id: string;
    name: string;
    enabled: boolean;
    lastTriggered?: string;
  }> {
    return this.analytics.getAlerts().map((alert) => ({
      id: alert.id,
      name: alert.name,
      enabled: alert.enabled,
      lastTriggered: alert.lastTriggered?.toISOString(),
    }));
  }

  private async exportData(options: AnalyticsToolOptions): Promise<string> {
    const format = options.format || "json";
    const includeTraces = options.includeTraces || false;

    return await this.analytics.exportData(format, includeTraces);
  }

  async startTrace(
    name: string,
    attributes: { [key: string]: any } = {},
  ): Promise<string> {
    return this.analytics.startTrace(name, attributes);
  }

  async endTrace(spanId: string): Promise<void> {
    this.analytics.endTrace(spanId);
  }

  async recordMetric(
    metric: Omit<PerformanceMetrics, "timestamp">,
  ): Promise<void> {
    this.analytics.recordMetric(metric);
  }

  async addAlert(
    name: string,
    condition: any,
    channels: string[] = [],
  ): Promise<string> {
    return this.analytics.addAlert({
      name,
      description: `Alert for ${condition.metric} ${condition.operator} ${condition.threshold}`,
      condition,
      channels: channels.map((channel) => ({
        type: "email" as const,
        target: channel,
      })),
      enabled: true,
      cooldown: 15,
    });
  }

  getAnalytics(): AdvancedAnalytics {
    return this.analytics;
  }
}

// ── Analytics Report Tool ───────────────────────────────────
export const analyticsReportTool: ToolDefinition = {
  name: "analytics_report",
  description:
    "Generate comprehensive analytics reports with performance metrics, trends, and insights for Krab usage optimization.",
  parameters: z.object({
    startDate: z
      .string()
      .optional()
      .describe("Start date for the report (ISO format)"),
    endDate: z
      .string()
      .optional()
      .describe("End date for the report (ISO format)"),
    includeTrends: z
      .boolean()
      .optional()
      .describe("Include time-series trends in the report"),
    format: z.enum(["json", "csv"]).optional().describe("Export format"),
  }),

  async execute(args: any): Promise<ToolResult> {
    const analyticsTools = new AnalyticsTools();
    return await analyticsTools.executeTool({
      action: "report",
      startDate: args.startDate,
      endDate: args.endDate,
      includeTrends: args.includeTrends,
      format: args.format,
    });
  },

  sideEffect: false,
  requireApproval: false,
};

// ── Analytics Monitoring Tool ───────────────────────────────
export const analyticsMonitoringTool: ToolDefinition = {
  name: "analytics_monitoring",
  description:
    "Monitor real-time analytics, traces, and performance metrics for observability and debugging.",
  parameters: z.object({
    action: z
      .enum(["traces", "metrics", "alerts", "export"])
      .describe("Monitoring action to perform"),
    includeTraces: z
      .boolean()
      .optional()
      .describe("Include trace data in export"),
    format: z.enum(["json", "csv"]).optional().describe("Export format"),
  }),

  async execute(args: any): Promise<ToolResult> {
    const analyticsTools = new AnalyticsTools();
    return await analyticsTools.executeTool({
      action: args.action,
      includeTraces: args.includeTraces,
      format: args.format,
    });
  },

  sideEffect: false,
  requireApproval: false,
};

// ── Analytics Alert Tool ────────────────────────────────────
export const analyticsAlertTool: ToolDefinition = {
  name: "analytics_alert",
  description:
    "Manage analytics alerts for monitoring performance, costs, and reliability thresholds.",
  parameters: z.object({
    action: z
      .enum(["list", "add", "update", "remove"])
      .describe("Alert management action"),
    alertName: z.string().optional().describe("Name for new alert"),
    alertMetric: z
      .enum(["responseTime", "errorRate", "cost", "tokenUsage"])
      .optional()
      .describe("Metric for alert condition"),
    alertOperator: z
      .enum([">", "<", ">=", "<=", "=="])
      .optional()
      .describe("Alert condition operator"),
    alertThreshold: z.number().optional().describe("Alert threshold value"),
    alertChannels: z
      .array(z.string())
      .optional()
      .describe("Notification channels for alert"),
    alertId: z
      .string()
      .optional()
      .describe("Alert ID for update/remove actions"),
  }),

  async execute(args: any): Promise<ToolResult> {
    const analyticsTools = new AnalyticsTools();

    try {
      switch (args.action) {
        case "list":
          return await analyticsTools.executeTool({ action: "alerts" });

        case "add":
          if (
            !args.alertName ||
            !args.alertMetric ||
            !args.alertOperator ||
            typeof args.alertThreshold !== "number"
          ) {
            throw new Error(
              "Alert name, metric, operator, and threshold are required",
            );
          }

          const alertId = await analyticsTools.addAlert(
            args.alertName,
            {
              metric: args.alertMetric,
              operator: args.alertOperator,
              threshold: args.alertThreshold,
              window: 5, // 5 minutes default
            },
            args.alertChannels || [],
          );

          return {
            success: true,
            output: JSON.stringify(
              {
                alertId,
                message: `Alert '${args.alertName}' added successfully`,
              },
              null,
              2,
            ),
          };

        case "update":
          if (!args.alertId) {
            throw new Error("Alert ID is required for update");
          }
          // Simplified update - would need full implementation
          return {
            success: false,
            output: "",
            error: "Alert update not implemented yet",
          };

        case "remove":
          if (!args.alertId) {
            throw new Error("Alert ID is required for removal");
          }

          const removed = analyticsTools
            .getAnalytics()
            .removeAlert(args.alertId);
          return {
            success: removed,
            output: removed
              ? `Alert ${args.alertId} removed successfully`
              : `Alert ${args.alertId} not found`,
          };

        default:
          throw new Error(`Unknown alert action: ${args.action}`);
      }
    } catch (error) {
      logger.error("[AnalyticsAlertTool] Action failed:", error);
      return {
        success: false,
        output: "",
        error: `Alert action failed: ${(error as Error).message}`,
      };
    }
  },

  sideEffect: true,
  requireApproval: false,
};

// ── Tracing Tool ───────────────────────────────────────────
export const analyticsTracingTool: ToolDefinition = {
  name: "analytics_tracing",
  description:
    "Distributed tracing for request flow analysis and performance debugging across Krab components.",
  parameters: z.object({
    action: z
      .enum(["start", "end", "event", "get"])
      .describe("Tracing action to perform"),
    traceName: z.string().optional().describe("Name for new trace span"),
    spanId: z.string().optional().describe("Span ID for operations"),
    eventName: z.string().optional().describe("Event name to add"),
    attributes: z
      .record(z.string(), z.any())
      .optional()
      .describe("Attributes for trace or event"),
  }),

  async execute(args: any): Promise<ToolResult> {
    const analyticsTools = new AnalyticsTools();

    try {
      switch (args.action) {
        case "start":
          if (!args.traceName) {
            throw new Error("Trace name is required");
          }

          const spanId = await analyticsTools.startTrace(
            args.traceName,
            args.attributes || {},
          );
          return {
            success: true,
            output: JSON.stringify(
              {
                spanId,
                message: `Trace '${args.traceName}' started`,
              },
              null,
              2,
            ),
          };

        case "end":
          if (!args.spanId) {
            throw new Error("Span ID is required");
          }

          await analyticsTools.endTrace(args.spanId);
          return {
            success: true,
            output: JSON.stringify(
              {
                spanId: args.spanId,
                message: "Trace ended",
              },
              null,
              2,
            ),
          };

        case "event":
          if (!args.spanId || !args.eventName) {
            throw new Error("Span ID and event name are required");
          }

          analyticsTools.getAnalytics().addTraceEvent(
            args.spanId,
            args.eventName,
            args.attributes || {},
          );
          return {
            success: true,
            output: JSON.stringify(
              {
                spanId: args.spanId,
                eventName: args.eventName,
                message: "Event added to trace",
              },
              null,
              2,
            ),
          };

        case "get":
          if (!args.spanId) {
            throw new Error("Span ID is required");
          }

          const trace = analyticsTools.getAnalytics().getTraceTree(args.spanId);
          return {
            success: !!trace,
            output: trace ? JSON.stringify(trace, null, 2) : "Trace not found",
          };

        default:
          throw new Error(`Unknown tracing action: ${args.action}`);
      }
    } catch (error) {
      logger.error("[AnalyticsTracingTool] Action failed:", error);
      return {
        success: false,
        output: "",
        error: `Tracing action failed: ${(error as Error).message}`,
      };
    }
  },

  sideEffect: false,
  requireApproval: false,
};

// ── Vercel AI Tracing Tool ───────────────────────────────────────
export const vercelTracingTool: ToolDefinition = {
  name: "vercel_ai_tracing",
  description:
    "Vercel AI SDK tracing integration for detailed request tracking, performance monitoring, and cost analysis.",
  parameters: z.object({
    action: z
      .enum(["record", "stats", "export"])
      .describe("Tracing action to perform"),
    trace: z
      .object({
        timestamp: z.date().describe("Trace timestamp"),
        duration: z.number().describe("Request duration in milliseconds"),
        model: z.string().describe("AI model used"),
        tokens: z
          .object({
            prompt: z.number().describe("Prompt tokens"),
            completion: z.number().describe("Completion tokens"),
            total: z.number().describe("Total tokens"),
          })
          .describe("Token usage"),
        cost: z.number().describe("Request cost"),
        success: z.boolean().describe("Request success status"),
        error: z.string().optional().describe("Error message if failed"),
        metadata: z
          .object({
            provider: z.string().describe("AI provider"),
            temperature: z.number().optional().describe("Temperature setting"),
            maxTokens: z.number().optional().describe("Max tokens setting"),
            userId: z.string().optional().describe("User ID"),
            sessionId: z.string().optional().describe("Session ID"),
            requestId: z.string().optional().describe("Request ID"),
          })
          .describe("Additional metadata"),
      })
      .optional()
      .describe("Trace data to record"),
    timeRange: z
      .number()
      .optional()
      .describe("Time range for stats in milliseconds"),
    format: z.enum(["json", "csv"]).optional().describe("Export format"),
  }),

  async execute(args: any): Promise<ToolResult> {
    const analyticsTools = new AnalyticsTools();
    const analytics = analyticsTools.getAnalytics();

    try {
      switch (args.action) {
        case "record":
          if (!args.trace) {
            throw new Error("Trace data is required for recording");
          }

          (analytics as any).recordVercelTrace(args.trace);
          return {
            success: true,
            output: `Trace recorded for model ${args.trace.model}`,
          };

        case "stats":
          const stats = (analytics as any).getVercelTraceStats(
            args.timeRange || 24 * 60 * 60 * 1000,
          );
          return {
            success: true,
            output: JSON.stringify(
              {
                timeRange: args.timeRange || 24 * 60 * 60 * 1000,
                stats,
              },
              null,
              2,
            ),
          };

        case "export":
          const exportData = await analytics.exportData(
            args.format || "json",
            true,
          );
          return {
            success: true,
            output:
              args.format === "csv"
                ? exportData
                : JSON.stringify(
                    {
                      format: args.format || "json",
                      data: exportData,
                    },
                    null,
                    2,
                  ),
          };

        default:
          throw new Error(`Unknown tracing action: ${args.action}`);
      }
    } catch (error) {
      logger.error("[VercelTracingTool] Action failed:", error);
      return {
        success: false,
        output: "",
        error: `Vercel AI tracing action failed: ${(error as Error).message}`,
      };
    }
  },

  sideEffect: false,
  requireApproval: false,
};

// ── Visual Debug Console Tool ─────────────────────────────────────
export const debugConsoleTool: ToolDefinition = {
  name: "debug_console",
  description:
    "Visual debug console for real-time monitoring of Krab system activity, errors, and performance metrics.",
  parameters: z.object({
    action: z
      .enum(["view", "add_entry", "clear", "generate_html"])
      .describe("Debug console action"),
    level: z
      .enum(["info", "warn", "error", "debug"])
      .optional()
      .describe("Log level for entries"),
    category: z
      .enum(["request", "response", "error", "system", "agent", "tool"])
      .optional()
      .describe("Log category"),
    message: z.string().optional().describe("Debug message"),
    data: z.any().optional().describe("Additional debug data"),
    limit: z.number().optional().describe("Number of entries to retrieve"),
  }),

  async execute(args: any): Promise<ToolResult> {
    const analyticsTools = new AnalyticsTools();
    const analytics = analyticsTools.getAnalytics();

    try {
      switch (args.action) {
        case "view":
          const entries = (analytics as any).getDebugEntries(
            args.limit || 50,
            args.level,
            args.category,
          );
          return {
            success: true,
            output: JSON.stringify(
              {
                entries: entries.map((entry) => ({
                  id: entry.id,
                  timestamp: entry.timestamp.toISOString(),
                  level: entry.level,
                  category: entry.category,
                  message: entry.message,
                  data: entry.data,
                  traceId: entry.traceId,
                  sessionId: entry.sessionId,
                  userId: entry.userId,
                })),
                total: entries.length,
              },
              null,
              2,
            ),
          };

        case "add_entry":
          if (!args.message) {
            throw new Error("Message is required for adding debug entry");
          }

          (analytics as any).addDebugEntry({
            timestamp: new Date(),
            level: args.level || "info",
            category: args.category || "system",
            message: args.message,
            data: args.data,
          });

          return {
            success: true,
            output: `Debug entry added: ${args.message}`,
          };

        case "clear":
          (analytics as any).clearDebugEntries();
          return {
            success: true,
            output: "Debug entries cleared",
          };

        case "generate_html":
          const html = (analytics as any).generateDebugConsoleHTML();
          return {
            success: true,
            output: html,
          };

        default:
          throw new Error(`Unknown debug console action: ${args.action}`);
      }
    } catch (error) {
      logger.error("[DebugConsoleTool] Action failed:", error);
      return {
        success: false,
        output: "",
        error: `Debug console action failed: ${(error as Error).message}`,
      };
    }
  },

  sideEffect: false,
  requireApproval: false,
};

// ── Learning System Tool ──────────────────────────────────────────
export const learningSystemTool: ToolDefinition = {
  name: "learning_system",
  description:
    "AI-powered learning system that analyzes system behavior, identifies patterns, and provides actionable insights for optimization.",
  parameters: z.object({
    action: z
      .enum([
        "generate_insights",
        "apply_insight",
        "get_insights",
        "analyze_errors",
      ])
      .describe("Learning system action"),
    insightId: z.string().optional().describe("Insight ID to apply"),
    limit: z.number().optional().describe("Number of insights to retrieve"),
  }),

  async execute(args: any): Promise<ToolResult> {
    const analyticsTools = new AnalyticsTools();
    const analytics = analyticsTools.getAnalytics();

    try {
      switch (args.action) {
        case "generate_insights":
          const insights = (analytics as any).generateLearningInsights();
          return {
            success: true,
            output: JSON.stringify(
              {
                insights: insights.map((insight) => ({
                  id: insight.id,
                  timestamp: insight.timestamp.toISOString(),
                  type: insight.type,
                  title: insight.title,
                  description: insight.description,
                  severity: insight.severity,
                  recommendation: insight.recommendation,
                  confidence: insight.confidence,
                  applied: insight.applied,
                  appliedAt: insight.appliedAt?.toISOString(),
                  impact: insight.impact,
                })),
                total: insights.length,
              },
              null,
              2,
            ),
          };

        case "apply_insight":
          if (!args.insightId) {
            throw new Error("Insight ID is required");
          }

          const applied = (analytics as any).applyLearningInsight(
            args.insightId,
          );
          return {
            success: applied,
            output: applied
              ? `Insight ${args.insightId} applied successfully`
              : `Insight ${args.insightId} not found`,
          };

        case "get_insights":
          const allInsights = (analytics as any).getLearningInsights(
            args.limit || 20,
          );
          return {
            success: true,
            output: JSON.stringify(
              {
                insights: allInsights.map((insight) => ({
                  id: insight.id,
                  timestamp: insight.timestamp.toISOString(),
                  type: insight.type,
                  title: insight.title,
                  severity: insight.severity,
                  applied: insight.applied,
                  confidence: insight.confidence,
                })),
                total: allInsights.length,
              },
              null,
              2,
            ),
          };

        case "analyze_errors":
          const errorPatterns = (analytics as any).analyzeErrorPatterns();
          return {
            success: true,
            output: JSON.stringify(
              {
                patterns: errorPatterns.map((pattern) => ({
                  id: pattern.id,
                  pattern: pattern.pattern,
                  description: pattern.description,
                  frequency: pattern.frequency,
                  lastSeen: pattern.lastSeen.toISOString(),
                  affectedComponents: pattern.affectedComponents,
                  suggestedFixes: pattern.suggestedFixes,
                  confidence: pattern.confidence,
                })),
                total: errorPatterns.length,
              },
              null,
              2,
            ),
          };

        default:
          throw new Error(`Unknown learning system action: ${args.action}`);
      }
    } catch (error) {
      logger.error("[LearningSystemTool] Action failed:", error);
      return {
        success: false,
        output: "",
        error: `Learning system action failed: ${(error as Error).message}`,
      };
    }
  },

  sideEffect: true,
  requireApproval: false,
};
