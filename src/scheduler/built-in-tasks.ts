// ============================================================
// 🦀 Krab — Built-in Scheduled Tasks
// ============================================================
import { CronScheduler, ScheduledTask } from './cron.js';
import { logger } from '../utils/logger.js';

export class BuiltInTasks {
  private scheduler: CronScheduler;

  constructor(scheduler: CronScheduler) {
    this.scheduler = scheduler;
  }

  // Initialize all built-in tasks
  async initializeBuiltInTasks(): Promise<void> {
    logger.info('[BuiltInTasks] Initializing built-in scheduled tasks...');

    // News aggregation task
    this.createNewsFetchTask();

    // System monitoring task
    this.createSystemMonitoringTask();

    // Data cleanup task
    this.createDataCleanupTask();

    // Backup task
    this.createBackupTask();

    // Analytics report generation
    this.createAnalyticsReportTask();

    // Health check task
    this.createHealthCheckTask();

    logger.info('[BuiltInTasks] Built-in tasks initialized');
  }

  private createNewsFetchTask(): void {
    const task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'News Aggregation',
      description: 'Fetch latest news and AI developments from various sources',
      cronExpression: '0 */2 * * *', // Every 2 hours
      command: 'news_fetch',
      enabled: true,
      tags: ['news', 'content', 'external'],
      priority: 'medium',
      timeout: 600, // 10 minutes
      retries: 0,
      maxRetries: 2
    };

    this.scheduler.addTask(task);
  }

  private createSystemMonitoringTask(): void {
    const task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'System Monitoring',
      description: 'Monitor system resources, performance, and health metrics',
      cronExpression: '*/10 * * * *', // Every 10 minutes
      command: 'health_check',
      enabled: true,
      tags: ['monitoring', 'system', 'health'],
      priority: 'high',
      timeout: 120, // 2 minutes
      retries: 0,
      maxRetries: 1
    };

    this.scheduler.addTask(task);
  }

  private createDataCleanupTask(): void {
    const task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Data Cleanup',
      description: 'Clean up temporary files, old logs, and cache data',
      cronExpression: '0 2 * * *', // Daily at 2 AM
      command: 'cleanup',
      enabled: true,
      tags: ['maintenance', 'cleanup', 'storage'],
      priority: 'medium',
      timeout: 1800, // 30 minutes
      retries: 0,
      maxRetries: 2
    };

    this.scheduler.addTask(task);
  }

  private createBackupTask(): void {
    const task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Database Backup',
      description: 'Create backup of databases and critical data',
      cronExpression: '0 3 * * *', // Daily at 3 AM
      command: 'backup',
      enabled: true,
      tags: ['backup', 'database', 'critical'],
      priority: 'high',
      timeout: 3600, // 1 hour
      retries: 0,
      maxRetries: 3
    };

    this.scheduler.addTask(task);
  }

  private createAnalyticsReportTask(): void {
    const task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Analytics Report',
      description: 'Generate and send weekly analytics reports',
      cronExpression: '0 9 * * 1', // Every Monday at 9 AM
      command: 'analytics_report',
      enabled: true,
      tags: ['analytics', 'reporting', 'weekly'],
      priority: 'low',
      timeout: 600, // 10 minutes
      retries: 0,
      maxRetries: 1
    };

    this.scheduler.addTask(task);
  }

  private createHealthCheckTask(): void {
    const task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Service Health Check',
      description: 'Check health of all Krab services and integrations',
      cronExpression: '*/30 * * * *', // Every 30 minutes
      command: 'service_health_check',
      enabled: true,
      tags: ['health', 'monitoring', 'services'],
      priority: 'critical',
      timeout: 300, // 5 minutes
      retries: 0,
      maxRetries: 2
    };

    this.scheduler.addTask(task);
  }

  // Additional utility tasks that can be enabled as needed
  addCustomNewsSource(name: string, url: string, schedule: string = '0 */4 * * *'): void {
    const task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'> = {
      name: `News: ${name}`,
      description: `Fetch news from ${url}`,
      cronExpression: schedule,
      command: 'news_fetch_source',
      args: [url],
      enabled: true,
      tags: ['news', 'custom', 'external'],
      priority: 'low',
      timeout: 300, // 5 minutes
      retries: 0,
      maxRetries: 3
    };

    this.scheduler.addTask(task);
    logger.info(`[BuiltInTasks] Added custom news source: ${name}`);
  }

  addMonitoringAlert(metric: string, threshold: number, schedule: string = '*/5 * * * *'): void {
    const task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'> = {
      name: `Monitor: ${metric}`,
      description: `Monitor ${metric} and alert if above ${threshold}`,
      cronExpression: schedule,
      command: 'monitor_metric',
      args: [metric, threshold.toString()],
      enabled: true,
      tags: ['monitoring', 'alerts', 'custom'],
      priority: 'high',
      timeout: 60, // 1 minute
      retries: 0,
      maxRetries: 1
    };

    this.scheduler.addTask(task);
    logger.info(`[BuiltInTasks] Added monitoring alert for ${metric}`);
  }

  addDatabaseMaintenance(schedule: string = '0 4 * * 0'): void {
    const task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Database Maintenance',
      description: 'Perform database optimization and maintenance tasks',
      cronExpression: schedule,
      command: 'db_maintenance',
      enabled: true,
      tags: ['database', 'maintenance', 'optimization'],
      priority: 'medium',
      timeout: 1800, // 30 minutes
      retries: 0,
      maxRetries: 2
    };

    this.scheduler.addTask(task);
    logger.info('[BuiltInTasks] Added database maintenance task');
  }

  // Task templates for common use cases
  getTaskTemplates(): Array<{ name: string; description: string; template: Partial<ScheduledTask> }> {
    return [
      {
        name: 'Web Scraping',
        description: 'Regularly scrape data from websites',
        template: {
          cronExpression: '0 */6 * * *', // Every 6 hours
          command: 'web_scrape',
          priority: 'medium',
          timeout: 900, // 15 minutes
          tags: ['scraping', 'web', 'data']
        }
      },
      {
        name: 'API Health Check',
        description: 'Monitor external API endpoints',
        template: {
          cronExpression: '*/15 * * * *', // Every 15 minutes
          command: 'api_health_check',
          priority: 'high',
          timeout: 60, // 1 minute
          tags: ['api', 'health', 'monitoring']
        }
      },
      {
        name: 'Log Rotation',
        description: 'Rotate and archive log files',
        template: {
          cronExpression: '0 0 * * *', // Daily at midnight
          command: 'log_rotate',
          priority: 'medium',
          timeout: 600, // 10 minutes
          tags: ['logs', 'maintenance', 'storage']
        }
      },
      {
        name: 'Security Scan',
        description: 'Run security vulnerability scans',
        template: {
          cronExpression: '0 2 * * 1', // Weekly on Monday
          command: 'security_scan',
          priority: 'critical',
          timeout: 3600, // 1 hour
          tags: ['security', 'scanning', 'weekly']
        }
      }
    ];
  }

  // Enable/disable task categories
  enableTaskCategory(category: string): number {
    let count = 0;
    const tasks = this.scheduler.getAllTasks();

    for (const task of tasks) {
      if (task.tags.includes(category) && !task.enabled) {
        this.scheduler.enableTask(task.id);
        count++;
      }
    }

    logger.info(`[BuiltInTasks] Enabled ${count} tasks in category: ${category}`);
    return count;
  }

  disableTaskCategory(category: string): number {
    let count = 0;
    const tasks = this.scheduler.getAllTasks();

    for (const task of tasks) {
      if (task.tags.includes(category) && task.enabled) {
        this.scheduler.disableTask(task.id);
        count++;
      }
    }

    logger.info(`[BuiltInTasks] Disabled ${count} tasks in category: ${category}`);
    return count;
  }
}
