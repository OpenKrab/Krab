// ============================================================
// 🦀 Krab — Cron Scheduler (Recurring Tasks)
// ============================================================
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger.js";

// Dynamic imports for optional dependencies
let nodeCron: any = null;

interface CronJob {
  id: string;
  name: string;
  schedule: string; // Cron expression: "*/5 * * * *" (every 5 minutes)
  command: string;
  args?: string[];
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  description?: string;
}

interface SchedulerOptions {
  storagePath?: string;
  maxConcurrentJobs?: number;
  enablePersistence?: boolean;
}

export class CronScheduler {
  private jobs: Map<string, CronJob> = new Map();
  private runningJobs: Set<string> = new Set();
  private options: Required<SchedulerOptions>;
  private cronInstances: Map<string, any> = new Map();

  constructor(options: SchedulerOptions = {}) {
    this.options = {
      storagePath: path.join(process.cwd(), "data", "scheduler.json"),
      maxConcurrentJobs: 5,
      enablePersistence: true,
      ...options
    };

    // Ensure data directory exists
    const dataDir = path.dirname(this.options.storagePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    try {
      // Dynamic import of node-cron
      const cronModule = await import("node-cron").catch(() => null);
      if (!cronModule) {
        throw new Error("node-cron not installed. Install with: npm install node-cron");
      }
      nodeCron = cronModule;

      // Load persisted jobs
      if (this.options.enablePersistence) {
        await this.loadJobs();
      }

      // Start all enabled jobs
      for (const job of this.jobs.values()) {
        if (job.enabled) {
          await this.startJob(job.id);
        }
      }

      logger.info(`[Scheduler] Initialized with ${this.jobs.size} jobs`);

    } catch (error) {
      logger.error("[Scheduler] Failed to initialize:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    // Stop all running jobs
    for (const jobId of this.cronInstances.keys()) {
      await this.stopJob(jobId);
    }

    // Save jobs
    if (this.options.enablePersistence) {
      await this.saveJobs();
    }

    logger.info("[Scheduler] Shutdown complete");
  }

  async addJob(jobData: Omit<CronJob, 'id' | 'createdAt' | 'lastRun' | 'nextRun'>): Promise<string> {
    const job: CronJob = {
      id: this.generateJobId(),
      createdAt: new Date(),
      ...jobData
    };

    this.jobs.set(job.id, job);

    if (job.enabled) {
      await this.startJob(job.id);
    }

    if (this.options.enablePersistence) {
      await this.saveJobs();
    }

    logger.info(`[Scheduler] Added job: ${job.name} (${job.id})`);
    return job.id;
  }

  async removeJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    await this.stopJob(jobId);
    this.jobs.delete(jobId);

    if (this.options.enablePersistence) {
      await this.saveJobs();
    }

    logger.info(`[Scheduler] Removed job: ${job.name} (${jobId})`);
    return true;
  }

  async enableJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    job.enabled = true;
    await this.startJob(jobId);

    if (this.options.enablePersistence) {
      await this.saveJobs();
    }

    logger.info(`[Scheduler] Enabled job: ${job.name} (${jobId})`);
    return true;
  }

  async disableJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    job.enabled = false;
    await this.stopJob(jobId);

    if (this.options.enablePersistence) {
      await this.saveJobs();
    }

    logger.info(`[Scheduler] Disabled job: ${job.name} (${jobId})`);
    return true;
  }

  getJob(jobId: string): CronJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): CronJob[] {
    return Array.from(this.jobs.values());
  }

  getEnabledJobs(): CronJob[] {
    return this.getAllJobs().filter(job => job.enabled);
  }

  getRunningJobs(): string[] {
    return Array.from(this.runningJobs);
  }

  async runJobNow(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (this.runningJobs.size >= this.options.maxConcurrentJobs) {
      logger.warn(`[Scheduler] Max concurrent jobs reached (${this.options.maxConcurrentJobs})`);
      return false;
    }

    await this.executeJob(job);
    return true;
  }

  private async startJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || !job.enabled || !nodeCron) {
      return;
    }

    // Stop existing instance if running
    await this.stopJob(jobId);

    try {
      const cronInstance = nodeCron.schedule(job.schedule, async () => {
        await this.executeJob(job);
      });

      this.cronInstances.set(jobId, cronInstance);
      logger.info(`[Scheduler] Started job: ${job.name} (${job.schedule})`);

    } catch (error) {
      logger.error(`[Scheduler] Failed to start job ${job.name}:`, error);
    }
  }

  private async stopJob(jobId: string): Promise<void> {
    const cronInstance = this.cronInstances.get(jobId);
    if (cronInstance) {
      cronInstance.stop();
      this.cronInstances.delete(jobId);
      logger.info(`[Scheduler] Stopped job: ${jobId}`);
    }
  }

  private async executeJob(job: CronJob): Promise<void> {
    if (this.runningJobs.has(job.id)) {
      logger.warn(`[Scheduler] Job ${job.name} is already running, skipping`);
      return;
    }

    if (this.runningJobs.size >= this.options.maxConcurrentJobs) {
      logger.warn(`[Scheduler] Max concurrent jobs reached, skipping ${job.name}`);
      return;
    }

    this.runningJobs.add(job.id);
    job.lastRun = new Date();

    logger.info(`[Scheduler] Executing job: ${job.name}`);

    try {
      // Execute the job command
      const result = await this.executeCommand(job.command, job.args || []);

      // Update next run time
      job.nextRun = this.calculateNextRun(job.schedule);

      logger.info(`[Scheduler] Job completed: ${job.name}`);

    } catch (error) {
      logger.error(`[Scheduler] Job failed: ${job.name}`, error);
    } finally {
      this.runningJobs.delete(job.id);

      // Save updated job data
      if (this.options.enablePersistence) {
        await this.saveJobs();
      }
    }
  }

  private async executeCommand(command: string, args: string[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private calculateNextRun(cronExpression: string): Date {
    // Simple calculation for next run (in a real implementation,
    // you'd use a proper cron parser like 'cron-parser')
    const now = new Date();
    try {
      // This is a simplified calculation - for production use a proper cron library
      const parts = cronExpression.split(' ');

      if (parts.length >= 5) {
        // Handle simple cases like "*/5 * * * *" (every 5 minutes)
        const minutePart = parts[0];
        if (minutePart.startsWith('*/')) {
          const interval = parseInt(minutePart.slice(2));
          const nextMinute = Math.ceil(now.getMinutes() / interval) * interval;
          const nextRun = new Date(now);
          nextRun.setMinutes(nextMinute, 0, 0);

          if (nextRun <= now) {
            nextRun.setHours(nextRun.getHours() + 1);
          }

          return nextRun;
        }
      }
    } catch (error) {
      logger.warn("[Scheduler] Could not calculate next run time:", error);
    }

    // Fallback: assume next hour
    const nextRun = new Date(now);
    nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);
    return nextRun;
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async loadJobs(): Promise<void> {
    try {
      if (fs.existsSync(this.options.storagePath)) {
        const data = fs.readFileSync(this.options.storagePath, 'utf8');
        const jobsData = JSON.parse(data);

        for (const jobData of jobsData) {
          const job: CronJob = {
            ...jobData,
            lastRun: jobData.lastRun ? new Date(jobData.lastRun) : undefined,
            nextRun: jobData.nextRun ? new Date(jobData.nextRun) : undefined,
            createdAt: new Date(jobData.createdAt)
          };
          this.jobs.set(job.id, job);
        }

        logger.info(`[Scheduler] Loaded ${this.jobs.size} jobs from storage`);
      }
    } catch (error) {
      logger.error("[Scheduler] Failed to load jobs:", error);
    }
  }

  private async saveJobs(): Promise<void> {
    try {
      const jobsData = Array.from(this.jobs.values()).map(job => ({
        ...job,
        lastRun: job.lastRun?.toISOString(),
        nextRun: job.nextRun?.toISOString(),
        createdAt: job.createdAt.toISOString()
      }));

      fs.writeFileSync(this.options.storagePath, JSON.stringify(jobsData, null, 2));
    } catch (error) {
      logger.error("[Scheduler] Failed to save jobs:", error);
    }
  }
}

// Predefined job templates
export const jobTemplates = {
  // News monitoring
  newsMonitor: {
    name: "News Monitor",
    schedule: "0 */6 * * *", // Every 6 hours
    command: "node",
    args: ["-e", "console.log('Checking news...')"],
    description: "Monitor news sources for updates"
  },

  // System health check
  healthCheck: {
    name: "Health Check",
    schedule: "*/30 * * * *", // Every 30 minutes
    command: "curl",
    args: ["-f", "http://localhost:3000/health"],
    description: "Check system health and services"
  },

  // Database cleanup
  dbCleanup: {
    name: "Database Cleanup",
    schedule: "0 2 * * *", // Daily at 2 AM
    command: "node",
    args: ["scripts/cleanup.js"],
    description: "Clean up old database records"
  },

  // Backup job
  backup: {
    name: "Backup",
    schedule: "0 3 * * *", // Daily at 3 AM
    command: "bash",
    args: ["scripts/backup.sh"],
    description: "Create system backup"
  }
};

// Factory function for creating schedulers
export function createScheduler(options: SchedulerOptions): CronScheduler {
  return new CronScheduler(options);
}

// Export for dynamic loading
export default CronScheduler;
export { ScheduledTask, SchedulerConfig, TaskExecutionContext };
