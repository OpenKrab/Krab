// ============================================================
// 🦀 Krab — Message Queue
// ============================================================
import { logger } from "../utils/logger.js";
import { z } from "zod";

export const MessageJobSchema = z.object({
  id: z.string(),
  channel: z.string(),
  type: z.enum(["send", "sendReply", "sendPoll", "sendInteractive"]),
  payload: z.record(z.string(), z.unknown()),
  recipient: z.string(),
  priority: z.number().min(0).max(10).default(5),
  retries: z.number().int().min(0).max(5).default(0),
  maxRetries: z.number().int().min(0).max(10).default(3),
  scheduledAt: z.number().optional(),
  expiresAt: z.number().optional(),
  createdAt: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  failedAt: z.number().optional(),
  error: z.string().optional(),
});

export type MessageJob = z.infer<typeof MessageJobSchema>;
export type JobStatus = "pending" | "processing" | "completed" | "failed" | "expired";

export interface QueueOptions {
  concurrency: number;
  maxRetries: number;
  retryDelayMs: number;
  jobTimeoutMs: number;
  enablePersistence: boolean;
}

export const DEFAULT_QUEUE_OPTIONS: QueueOptions = {
  concurrency: 5,
  maxRetries: 3,
  retryDelayMs: 1000,
  jobTimeoutMs: 30000,
  enablePersistence: false,
};

export class MessageQueue {
  private jobs = new Map<string, MessageJob>();
  private pendingQueue: string[] = [];
  private processing = new Set<string>();
  private options: QueueOptions;
  private isRunning = false;
  private processInterval: NodeJS.Timeout | null = null;
  private handler: ((job: MessageJob) => Promise<void>) | null = null;

  constructor(options: Partial<QueueOptions> = {}) {
    this.options = { ...DEFAULT_QUEUE_OPTIONS, ...options };
  }

  setHandler(handler: (job: MessageJob) => Promise<void>): void {
    this.handler = handler;
  }

  add(job: Omit<MessageJob, "id" | "createdAt" | "retries">): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const fullJob: MessageJob = {
      ...job,
      id,
      createdAt: Date.now(),
      retries: 0,
    };

    this.jobs.set(id, fullJob);
    this.enqueue(id);

    logger.debug(`[MessageQueue] Added job: ${id} (${job.type})`);
    return id;
  }

  addSend(channel: string, message: string, recipient: string, priority = 5): string {
    return this.add({
      channel,
      type: "send",
      payload: { message },
      recipient,
      priority,
      maxRetries: this.options.maxRetries,
    });
  }

  addScheduled(job: Omit<MessageJob, "id" | "createdAt">, scheduledAt: number): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const fullJob: MessageJob = {
      ...job,
      id,
      createdAt: Date.now(),
      scheduledAt,
      retries: 0,
    };

    this.jobs.set(id, fullJob);
    
    const delay = scheduledAt - Date.now();
    if (delay > 0) {
      setTimeout(() => this.enqueue(id), delay);
    } else {
      this.enqueue(id);
    }

    logger.debug(`[MessageQueue] Scheduled job: ${id} at ${new Date(scheduledAt)}`);
    return id;
  }

  private enqueue(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const existingIndex = this.pendingQueue.indexOf(jobId);
    if (existingIndex !== -1) {
      this.pendingQueue.splice(existingIndex, 1);
    }

    let inserted = false;
    for (let i = 0; i < this.pendingQueue.length; i++) {
      const compareJob = this.jobs.get(this.pendingQueue[i]);
      if (compareJob && job.priority > compareJob.priority) {
        this.pendingQueue.splice(i, 0, jobId);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.pendingQueue.push(jobId);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.processInterval = setInterval(() => this.processNext(), 100);
    
    logger.info("[MessageQueue] Started");
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }

    await this.waitForProcessing();
    
    logger.info("[MessageQueue] Stopped");
  }

  private async processNext(): Promise<void> {
    if (!this.isRunning) return;
    if (this.processing.size >= this.options.concurrency) return;
    if (this.pendingQueue.length === 0) return;

    const jobId = this.pendingQueue.shift();
    if (!jobId) return;

    const job = this.jobs.get(jobId);
    if (!job || job.startedAt) return;

    if (job.expiresAt && Date.now() > job.expiresAt) {
      job.failedAt = Date.now();
      job.error = "Job expired";
      logger.warn(`[MessageQueue] Job expired: ${jobId}`);
      return;
    }

    this.processing.add(jobId);
    job.startedAt = Date.now();

    this.processJob(job).catch((error) => {
      logger.error(`[MessageQueue] Job failed: ${jobId}`, error);
    });
  }

  private async processJob(job: MessageJob): Promise<void> {
    try {
      if (!this.handler) {
        throw new Error("No handler configured");
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Job timeout")), this.options.jobTimeoutMs);
      });

      await Promise.race([this.handler(job), timeoutPromise]);

      job.completedAt = Date.now();
      this.processing.delete(job.id);
      
      logger.debug(`[MessageQueue] Job completed: ${job.id}`);
      
      this.cleanupCompleted();
    } catch (error) {
      job.retries++;
      
      if (job.retries < job.maxRetries) {
        job.startedAt = undefined;
        this.processing.delete(job.id);
        
        const delay = this.options.retryDelayMs * Math.pow(2, job.retries - 1);
        setTimeout(() => this.enqueue(job.id), delay);
        
        logger.debug(`[MessageQueue] Job retry ${job.retries}/${job.maxRetries}: ${job.id}`);
      } else {
        job.failedAt = Date.now();
        job.error = String(error);
        this.processing.delete(job.id);
        
        logger.error(`[MessageQueue] Job failed permanently: ${job.id}`, error);
      }
    }
  }

  private async waitForProcessing(): Promise<void> {
    while (this.processing.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private cleanupCompleted(): void {
    const now = Date.now();
    const expireMs = 5 * 60 * 1000;

    for (const [id, job] of this.jobs) {
      if ((job.completedAt || job.failedAt) && now - (job.completedAt || job.failedAt!) > expireMs) {
        this.jobs.delete(id);
      }
    }
  }

  getJob(id: string): MessageJob | undefined {
    return this.jobs.get(id);
  }

  getStatus(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    let pending = 0;
    let completed = 0;
    let failed = 0;

    for (const job of this.jobs.values()) {
      if (!job.startedAt) pending++;
      else if (job.completedAt) completed++;
      else if (job.failedAt) failed++;
    }

    return {
      pending,
      processing: this.processing.size,
      completed,
      failed,
    };
  }

  getJobsByStatus(status: JobStatus): MessageJob[] {
    return Array.from(this.jobs.values()).filter((job) => {
      switch (status) {
        case "pending":
          return !job.startedAt;
        case "processing":
          return job.startedAt && !job.completedAt && !job.failedAt;
        case "completed":
          return !!job.completedAt;
        case "failed":
          return !!job.failedAt;
        case "expired":
          return job.expiresAt ? Date.now() > job.expiresAt : false;
        default:
          return false;
      }
    });
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || job.startedAt) return false;

    this.pendingQueue = this.pendingQueue.filter((j) => j !== id);
    this.jobs.delete(id);
    
    logger.debug(`[MessageQueue] Cancelled job: ${id}`);
    return true;
  }

  retry(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || !job.failedAt) return false;

    job.failedAt = undefined;
    job.error = undefined;
    job.retries = 0;
    job.startedAt = undefined;
    
    this.enqueue(id);
    
    logger.debug(`[MessageQueue] Retrying job: ${id}`);
    return true;
  }

  clear(): void {
    this.pendingQueue = [];
    this.jobs.clear();
    logger.info("[MessageQueue] Cleared");
  }
}

// ── Priority Queue ─────────────────────────────────────────────

export class PriorityQueue<T> {
  private items: { priority: number; value: T }[] = [];

  enqueue(value: T, priority: number): void {
    const item = { priority, value };
    
    let inserted = false;
    for (let i = 0; i < this.items.length; i++) {
      if (priority > this.items[i].priority) {
        this.items.splice(i, 0, item);
        inserted = true;
        break;
      }
    }
    
    if (!inserted) {
      this.items.push(item);
    }
  }

  dequeue(): T | undefined {
    return this.items.shift()?.value;
  }

  peek(): T | undefined {
    return this.items[0]?.value;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }
}
