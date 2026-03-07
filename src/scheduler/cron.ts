// ============================================================
// 🦀 Krab — Cron Scheduler (Recurring Tasks)
// ============================================================
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger.js";

// Dynamic imports for optional dependencies
let nodeCron: any = null;

export interface TaskResult {
  success: boolean;
  executionTime: number;
  output?: string;
  error?: string;
  timestamp: Date;
}

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string; // Cron expression: "*/5 * * * *"
  command: string;
  args?: string[];
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  tags: string[];
  priority: "low" | "medium" | "high" | "critical";
  timeout: number;
  retries: number;
  maxRetries: number;
  lastResult?: TaskResult;
  schedule: string; // Alias for cronExpression
}

export interface SchedulerConfig {
  storagePath?: string;
  maxConcurrentJobs?: number;
  enablePersistence?: boolean;
}

export type TaskExecutionContext = {
  taskId: string;
  startTime: number;
};

export class CronScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private runningTasks: Set<string> = new Set();
  private options: Required<SchedulerConfig>;
  private cronInstances: Map<string, any> = new Map();
  private stats = {
    completedRuns: 0,
    failedRuns: 0,
    totalExecutionTime: 0,
  };

  constructor(options: SchedulerConfig = {}) {
    this.options = {
      storagePath: path.join(process.cwd(), "data", "scheduler.json"),
      maxConcurrentJobs: 5,
      enablePersistence: true,
      ...options,
    };

    // Ensure data directory exists
    const dataDir = path.dirname(this.options.storagePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  async start(): Promise<void> {
    try {
      // Dynamic import of node-cron
      const cronModule = await import("node-cron").catch(() => null);
      if (!cronModule) {
        throw new Error(
          "node-cron not installed. Install with: npm install node-cron",
        );
      }
      nodeCron = cronModule;

      // Load persisted tasks
      if (this.options.enablePersistence) {
        await this.loadTasks();
      }

      // Start all enabled tasks
      for (const task of this.tasks.values()) {
        if (task.enabled) {
          await this.startTask(task.id);
        }
      }

      logger.info(`[Scheduler] Started with ${this.tasks.size} tasks`);
    } catch (error) {
      logger.error("[Scheduler] Failed to start:", error);
      throw error;
    }
  }

  // Alias for compatibility
  async initialize(): Promise<void> {
    return this.start();
  }

  async stop(): Promise<void> {
    // Stop all running task instances
    for (const taskId of this.cronInstances.keys()) {
      await this.stopTask(taskId);
    }

    // Save tasks
    if (this.options.enablePersistence) {
      await this.saveTasks();
    }

    logger.info("[Scheduler] Scheduler stopped");
  }

  addTask(
    taskData: Omit<
      ScheduledTask,
      "id" | "createdAt" | "updatedAt" | "lastRun" | "nextRun" | "lastResult"
    >,
  ): string {
    const task: ScheduledTask = {
      id: this.generateTaskId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...taskData,
      schedule: taskData.cronExpression, // Sync alias
    };

    this.tasks.set(task.id, task);

    if (task.enabled && nodeCron) {
      void this.startTask(task.id);
    }

    if (this.options.enablePersistence) {
      void this.saveTasks();
    }

    logger.info(`[Scheduler] Added task: ${task.name} (${task.id})`);
    return task.id;
  }

  addJob(data: any): string {
    return this.addTask(data);
  }

  removeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    void this.stopTask(taskId);
    this.tasks.delete(taskId);

    if (this.options.enablePersistence) {
      void this.saveTasks();
    }

    logger.info(`[Scheduler] Removed task: ${task.name} (${taskId})`);
    return true;
  }

  enableTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    task.enabled = true;
    task.updatedAt = new Date();
    void this.startTask(taskId);

    if (this.options.enablePersistence) {
      void this.saveTasks();
    }

    logger.info(`[Scheduler] Enabled task: ${task.name} (${taskId})`);
    return true;
  }

  disableTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    task.enabled = false;
    task.updatedAt = new Date();
    void this.stopTask(taskId);

    if (this.options.enablePersistence) {
      void this.saveTasks();
    }

    logger.info(`[Scheduler] Disabled task: ${task.name} (${taskId})`);
    return true;
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  getEnabledTasks(): ScheduledTask[] {
    return this.getAllTasks().filter((t) => t.enabled);
  }

  getRunningTasks(): string[] {
    return Array.from(this.runningTasks);
  }

  getStats() {
    return {
      totalTasks: this.tasks.size,
      enabledTasks: this.getAllTasks().filter((t) => t.enabled).length,
      runningTasks: this.runningTasks.size,
      completedRuns: this.stats.completedRuns,
      failedRuns: this.stats.failedRuns,
      averageExecutionTime:
        this.stats.completedRuns > 0
          ? this.stats.totalExecutionTime / this.stats.completedRuns
          : 0,
    };
  }

  private async startTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || !task.enabled || !nodeCron) {
      return;
    }

    // Stop existing instance if running
    await this.stopTask(taskId);

    try {
      const cronInstance = nodeCron.schedule(task.cronExpression, async () => {
        await this.executeTask(task);
      });

      this.cronInstances.set(taskId, cronInstance);
      task.nextRun = this.calculateNextRun(task.cronExpression);

      logger.info(
        `[Scheduler] Scheduled task: ${task.name} (${task.cronExpression})`,
      );
    } catch (error) {
      logger.error(`[Scheduler] Failed to schedule task ${task.name}:`, error);
    }
  }

  private async stopTask(taskId: string): Promise<void> {
    const cronInstance = this.cronInstances.get(taskId);
    if (cronInstance) {
      cronInstance.stop();
      this.cronInstances.delete(taskId);
    }
  }

  private async executeTask(task: ScheduledTask): Promise<TaskResult | void> {
    if (this.runningTasks.has(task.id)) {
      logger.warn(`[Scheduler] Task ${task.name} is already running, skipping`);
      return;
    }

    if (this.runningTasks.size >= this.options.maxConcurrentJobs) {
      logger.warn(
        `[Scheduler] Max concurrent tasks reached, skipping ${task.name}`,
      );
      return;
    }

    this.runningTasks.add(task.id);
    const startTime = Date.now();
    task.lastRun = new Date();

    logger.info(`[Scheduler] Executing task: ${task.name}`);

    try {
      // Execute the task command
      const output = await this.executeCommand(
        task.command,
        task.args || [],
        task.timeout,
      );

      const executionTime = Date.now() - startTime;
      const result: TaskResult = {
        success: true,
        executionTime,
        output,
        timestamp: new Date(),
      };

      task.lastResult = result;
      this.stats.completedRuns++;
      this.stats.totalExecutionTime += executionTime;

      // Update next run time
      task.nextRun = this.calculateNextRun(task.cronExpression);

      logger.info(
        `[Scheduler] Task completed: ${task.name} (${executionTime}ms)`,
      );

      return result;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const result: TaskResult = {
        success: false,
        executionTime,
        error: error.message,
        timestamp: new Date(),
      };

      task.lastResult = result;
      this.stats.failedRuns++;
      logger.error(`[Scheduler] Task failed: ${task.name}`, error);

      return result;
    } finally {
      this.runningTasks.delete(task.id);

      // Save updated task data
      if (this.options.enablePersistence) {
        void this.saveTasks();
      }
    }
  }

  private async executeCommand(
    command: string,
    args: string[] = [],
    timeout: number = 300,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        timeout: timeout * 1000,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on("error", (error) => {
        reject(error);
      });
    });
  }

  private calculateNextRun(cronExpression: string): Date {
    const now = new Date();
    try {
      // Simple fallback - assume next hour for logic simplicity here
      // Real apps should use cron-parser
      const nextRun = new Date(now);
      nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);
      return nextRun;
    } catch (error) {
      return new Date(now.getTime() + 3600000);
    }
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async loadTasks(): Promise<void> {
    try {
      if (fs.existsSync(this.options.storagePath)) {
        const data = fs.readFileSync(this.options.storagePath, "utf8");
        const tasksData = JSON.parse(data);

        for (const taskData of tasksData) {
          const task: ScheduledTask = {
            ...taskData,
            schedule: taskData.schedule || taskData.cronExpression, // Sync
            lastRun: taskData.lastRun ? new Date(taskData.lastRun) : undefined,
            nextRun: taskData.nextRun ? new Date(taskData.nextRun) : undefined,
            createdAt: new Date(taskData.createdAt),
            updatedAt: new Date(taskData.updatedAt || taskData.createdAt),
            lastResult: taskData.lastResult
              ? {
                  ...taskData.lastResult,
                  timestamp: new Date(taskData.lastResult.timestamp),
                }
              : undefined,
          };
          this.tasks.set(task.id, task);
        }
      }
    } catch (error) {
      logger.error("[Scheduler] Failed to load tasks:", error);
    }
  }

  private async saveTasks(): Promise<void> {
    try {
      const tasksData = Array.from(this.tasks.values());
      fs.writeFileSync(
        this.options.storagePath,
        JSON.stringify(tasksData, null, 2),
      );
    } catch (error) {
      logger.error("[Scheduler] Failed to save tasks:", error);
    }
  }

  async runTaskNow(taskId: string): Promise<TaskResult | void> {
    const task = this.getTask(taskId);
    if (!task) return;
    return this.executeTask(task);
  }

  // --- Legacy Job Aliases ---
  getJob(jobId: string) {
    return this.getTask(jobId);
  }
  getAllJobs() {
    return this.getAllTasks();
  }
  getEnabledJobs() {
    return this.getEnabledTasks();
  }
  getRunningJobs() {
    return this.getRunningTasks();
  }
  removeJob(jobId: string) {
    return this.removeTask(jobId);
  }
  async enableJob(jobId: string) {
    return this.enableTask(jobId);
  }
  async disableJob(jobId: string) {
    return this.disableTask(jobId);
  }
  async runJobNow(jobId: string) {
    return this.runTaskNow(jobId);
  }
}

// Predefined job templates
export const jobTemplates = {
  // News monitoring
  newsMonitor: {
    name: "News Monitor",
    cronExpression: "0 */6 * * *", // Every 6 hours
    command: "node",
    args: ["-e", "console.log('Checking news...')"],
    description: "Monitor news sources for updates",
    tags: ["news"],
    priority: "low" as const,
  },

  // System health check
  healthCheck: {
    name: "Health Check",
    cronExpression: "*/30 * * * *", // Every 30 minutes
    command: "curl",
    args: ["-f", "http://localhost:3000/health"],
    description: "Check system health and services",
    tags: ["health"],
    priority: "high" as const,
  },
};

// Factory function for creating schedulers
export function createScheduler(options: SchedulerConfig): CronScheduler {
  return new CronScheduler(options);
}
