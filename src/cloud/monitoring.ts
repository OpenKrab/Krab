// ============================================================
// 🦀 Krab — Cloud Monitoring & Analytics
// ============================================================
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

export interface MetricsData {
  timestamp: Date;
  requests: number;
  errors: number;
  latency: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  uptime: number;
}

export interface AnalyticsData {
  period: 'hour' | 'day' | 'week' | 'month';
  totalRequests: number;
  totalErrors: number;
  averageLatency: number;
  peakMemoryUsage: number;
  peakCpuUsage: number;
  topEndpoints: Array<{ endpoint: string; requests: number }>;
  topErrors: Array<{ error: string; count: number }>;
  userActivity: Array<{ userId: string; requests: number }>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: {
    metric: 'cpu' | 'memory' | 'errors' | 'latency' | 'requests';
    operator: '>' | '<' | '>=' | '<=' | '==';
    threshold: number;
  };
  enabled: boolean;
  channels: string[]; // email, webhook, slack, etc.
  lastTriggered?: Date;
}

export class CloudMonitoring {
  private metrics: MetricsData[] = [];
  private alerts: AlertRule[] = [];
  private metricsPath: string;
  private alertsPath: string;
  private maxMetricsHistory = 10000; // Keep last 10k metrics

  constructor() {
    this.metricsPath = path.join(process.cwd(), 'cloud-metrics.json');
    this.alertsPath = path.join(process.cwd(), 'cloud-alerts.json');
    this.loadData();
  }

  private loadData(): void {
    try {
      // Load metrics
      if (fs.existsSync(this.metricsPath)) {
        const metricsData = JSON.parse(fs.readFileSync(this.metricsPath, 'utf8'));
        this.metrics = metricsData.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
      }

      // Load alerts
      if (fs.existsSync(this.alertsPath)) {
        this.alerts = JSON.parse(fs.readFileSync(this.alertsPath, 'utf8'));
      }
    } catch (error) {
      logger.error('Failed to load monitoring data:', error);
    }
  }

  private saveData(): void {
    try {
      // Save metrics (keep only recent ones)
      const recentMetrics = this.metrics.slice(-this.maxMetricsHistory);
      fs.writeFileSync(this.metricsPath, JSON.stringify(recentMetrics, null, 2));

      // Save alerts
      fs.writeFileSync(this.alertsPath, JSON.stringify(this.alerts, null, 2));
    } catch (error) {
      logger.error('Failed to save monitoring data:', error);
    }
  }

  recordMetrics(data: Partial<MetricsData>): void {
    const metrics: MetricsData = {
      timestamp: new Date(),
      requests: data.requests || 0,
      errors: data.errors || 0,
      latency: data.latency || 0,
      memoryUsage: data.memoryUsage || process.memoryUsage().heapUsed,
      cpuUsage: data.cpuUsage || 0,
      activeConnections: data.activeConnections || 0,
      uptime: data.uptime || process.uptime()
    };

    this.metrics.push(metrics);

    // Check alerts
    this.checkAlerts(metrics);

    // Save periodically (every 100 metrics)
    if (this.metrics.length % 100 === 0) {
      this.saveData();
    }
  }

  private checkAlerts(metrics: MetricsData): void {
    for (const alert of this.alerts) {
      if (!alert.enabled) continue;

      let triggered = false;
      const value = metrics[alert.condition.metric as keyof MetricsData] as number;

      switch (alert.condition.operator) {
        case '>':
          triggered = value > alert.condition.threshold;
          break;
        case '<':
          triggered = value < alert.condition.threshold;
          break;
        case '>=':
          triggered = value >= alert.condition.threshold;
          break;
        case '<=':
          triggered = value <= alert.condition.threshold;
          break;
        case '==':
          triggered = value === alert.condition.threshold;
          break;
      }

      if (triggered) {
        this.triggerAlert(alert, metrics);
        alert.lastTriggered = new Date();
        this.saveData();
      }
    }
  }

  private triggerAlert(alert: AlertRule, metrics: MetricsData): void {
    logger.warn(`🚨 Alert triggered: ${alert.name}`);
    logger.warn(`Condition: ${alert.condition.metric} ${alert.condition.operator} ${alert.condition.threshold}`);
    logger.warn(`Current value: ${metrics[alert.condition.metric as keyof MetricsData]}`);

    // TODO: Send notifications via configured channels
    // For now, just log the alert
    this.emit('alert', {
      alertId: alert.id,
      alertName: alert.name,
      metrics,
      triggeredAt: new Date()
    });
  }

  addAlert(alert: Omit<AlertRule, 'id' | 'lastTriggered'>): string {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newAlert: AlertRule = {
      id: alertId,
      ...alert
    };

    this.alerts.push(newAlert);
    this.saveData();

    logger.info(`✅ Alert added: ${alert.name} (${alertId})`);
    return alertId;
  }

  removeAlert(alertId: string): boolean {
    const index = this.alerts.findIndex(a => a.id === alertId);
    if (index === -1) return false;

    this.alerts.splice(index, 1);
    this.saveData();

    logger.info(`🗑️ Alert removed: ${alertId}`);
    return true;
  }

  getAlerts(): AlertRule[] {
    return [...this.alerts];
  }

  getMetrics(limit: number = 100): MetricsData[] {
    return this.metrics.slice(-limit);
  }

  getAnalytics(period: 'hour' | 'day' | 'week' | 'month' = 'day'): AnalyticsData {
    const now = new Date();
    let startTime: Date;

    switch (period) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const periodMetrics = this.metrics.filter(m => m.timestamp >= startTime);

    if (periodMetrics.length === 0) {
      return {
        period,
        totalRequests: 0,
        totalErrors: 0,
        averageLatency: 0,
        peakMemoryUsage: 0,
        peakCpuUsage: 0,
        topEndpoints: [],
        topErrors: [],
        userActivity: []
      };
    }

    const totalRequests = periodMetrics.reduce((sum, m) => sum + m.requests, 0);
    const totalErrors = periodMetrics.reduce((sum, m) => sum + m.errors, 0);
    const averageLatency = periodMetrics.reduce((sum, m) => sum + m.latency, 0) / periodMetrics.length;
    const peakMemoryUsage = Math.max(...periodMetrics.map(m => m.memoryUsage));
    const peakCpuUsage = Math.max(...periodMetrics.map(m => m.cpuUsage));

    // TODO: Implement endpoint tracking, error categorization, and user activity
    const topEndpoints: Array<{ endpoint: string; requests: number }> = [];
    const topErrors: Array<{ error: string; count: number }> = [];
    const userActivity: Array<{ userId: string; requests: number }> = [];

    return {
      period,
      totalRequests,
      totalErrors,
      averageLatency,
      peakMemoryUsage,
      peakCpuUsage,
      topEndpoints,
      topErrors,
      userActivity
    };
  }

  getHealthStatus(): any {
    const latest = this.metrics[this.metrics.length - 1];
    const analytics = this.getAnalytics('hour');

    return {
      status: 'healthy', // TODO: Implement health checks
      uptime: latest?.uptime || process.uptime(),
      memoryUsage: latest?.memoryUsage || process.memoryUsage().heapUsed,
      cpuUsage: latest?.cpuUsage || 0,
      activeAlerts: this.alerts.filter(a => a.lastTriggered).length,
      recentRequests: analytics.totalRequests,
      recentErrors: analytics.totalErrors,
      timestamp: new Date().toISOString()
    };
  }

  // Event emitter methods (simplified)
  private listeners: { [event: string]: Function[] } = {};

  on(event: string, listener: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  private emit(event: string, data: any): void {
    const eventListeners = this.listeners[event];
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data));
    }
  }
}

// ── Cloud Monitoring Tool ───────────────────────────────────
export const cloudMonitoringTool: Tool = {
  name: "cloud_monitoring",
  description: "Monitor cloud deployments with real-time metrics, analytics, and alerting for performance optimization.",
  parameters: z.object({
    action: z.enum(["metrics", "analytics", "alerts", "health", "add_alert", "remove_alert"]).describe("Monitoring action to perform"),
    limit: z.number().optional().describe("Number of metrics to retrieve"),
    period: z.enum(["hour", "day", "week", "month"]).optional().describe("Analytics time period"),
    alertName: z.string().optional().describe("Name for new alert"),
    alertMetric: z.enum(["cpu", "memory", "errors", "latency", "requests"]).optional().describe("Metric for alert condition"),
    alertOperator: z.enum([">", "<", ">=", "<=", "=="]).optional().describe("Alert condition operator"),
    alertThreshold: z.number().optional().describe("Alert threshold value"),
    alertChannels: z.array(z.string()).optional().describe("Notification channels for alert"),
    alertId: z.string().optional().describe("Alert ID for removal")
  }),

  async execute(args: any): Promise<ToolResult> {
    const monitoring = new CloudMonitoring();

    try {
      switch (args.action) {
        case 'metrics':
          const metrics = monitoring.getMetrics(args.limit || 100);
          return {
            success: true,
            output: JSON.stringify({
              metrics: metrics.map(m => ({
                timestamp: m.timestamp.toISOString(),
                requests: m.requests,
                errors: m.errors,
                latency: m.latency,
                memoryUsage: m.memoryUsage,
                cpuUsage: m.cpuUsage,
                activeConnections: m.activeConnections,
                uptime: m.uptime
              })),
              totalMetrics: metrics.length
            }, null, 2)
          };

        case 'analytics':
          const analytics = monitoring.getAnalytics(args.period || 'day');
          return {
            success: true,
            output: JSON.stringify(analytics, null, 2)
          };

        case 'alerts':
          const alerts = monitoring.getAlerts();
          return {
            success: true,
            output: JSON.stringify({
              alerts: alerts.map(a => ({
                id: a.id,
                name: a.name,
                condition: a.condition,
                enabled: a.enabled,
                channels: a.channels,
                lastTriggered: a.lastTriggered?.toISOString()
              })),
              totalAlerts: alerts.length
            }, null, 2)
          };

        case 'health':
          const health = monitoring.getHealthStatus();
          return {
            success: true,
            output: JSON.stringify(health, null, 2)
          };

        case 'add_alert':
          if (!args.alertName || !args.alertMetric || !args.alertOperator || typeof args.alertThreshold !== 'number') {
            throw new Error('Alert name, metric, operator, and threshold are required');
          }

          const alertId = monitoring.addAlert({
            name: args.alertName,
            condition: {
              metric: args.alertMetric,
              operator: args.alertOperator,
              threshold: args.alertThreshold
            },
            enabled: true,
            channels: args.alertChannels || ['log']
          });

          return {
            success: true,
            output: JSON.stringify({
              alertId,
              message: `Alert '${args.alertName}' added successfully`
            }, null, 2)
          };

        case 'remove_alert':
          if (!args.alertId) {
            throw new Error('Alert ID is required');
          }

          const removed = monitoring.removeAlert(args.alertId);

          return {
            success: removed,
            output: removed
              ? `Alert ${args.alertId} removed successfully`
              : `Alert ${args.alertId} not found`
          };

        default:
          throw new Error(`Unknown monitoring action: ${args.action}`);
      }

    } catch (error) {
      logger.error('[CloudMonitoringTool] Action failed:', error);
      return {
        success: false,
        output: "",
        error: `Cloud monitoring action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// Factory function
export function createCloudMonitoring(): CloudMonitoring {
  return new CloudMonitoring();
}

// Export for dynamic loading
export default CloudMonitoring;
