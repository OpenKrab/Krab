import crypto from "node:crypto";
import { Agent } from "../core/agent.js";
import type { KrabConfig } from "../core/types.js";
import { logger } from "../utils/logger.js";
import { sessionStore } from "../session/store.js";

export type SubagentStatus = "idle" | "running" | "completed" | "failed" | "killed";

export interface SubagentRecord {
  id: string;
  role: string;
  goal: string;
  parentConversationId: string;
  createdAt: Date;
  updatedAt: Date;
  status: SubagentStatus;
  lastTask?: string;
  lastResult?: string;
  error?: string;
}

export interface SubagentLifecycleEvent {
  timestamp: string;
  subagentId: string;
  type: "spawned" | "started" | "completed" | "failed" | "killed" | "kill_requested";
  status: SubagentStatus;
  task?: string;
  error?: string;
}

interface RuntimeEntry {
  agent: Agent;
  record: SubagentRecord;
  activeRun?: Promise<SubagentRecord>;
  cancelRequested?: boolean;
  abortController?: AbortController;
}

export class SubagentRuntime {
  private readonly config: KrabConfig;
  private readonly entries = new Map<string, RuntimeEntry>();
  private readonly events: SubagentLifecycleEvent[] = [];
  private readonly subscribers = new Set<(event: SubagentLifecycleEvent) => void>();

  constructor(config: KrabConfig) {
    this.config = config;
  }

  spawn(
    role: string,
    goal: string,
    parentConversationId: string,
    options?: {
      channel?: string;
      mode?: "main" | "group" | "thread";
      senderId?: string;
    },
  ): SubagentRecord {
    const id = `subagent_${crypto.randomBytes(4).toString("hex")}`;
    const agent = new Agent(this.createSubagentConfig());
    const now = new Date();
    const record: SubagentRecord = {
      id,
      role,
      goal,
      parentConversationId,
      createdAt: now,
      updatedAt: now,
      status: "idle",
    };

    this.entries.set(id, { agent, record });
    sessionStore.getOrCreateSession(id, {
      channel: options?.channel || "subagent",
      lastChannel: options?.channel || "subagent",
      mode: options?.mode || "main",
      senderId: options?.senderId || "subagent-runtime",
    });
    logger.info(`[SubagentRuntime] Spawned ${id} (${role})`);
    this.recordEvent({
      timestamp: new Date().toISOString(),
      subagentId: id,
      type: "spawned",
      status: "idle",
    });
    return this.cloneRecord(record);
  }

  async execute(id: string, task: string): Promise<SubagentRecord> {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Subagent ${id} not found`);
    }

    if (entry.record.status === "killed" || entry.cancelRequested) {
      throw new Error(`Subagent ${id} has been cancelled`);
    }

    if (entry.activeRun) {
      throw new Error(`Subagent ${id} is already running`);
    }

    entry.record.status = "running";
    entry.record.lastTask = task;
    entry.record.updatedAt = new Date();
    entry.cancelRequested = false;
    entry.abortController = new AbortController();
    this.recordEvent({
      timestamp: new Date().toISOString(),
      subagentId: id,
      type: "started",
      status: "running",
      task,
    });

    const run = (async () => {
      try {
        if (entry.cancelRequested) {
          entry.record.status = "killed";
          entry.record.error = "Cancellation requested before execution";
          entry.record.updatedAt = new Date();
          return this.cloneRecord(entry.record);
        }
        const prompt = `[Subagent Role: ${entry.record.role}]\n[Goal: ${entry.record.goal}]\n[Task: ${task}]`;
        const result = await entry.agent.chat(prompt, { conversationId: id, signal: entry.abortController.signal });
        if (entry.cancelRequested) {
          entry.record.status = "killed";
          entry.record.error = "Cancelled after in-flight completion";
          entry.record.updatedAt = new Date();
          this.recordEvent({
            timestamp: new Date().toISOString(),
            subagentId: id,
            type: "killed",
            status: "killed",
            task,
            error: entry.record.error,
          });
          return this.cloneRecord(entry.record);
        }
        entry.record.status = "completed";
        entry.record.lastResult = result;
        entry.record.error = undefined;
        entry.record.updatedAt = new Date();
        logger.info(`[SubagentRuntime] Completed ${id}`);
        this.recordEvent({
          timestamp: new Date().toISOString(),
          subagentId: id,
          type: "completed",
          status: "completed",
          task,
        });
        return this.cloneRecord(entry.record);
      } catch (error) {
        entry.record.status = entry.cancelRequested ? "killed" : "failed";
        entry.record.error = error instanceof Error ? error.message : String(error);
        entry.record.updatedAt = new Date();
        logger.error(`[SubagentRuntime] Failed ${id}: ${entry.record.error}`);
        this.recordEvent({
          timestamp: new Date().toISOString(),
          subagentId: id,
          type: entry.cancelRequested ? "killed" : "failed",
          status: entry.record.status,
          task,
          error: entry.record.error,
        });
        return this.cloneRecord(entry.record);
      } finally {
        entry.activeRun = undefined;
        entry.abortController = undefined;
      }
    })();

    entry.activeRun = run;
    return run;
  }

  get(id: string): SubagentRecord | undefined {
    return this.entries.has(id) ? this.cloneRecord(this.entries.get(id)!.record) : undefined;
  }

  list(): SubagentRecord[] {
    return Array.from(this.entries.values()).map((entry) => this.cloneRecord(entry.record));
  }

  getEvents(limit = 50): SubagentLifecycleEvent[] {
    return this.events.slice(-limit);
  }

  subscribe(listener: (event: SubagentLifecycleEvent) => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  kill(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }
    if (entry.record.status === "killed" && entry.cancelRequested) {
      return true;
    }
    entry.cancelRequested = true;
    entry.abortController?.abort(`Subagent ${id} cancelled`);
    this.recordEvent({
      timestamp: new Date().toISOString(),
      subagentId: id,
      type: "kill_requested",
      status: entry.record.status,
      task: entry.record.lastTask,
    });
    entry.record.status = "killed";
    entry.record.error = entry.activeRun ? "Cancellation requested" : entry.record.error;
    entry.record.updatedAt = new Date();
    logger.info(`[SubagentRuntime] Killed ${id}`);
    if (!entry.activeRun) {
      this.recordEvent({
        timestamp: new Date().toISOString(),
        subagentId: id,
        type: "killed",
        status: "killed",
        task: entry.record.lastTask,
        error: entry.record.error,
      });
    }
    return true;
  }

  private recordEvent(event: SubagentLifecycleEvent): void {
    this.events.push(event);
    if (this.events.length > 200) {
      this.events.splice(0, this.events.length - 200);
    }
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (error) {
        logger.warn(`[SubagentRuntime] Event subscriber failed: ${error}`);
      }
    }
  }

  private createSubagentConfig(): KrabConfig {
    return {
      ...this.config,
      maxIterations: Math.min(this.config.maxIterations || 5, 8),
      agents: {
        ...this.config.agents,
        defaults: {
          ...this.config.agents?.defaults,
          workspace: this.config.agents?.defaults?.workspace || process.cwd(),
          model: this.config.agents?.defaults?.model || { primary: this.config.provider?.model || "gemini-2.0-flash" },
        },
      } as KrabConfig["agents"],
    };
  }

  private cloneRecord(record: SubagentRecord): SubagentRecord {
    return {
      ...record,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  }
}

let subagentRuntime: SubagentRuntime | null = null;

export function getSubagentRuntime(config?: KrabConfig): SubagentRuntime {
  if (!subagentRuntime) {
    if (!config) {
      throw new Error("SubagentRuntime not initialized");
    }
    subagentRuntime = new SubagentRuntime(config);
  }
  return subagentRuntime;
}

export function initializeSubagentRuntime(config: KrabConfig): SubagentRuntime {
  subagentRuntime = new SubagentRuntime(config);
  return subagentRuntime;
}
