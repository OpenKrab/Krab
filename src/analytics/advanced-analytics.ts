// ============================================================
// 🦀 Krab — Advanced Analytics & Observability
// ============================================================
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TraceSpan {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  attributes: { [key: string]: any };
  events: Array<{
    name: string;
    timestamp: Date;
    attributes: { [key: string]: any };
  }>;
  parentSpanId?: string;
  children: TraceSpan[];
}

export interface PerformanceMetrics {
  timestamp: Date;
  responseTime: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost: {
    input: number;
    output: number;
    total: number;
  };
  model: string;
  provider: string;
  success: boolean;
  errorType?: string;
}

export interface AnalyticsReport {
  period: {
    start: Date;
    end: Date;
    duration: number;
  };
  summary: {
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
    totalTokens: number;
    totalCost: number;
    successRate: number;
  };
  breakdowns: {
    byModel: Array<{ model: string; requests: number; avgResponseTime: number; cost: number }>;
    byProvider: Array<{ provider: string; requests: number; successRate: number }>;
    byEndpoint: Array<{ endpoint: string; requests: number; avgResponseTime: number }>;
    byError: Array<{ error: string; count: number; percentage: number }>;
  };
  trends: {
    requestsOverTime: Array<{ timestamp: Date; count: number }>;
    responseTimeOverTime: Array<{ timestamp: Date; avgTime: number }>;
    costOverTime: Array<{ timestamp: Date; cost: number }>;
  };
  insights: Array<{
    type: 'performance' | 'cost' | 'reliability' | 'usage';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    recommendation: string;
  }>;
}

export interface VercelTrace {
  id: string;
  timestamp: Date;
  duration: number;
  model: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost: number;
  success: boolean;
  error?: string;
  metadata: {
    provider: string;
    temperature?: number;
    maxTokens?: number;
    userId?: string;
    sessionId?: string;
    requestId?: string;
  };
}

export interface DebugConsoleEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'request' | 'response' | 'error' | 'system' | 'agent' | 'tool';
  message: string;
  data?: any;
  traceId?: string;
  sessionId?: string;
  userId?: string;
}

export interface LearningInsight {
  id: string;
  timestamp: Date;
  type: 'performance' | 'reliability' | 'cost' | 'usage' | 'error';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  confidence: number; // 0-1
  applied: boolean;
  appliedAt?: Date;
  impact?: {
    metric: string;
    before: number;
    after: number;
    improvement: number;
  };
}

export interface ErrorPattern {
  id: string;
  pattern: string;
  description: string;
  frequency: number;
  lastSeen: Date;
  affectedComponents: string[];
  suggestedFixes: string[];
  confidence: number;
}

export interface AlertConfig {
  id: string;
  name: string;
  description: string;
  condition: {
    metric: 'responseTime' | 'errorRate' | 'cost' | 'tokenUsage';
    operator: '>' | '<' | '>=' | '<=' | '==';
    threshold: number;
    window: number; // minutes
  };
  channels: Array<{
    type: 'email' | 'webhook' | 'slack' | 'discord';
    target: string;
  }>;
  enabled: boolean;
  cooldown: number; // minutes between alerts
  lastTriggered?: Date;
}

export class AdvancedAnalytics {
  private traces: Map<string, TraceSpan> = new Map();
  private metrics: PerformanceMetrics[] = [];
  private alerts: Map<string, AlertConfig> = new Map();
  private vercelTraces: VercelTrace[] = [];
  private debugEntries: DebugConsoleEntry[] = [];
  private learningInsights: LearningInsight[] = [];
  private errorPatterns: ErrorPattern[] = [];
  private dataPath: string;
  private maxDataAge: number = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(dataPath?: string) {
    this.dataPath = dataPath || path.join(process.cwd(), 'analytics-data');
    this.ensureDataDirectory();
    this.loadData();
    this.initializeDefaultAlerts();
  }

  private ensureDataDirectory(): void {
    const dirs = [
      this.dataPath,
      path.join(this.dataPath, 'traces'),
      path.join(this.dataPath, 'metrics'),
      path.join(this.dataPath, 'reports')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private loadData(): void {
    try {
      // Load alerts
      const alertsFile = path.join(this.dataPath, 'alerts.json');
      if (fs.existsSync(alertsFile)) {
        const alertsData = JSON.parse(fs.readFileSync(alertsFile, 'utf8'));
        Object.entries(alertsData).forEach(([id, alert]: [string, any]) => {
          this.alerts.set(id, {
            ...alert,
            lastTriggered: alert.lastTriggered ? new Date(alert.lastTriggered) : undefined
          });
        });
      }
    } catch (error) {
      logger.error('Failed to load analytics data:', error);
    }
  }

  private saveData(): void {
    try {
      // Save alerts
      const alertsData: { [key: string]: any } = {};
      this.alerts.forEach((alert, id) => {
        alertsData[id] = alert;
      });
      fs.writeFileSync(
        path.join(this.dataPath, 'alerts.json'),
        JSON.stringify(alertsData, null, 2)
      );
    } catch (error) {
      logger.error('Failed to save analytics data:', error);
    }
  }

  private initializeDefaultAlerts(): void {
    const defaultAlerts: Omit<AlertConfig, 'id'>[] = [
      {
        name: 'High Response Time',
        description: 'Average response time is too high',
        condition: {
          metric: 'responseTime',
          operator: '>',
          threshold: 10000, // 10 seconds
          window: 5 // 5 minutes
        },
        channels: [{ type: 'email', target: 'admin@company.com' }],
        enabled: true,
        cooldown: 15
      },
      {
        name: 'High Error Rate',
        description: 'Error rate is above acceptable threshold',
        condition: {
          metric: 'errorRate',
          operator: '>',
          threshold: 0.1, // 10%
          window: 10 // 10 minutes
        },
        channels: [{ type: 'slack', target: '#alerts' }],
        enabled: true,
        cooldown: 30
      },
      {
        name: 'Cost Spike',
        description: 'API costs are increasing rapidly',
        condition: {
          metric: 'cost',
          operator: '>',
          threshold: 50, // $50
          window: 60 // 1 hour
        },
        channels: [{ type: 'webhook', target: 'https://hooks.company.com/alerts' }],
        enabled: true,
        cooldown: 60
      }
    ];

    defaultAlerts.forEach(alert => {
      const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.alerts.set(id, { ...alert, id });
    });

    this.saveData();
  }

  // Tracing functionality
  startTrace(name: string, attributes: { [key: string]: any } = {}, parentSpanId?: string): string {
    const spanId = `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const span: TraceSpan = {
      id: spanId,
      name,
      startTime: new Date(),
      attributes,
      events: [],
      parentSpanId,
      children: []
    };

    this.traces.set(spanId, span);

    // Add to parent if exists
    if (parentSpanId) {
      const parent = this.traces.get(parentSpanId);
      if (parent) {
        parent.children.push(span);
      }
    }

    logger.debug(`[Analytics] Started trace: ${name} (${spanId})`);
    return spanId;
  }

  endTrace(spanId: string, attributes: { [key: string]: any } = {}): void {
    const span = this.traces.get(spanId);
    if (!span) {
      logger.warn(`[Analytics] Trace not found: ${spanId}`);
      return;
    }

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    Object.assign(span.attributes, attributes);

    logger.debug(`[Analytics] Ended trace: ${span.name} (${spanId}) - ${span.duration}ms`);
  }

  addTraceEvent(spanId: string, eventName: string, attributes: { [key: string]: any } = {}): void {
    const span = this.traces.get(spanId);
    if (!span) {
      logger.warn(`[Analytics] Span not found for event: ${spanId}`);
      return;
    }

    span.events.push({
      name: eventName,
      timestamp: new Date(),
      attributes
    });
  }

  getTrace(spanId: string): TraceSpan | null {
    return this.traces.get(spanId) || null;
  }

  getTraceTree(spanId: string): TraceSpan | null {
    const span = this.traces.get(spanId);
    if (!span) return null;

    // Recursively build tree
    const buildTree = (s: TraceSpan): TraceSpan => ({
      ...s,
      children: s.children.map(buildTree)
    });

    return buildTree(span);
  }

  // Metrics collection
  recordMetric(metric: Omit<PerformanceMetrics, 'timestamp'>): void {
    const fullMetric: PerformanceMetrics = {
      ...metric,
      timestamp: new Date()
    };

    this.metrics.push(fullMetric);

    // Check alerts
    this.checkAlerts(fullMetric);

    // Save metrics periodically (every 10 metrics)
    if (this.metrics.length % 10 === 0) {
      this.saveMetrics();
    }

    // Clean old data
    this.cleanupOldData();
  }

  private checkAlerts(metric: PerformanceMetrics): void {
    // This would implement the alert checking logic
    // For now, just log high error rates or slow responses
    if (!metric.success) {
      logger.warn(`[Analytics] Request failed: ${metric.errorType}`);
    }

    if (metric.responseTime > 5000) {
      logger.warn(`[Analytics] Slow response: ${metric.responseTime}ms`);
    }
  }

  private saveMetrics(): void {
    try {
      const metricsFile = path.join(this.dataPath, 'metrics', `metrics-${Date.now()}.json`);
      fs.writeFileSync(metricsFile, JSON.stringify(this.metrics.slice(-100), null, 2));
      this.metrics = []; // Clear in-memory metrics after saving
    } catch (error) {
      logger.error('Failed to save metrics:', error);
    }
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - this.maxDataAge;

    // Clean traces
    for (const [id, trace] of this.traces.entries()) {
      if (trace.startTime.getTime() < cutoff) {
        this.traces.delete(id);
      }
    }

    // Clean metrics files
    try {
      const metricsDir = path.join(this.dataPath, 'metrics');
      const files = fs.readdirSync(metricsDir);
      files.forEach(file => {
        const filePath = path.join(metricsDir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtime.getTime() < cutoff) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  // Analytics generation
  async generateReport(
    startDate: Date,
    endDate: Date = new Date(),
    options: {
      includeTrends?: boolean;
      generateInsights?: boolean;
    } = {}
  ): Promise<AnalyticsReport> {
    // Load metrics from files
    const allMetrics = await this.loadMetricsInRange(startDate, endDate);

    const totalRequests = allMetrics.length;
    const totalErrors = allMetrics.filter(m => !m.success).length;
    const averageResponseTime = allMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests || 0;
    const totalTokens = allMetrics.reduce((sum, m) => sum + m.tokenUsage.total, 0);
    const totalCost = allMetrics.reduce((sum, m) => sum + m.cost.total, 0);
    const successRate = totalRequests > 0 ? (totalRequests - totalErrors) / totalRequests : 1;

    // Generate breakdowns
    const byModel = this.groupBy(allMetrics, 'model').map(([model, metrics]) => ({
      model,
      requests: metrics.length,
      avgResponseTime: metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length,
      cost: metrics.reduce((sum, m) => sum + m.cost.total, 0)
    }));

    const byProvider = this.groupBy(allMetrics, 'provider').map(([provider, metrics]) => ({
      provider,
      requests: metrics.length,
      successRate: metrics.filter(m => m.success).length / metrics.length
    }));

    // Generate insights
    const insights = [];
    if (averageResponseTime > 5000) {
      insights.push({
        type: 'performance' as const,
        severity: 'high' as const,
        title: 'High Average Response Time',
        description: `Average response time is ${Math.round(averageResponseTime)}ms, which may impact user experience.`,
        recommendation: 'Consider optimizing model selection or implementing caching.'
      });
    }

    if (successRate < 0.95) {
      insights.push({
        type: 'reliability' as const,
        severity: 'high' as const,
        title: 'Low Success Rate',
        description: `Success rate is ${(successRate * 100).toFixed(1)}%, indicating reliability issues.`,
        recommendation: 'Investigate error patterns and implement retry mechanisms.'
      });
    }

    return {
      period: {
        start: startDate,
        end: endDate,
        duration: endDate.getTime() - startDate.getTime()
      },
      summary: {
        totalRequests,
        totalErrors,
        averageResponseTime,
        totalTokens,
        totalCost,
        successRate
      },
      breakdowns: {
        byModel,
        byProvider,
        byEndpoint: [], // TODO: Implement endpoint tracking
        byError: [] // TODO: Implement error categorization
      },
      trends: options.includeTrends ? await this.generateTrends(startDate, endDate) : {
        requestsOverTime: [],
        responseTimeOverTime: [],
        costOverTime: []
      },
      insights
    };
  }

  private async loadMetricsInRange(startDate: Date, endDate: Date): Promise<PerformanceMetrics[]> {
    const metrics: PerformanceMetrics[] = [];

    try {
      const metricsDir = path.join(this.dataPath, 'metrics');
      const files = fs.readdirSync(metricsDir);

      for (const file of files) {
        const filePath = path.join(metricsDir, file);
        const fileMetrics: PerformanceMetrics[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        metrics.push(...fileMetrics.filter(m =>
          new Date(m.timestamp) >= startDate && new Date(m.timestamp) <= endDate
        ));
      }
    } catch (error) {
      logger.error('Failed to load metrics range:', error);
    }

    return metrics;
  }

  private async generateTrends(startDate: Date, endDate: Date): Promise<{
    requestsOverTime: Array<{ timestamp: Date; count: number }>;
    responseTimeOverTime: Array<{ timestamp: Date; avgTime: number }>;
    costOverTime: Array<{ timestamp: Date; cost: number }>;
  }> {
    const metrics = await this.loadMetricsInRange(startDate, endDate);
    const hourlyBuckets = new Map<string, PerformanceMetrics[]>();

    // Group by hour
    metrics.forEach(metric => {
      const hour = new Date(metric.timestamp);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();

      if (!hourlyBuckets.has(key)) {
        hourlyBuckets.set(key, []);
      }
      hourlyBuckets.get(key)!.push(metric);
    });

    const requestsOverTime: Array<{ timestamp: Date; count: number }> = [];
    const responseTimeOverTime: Array<{ timestamp: Date; avgTime: number }> = [];
    const costOverTime: Array<{ timestamp: Date; cost: number }> = [];

    hourlyBuckets.forEach((bucketMetrics, timestamp) => {
      requestsOverTime.push({
        timestamp: new Date(timestamp),
        count: bucketMetrics.length
      });

      const avgResponseTime = bucketMetrics.reduce((sum, m) => sum + m.responseTime, 0) / bucketMetrics.length;
      responseTimeOverTime.push({
        timestamp: new Date(timestamp),
        avgTime: avgResponseTime
      });

      const totalCost = bucketMetrics.reduce((sum, m) => sum + m.cost.total, 0);
      costOverTime.push({
        timestamp: new Date(timestamp),
        cost: totalCost
      });
    });

    return { requestsOverTime, responseTimeOverTime, costOverTime };
  }

  private groupBy<T>(array: T[], key: keyof T): Array<[string, T[]]> {
    const groups = new Map<string, T[]>();
    array.forEach(item => {
      const groupKey = String(item[key]);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    });
    return Array.from(groups.entries());
  }

  // Alert management
  addAlert(alert: Omit<AlertConfig, 'id'>): string {
    const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullAlert: AlertConfig = { ...alert, id };
    this.alerts.set(id, fullAlert);
    this.saveData();
    logger.info(`[Analytics] Alert added: ${alert.name}`);
    return id;
  }

  updateAlert(id: string, updates: Partial<Omit<AlertConfig, 'id'>>): boolean {
    const alert = this.alerts.get(id);
    if (!alert) return false;

    Object.assign(alert, updates);
    this.saveData();
    logger.info(`[Analytics] Alert updated: ${id}`);
    return true;
  }

  removeAlert(id: string): boolean {
    const removed = this.alerts.delete(id);
    if (removed) {
      this.saveData();
      logger.info(`[Analytics] Alert removed: ${id}`);
    }
    return removed;
  }

  getAlerts(): AlertConfig[] {
    return Array.from(this.alerts.values());
  }

  // Export functionality
  async exportData(format: 'json' | 'csv', includeTraces: boolean = false): Promise<string> {
    const exportData: any = {
      exportedAt: new Date().toISOString(),
      metrics: await this.loadMetricsInRange(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()),
      alerts: this.getAlerts()
    };

    if (includeTraces) {
      exportData.traces = Array.from(this.traces.values());
    }

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else {
      // Convert to CSV (simplified)
      const csvLines = ['timestamp,model,provider,responseTime,tokens,cost,success'];
      exportData.metrics.forEach((m: PerformanceMetrics) => {
        csvLines.push(`${m.timestamp.toISOString()},${m.model},${m.provider},${m.responseTime},${m.tokenUsage.total},${m.cost.total},${m.success}`);
      });
      return csvLines.join('\n');
    }
  }
}

// ── Vercel AI Tracing Integration ──────────────────────────────────
export class VercelAITracing {
  private analytics: AdvancedAnalytics;

  constructor(analytics: AdvancedAnalytics) {
    this.analytics = analytics;
  }

  // Record AI model usage traces
  recordTrace(trace: Omit<VercelTrace, 'id'>): void {
    (this.analytics as any).recordVercelTrace(trace);
  }

  // Get tracing statistics
  getTracingStats(timeRange: number = 24 * 60 * 60 * 1000): any {
    return (this.analytics as any).getVercelTraceStats(timeRange);
  }

  // Export traces for analysis
  exportTraces(format: 'json' | 'csv' = 'json'): Promise<string> {
    return this.analytics.exportData(format, true);
  }
}

// ── Visual Debug Console ──────────────────────────────────────────
export class VisualDebugConsole {
  private analytics: AdvancedAnalytics;
  private port: number;

  constructor(analytics: AdvancedAnalytics, port: number = 3002) {
    this.analytics = analytics;
    this.port = port;
  }

  // Generate HTML for debug console
  generateConsoleHTML(): string {
    const entries = (this.analytics as any).getDebugEntries(50);
    const insights = (this.analytics as any).getLearningInsights(10);
    const stats = (this.analytics as any).getVercelTraceStats();

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Krab Debug Console</title>
    <style>
        body { font-family: monospace; margin: 20px; background: #1a1a1a; color: #fff; }
        .container { max-width: 1200px; margin: 0 auto; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #333; border-radius: 5px; }
        .entry { margin: 5px 0; padding: 5px; border-left: 3px solid; }
        .entry.error { border-left-color: #ff4444; }
        .entry.warn { border-left-color: #ffaa00; }
        .entry.info { border-left-color: #44aaff; }
        .entry.debug { border-left-color: #888; }
        .insight { margin: 10px 0; padding: 10px; background: #2a2a2a; border-radius: 3px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #333; border-radius: 3px; }
        .high { color: #ff4444; }
        .medium { color: #ffaa00; }
        .low { color: #44ff44; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🦀 Krab Debug Console</h1>

        <div class="section">
            <h2>📊 System Metrics</h2>
            <div class="metric">Requests: <span class="${stats.totalRequests > 1000 ? 'high' : 'low'}">${stats.totalRequests}</span></div>
            <div class="metric">Success Rate: <span class="${stats.successRate < 0.95 ? 'high' : 'low'}">${(stats.successRate * 100).toFixed(1)}%</span></div>
            <div class="metric">Avg Duration: <span class="${stats.averageDuration > 3000 ? 'high' : 'low'}">${Math.round(stats.averageDuration)}ms</span></div>
            <div class="metric">Total Cost: <span class="${stats.totalCost > 10 ? 'high' : 'low'}">$${stats.totalCost.toFixed(2)}</span></div>
        </div>

        <div class="section">
            <h2>🧠 Learning Insights</h2>
            ${insights.map((insight: any) => `
                <div class="insight">
                    <strong class="${insight.severity}">[${insight.severity.toUpperCase()}] ${insight.title}</strong>
                    <p>${insight.description}</p>
                    <p><em>Recommendation: ${insight.recommendation}</em></p>
                    <small>Confidence: ${(insight.confidence * 100).toFixed(0)}%</small>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>📋 Recent Debug Entries</h2>
            ${entries.map((entry: any) => `
                <div class="entry ${entry.level}">
                    <strong>${entry.timestamp.toISOString()} [${entry.category.toUpperCase()}]</strong>
                    ${entry.message}
                    ${entry.data ? `<br><small>${JSON.stringify(entry.data)}</small>` : ''}
                </div>
            `).join('')}
        </div>
    </div>

    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>`;
  }

  // Add debug entry
  addEntry(entry: Omit<DebugConsoleEntry, 'id'>): void {
    (this.analytics as any).addDebugEntry(entry);
  }

  // Get debug entries
  getEntries(limit: number = 100): DebugConsoleEntry[] {
    return (this.analytics as any).getDebugEntries(limit);
  }
}

// ── Learning System ───────────────────────────────────────────────
export class LearningSystem {
  private analytics: AdvancedAnalytics;

  constructor(analytics: AdvancedAnalytics) {
    this.analytics = analytics;
  }

  // Generate insights from data
  generateInsights(): LearningInsight[] {
    return (this.analytics as any).generateLearningInsights();
  }

  // Apply an insight
  applyInsight(insightId: string): boolean {
    return (this.analytics as any).applyLearningInsight(insightId);
  }

  // Get all insights
  getInsights(limit: number = 20): LearningInsight[] {
    return (this.analytics as any).getLearningInsights(limit);
  }

  // Analyze error patterns
  analyzeErrors(): ErrorPattern[] {
    return (this.analytics as any).analyzeErrorPatterns();
  }
}
