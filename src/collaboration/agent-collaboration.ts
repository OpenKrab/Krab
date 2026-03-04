// ============================================================
// 🦀 Krab — Agent Collaboration (Phase 5)
// ============================================================
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface Agent {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  status: 'idle' | 'working' | 'error' | 'completed';
  currentTask?: string;
  performance: {
    tasksCompleted: number;
    averageResponseTime: number;
    successRate: number;
    specialization: { [skill: string]: number };
  };
  lastActive: Date;
  metadata?: any;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  assignedTo?: string;
  dependencies: string[];
  subtasks: string[];
  estimatedDuration: number;
  actualDuration?: number;
  createdAt: Date;
  updatedAt: Date;
  deadline?: Date;
  tags: string[];
  context: any;
}

export interface CollaborationSession {
  id: string;
  name: string;
  goal: string;
  agents: string[];
  tasks: Task[];
  status: 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed';
  coordinator: string;
  startedAt: Date;
  completedAt?: Date;
  progress: number;
  insights: string[];
  metrics: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageTaskTime: number;
    agentUtilization: { [agentId: string]: number };
  };
}

export interface Message {
  id: string;
  from: string;
  to: string;
  type: 'task_assignment' | 'progress_update' | 'question' | 'answer' | 'suggestion' | 'feedback';
  content: string;
  timestamp: Date;
  context?: any;
  priority: 'low' | 'medium' | 'high';
  requiresResponse: boolean;
}

export class AgentCollaboration extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private tasks: Map<string, Task> = new Map();
  private sessions: Map<string, CollaborationSession> = new Map();
  private messages: Message[] = [];
  private dataPath: string;

  constructor(dataPath?: string) {
    super();
    this.dataPath = dataPath || path.join(process.cwd(), 'collaboration-data');
    this.ensureDataDirectory();
    this.loadData();
    this.initializeDefaultAgents();
  }

  private ensureDataDirectory(): void {
    const dirs = [
      this.dataPath,
      path.join(this.dataPath, 'sessions'),
      path.join(this.dataPath, 'agents'),
      path.join(this.dataPath, 'tasks')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private loadData(): void {
    try {
      // Load agents
      const agentsFile = path.join(this.dataPath, 'agents.json');
      if (fs.existsSync(agentsFile)) {
        const agentsData = JSON.parse(fs.readFileSync(agentsFile, 'utf8'));
        Object.entries(agentsData).forEach(([id, agent]: [string, any]) => {
          this.agents.set(id, {
            ...agent,
            lastActive: new Date(agent.lastActive)
          });
        });
      }

      // Load tasks
      const tasksFile = path.join(this.dataPath, 'tasks.json');
      if (fs.existsSync(tasksFile)) {
        const tasksData = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
        Object.entries(tasksData).forEach(([id, task]: [string, any]) => {
          this.tasks.set(id, {
            ...task,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt),
            deadline: task.deadline ? new Date(task.deadline) : undefined
          });
        });
      }
    } catch (error) {
      logger.error('Failed to load collaboration data:', error);
    }
  }

  private saveData(): void {
    try {
      // Save agents
      const agentsData: { [key: string]: any } = {};
      this.agents.forEach((agent, id) => {
        agentsData[id] = agent;
      });
      fs.writeFileSync(path.join(this.dataPath, 'agents.json'), JSON.stringify(agentsData, null, 2));

      // Save tasks
      const tasksData: { [key: string]: any } = {};
      this.tasks.forEach((task, id) => {
        tasksData[id] = task;
      });
      fs.writeFileSync(path.join(this.dataPath, 'tasks.json'), JSON.stringify(tasksData, null, 2));
    } catch (error) {
      logger.error('Failed to save collaboration data:', error);
    }
  }

  private initializeDefaultAgents(): void {
    const defaultAgents: Omit<Agent, 'id'>[] = [
      {
        name: 'Coordinator',
        role: 'task_coordinator',
        capabilities: ['planning', 'delegation', 'monitoring', 'reporting'],
        status: 'idle',
        performance: {
          tasksCompleted: 0,
          averageResponseTime: 0,
          successRate: 1.0,
          specialization: { planning: 1.0, delegation: 0.9, monitoring: 0.8 }
        },
        lastActive: new Date()
      },
      {
        name: 'Researcher',
        role: 'research_specialist',
        capabilities: ['web_search', 'data_analysis', 'information_gathering', 'summarization'],
        status: 'idle',
        performance: {
          tasksCompleted: 0,
          averageResponseTime: 0,
          successRate: 1.0,
          specialization: { research: 1.0, analysis: 0.9, summarization: 0.8 }
        },
        lastActive: new Date()
      },
      {
        name: 'Developer',
        role: 'code_specialist',
        capabilities: ['programming', 'debugging', 'testing', 'documentation'],
        status: 'idle',
        performance: {
          tasksCompleted: 0,
          averageResponseTime: 0,
          successRate: 1.0,
          specialization: { coding: 1.0, debugging: 0.9, testing: 0.8 }
        },
        lastActive: new Date()
      },
      {
        name: 'Writer',
        role: 'content_specialist',
        capabilities: ['writing', 'editing', 'translation', 'content_creation'],
        status: 'idle',
        performance: {
          tasksCompleted: 0,
          averageResponseTime: 0,
          successRate: 1.0,
          specialization: { writing: 1.0, editing: 0.9, translation: 0.7 }
        },
        lastActive: new Date()
      }
    ];

    defaultAgents.forEach(agent => {
      const id = `agent-${agent.name.toLowerCase()}`;
      if (!this.agents.has(id)) {
        this.agents.set(id, { ...agent, id });
      }
    });

    this.saveData();
  }

  // Agent management
  registerAgent(agent: Omit<Agent, 'id'>): string {
    const id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullAgent: Agent = { ...agent, id };
    this.agents.set(id, fullAgent);
    this.saveData();
    this.emit('agentRegistered', fullAgent);
    logger.info(`[AgentCollaboration] Agent registered: ${agent.name} (${id})`);
    return id;
  }

  updateAgentStatus(agentId: string, status: Agent['status'], currentTask?: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.status = status;
    if (currentTask) {
      agent.currentTask = currentTask;
    }
    agent.lastActive = new Date();
    this.saveData();
    this.emit('agentStatusChanged', { agentId, status, currentTask });
    return true;
  }

  getAgent(agentId: string): Agent | null {
    return this.agents.get(agentId) || null;
  }

  getAvailableAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(agent => agent.status === 'idle');
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  // Task management
  createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullTask: Task = {
      ...task,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.tasks.set(id, fullTask);
    this.saveData();
    this.emit('taskCreated', fullTask);
    logger.info(`[AgentCollaboration] Task created: ${task.title} (${id})`);
    return id;
  }

  assignTask(taskId: string, agentId: string): boolean {
    const task = this.tasks.get(taskId);
    const agent = this.agents.get(agentId);

    if (!task || !agent) return false;
    if (task.status !== 'pending') return false;

    task.assignedTo = agentId;
    task.status = 'assigned';
    task.updatedAt = new Date();
    agent.currentTask = taskId;
    agent.status = 'working';

    this.saveData();
    this.emit('taskAssigned', { taskId, agentId });
    logger.info(`[AgentCollaboration] Task ${taskId} assigned to agent ${agentId}`);
    return true;
  }

  updateTaskStatus(taskId: string, status: Task['status'], metadata?: any): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const oldStatus = task.status;
    task.status = status;
    task.updatedAt = new Date();

    if (status === 'completed' || status === 'failed') {
      task.actualDuration = Date.now() - task.createdAt.getTime();
    }

    // Update agent status if task is completed
    if ((status === 'completed' || status === 'failed') && task.assignedTo) {
      const agent = this.agents.get(task.assignedTo);
      if (agent) {
        agent.status = 'idle';
        agent.currentTask = undefined;
        agent.performance.tasksCompleted++;
        this.updateAgentPerformance(agent.id);
      }
    }

    this.saveData();
    this.emit('taskStatusChanged', { taskId, oldStatus, newStatus: status, metadata });
    logger.info(`[AgentCollaboration] Task ${taskId} status changed: ${oldStatus} -> ${status}`);
    return true;
  }

  getTask(taskId: string): Task | null {
    return this.tasks.get(taskId) || null;
  }

  getTasksByStatus(status: Task['status']): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  getTasksByAgent(agentId: string): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.assignedTo === agentId);
  }

  // Collaboration session management
  startSession(name: string, goal: string, agents: string[] = []): string {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const coordinator = 'agent-coordinator'; // Default coordinator

    const session: CollaborationSession = {
      id: sessionId,
      name,
      goal,
      agents: agents.length > 0 ? agents : this.getAvailableAgents().slice(0, 3).map(a => a.id),
      tasks: [],
      status: 'planning',
      coordinator,
      startedAt: new Date(),
      progress: 0,
      insights: [],
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageTaskTime: 0,
        agentUtilization: {}
      }
    };

    this.sessions.set(sessionId, session);
    this.emit('sessionStarted', session);
    logger.info(`[AgentCollaboration] Collaboration session started: ${name} (${sessionId})`);
    return sessionId;
  }

  addTaskToSession(sessionId: string, taskId: string): boolean {
    const session = this.sessions.get(sessionId);
    const task = this.tasks.get(taskId);

    if (!session || !task) return false;

    session.tasks.push(task);
    session.metrics.totalTasks++;
    this.saveSessionData(sessionId);
    return true;
  }

  updateSessionProgress(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const completedTasks = session.tasks.filter(t => t.status === 'completed').length;
    session.progress = session.metrics.totalTasks > 0 ? (completedTasks / session.metrics.totalTasks) * 100 : 0;
    session.metrics.completedTasks = completedTasks;
    session.metrics.failedTasks = session.tasks.filter(t => t.status === 'failed').length;

    // Calculate agent utilization
    session.agents.forEach(agentId => {
      const agentTasks = session.tasks.filter(t => t.assignedTo === agentId);
      const completedByAgent = agentTasks.filter(t => t.status === 'completed').length;
      session.metrics.agentUtilization[agentId] = agentTasks.length > 0 ? (completedByAgent / agentTasks.length) * 100 : 0;
    });

    if (session.progress === 100) {
      session.status = 'completed';
      session.completedAt = new Date();
      this.emit('sessionCompleted', session);
    }

    this.saveSessionData(sessionId);
  }

  getSession(sessionId: string): CollaborationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getActiveSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(session =>
      ['planning', 'executing', 'reviewing'].includes(session.status)
    );
  }

  // Message passing between agents
  sendMessage(message: Omit<Message, 'id' | 'timestamp'>): string {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullMessage: Message = {
      ...message,
      id: messageId,
      timestamp: new Date()
    };

    this.messages.push(fullMessage);
    this.emit('messageSent', fullMessage);
    logger.debug(`[AgentCollaboration] Message sent: ${message.from} -> ${message.to} (${message.type})`);
    return messageId;
  }

  getMessagesForAgent(agentId: string, limit: number = 50): Message[] {
    return this.messages
      .filter(msg => msg.to === agentId || msg.from === agentId)
      .slice(-limit);
  }

  // Performance tracking
  private updateAgentPerformance(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const agentTasks = Array.from(this.tasks.values()).filter(task => task.assignedTo === agentId);
    const completedTasks = agentTasks.filter(task => task.status === 'completed');

    agent.performance.tasksCompleted = completedTasks.length;
    agent.performance.successRate = agentTasks.length > 0 ? completedTasks.length / agentTasks.length : 1.0;

    if (completedTasks.length > 0) {
      const totalTime = completedTasks.reduce((sum, task) => sum + (task.actualDuration || 0), 0);
      agent.performance.averageResponseTime = totalTime / completedTasks.length;
    }
  }

  // Data persistence for sessions
  private saveSessionData(sessionId: string): void {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) return;

      const sessionFile = path.join(this.dataPath, 'sessions', `${sessionId}.json`);
      fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
    } catch (error) {
      logger.error(`Failed to save session data for ${sessionId}:`, error);
    }
  }

  // Smart task delegation
  async delegateTask(taskId: string): Promise<string | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    // Find best agent for this task based on capabilities and performance
    const suitableAgents = this.findSuitableAgents(task);
    if (suitableAgents.length === 0) return null;

    // Select best agent (simplified - could use more sophisticated logic)
    const bestAgent = suitableAgents[0];

    if (this.assignTask(taskId, bestAgent.id)) {
      return bestAgent.id;
    }

    return null;
  }

  private findSuitableAgents(task: Task): Agent[] {
    return Array.from(this.agents.values())
      .filter(agent => agent.status === 'idle')
      .sort((a, b) => {
        // Simple scoring based on capabilities match and performance
        const aScore = this.calculateAgentScore(a, task);
        const bScore = this.calculateAgentScore(b, task);
        return bScore - aScore;
      });
  }

  private calculateAgentScore(agent: Agent, task: Task): number {
    let score = 0;

    // Capability matching
    task.tags.forEach(tag => {
      if (agent.capabilities.includes(tag)) score += 10;
      if (agent.performance.specialization[tag]) score += agent.performance.specialization[tag] * 5;
    });

    // Performance bonus
    score += agent.performance.successRate * 5;
    score += (1 / (agent.performance.averageResponseTime || 1000)) * 2;

    return score;
  }

  // Analytics and insights
  generateSessionReport(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const insights = [];

    // Performance insights
    if (session.metrics.completedTasks > 0) {
      const avgTaskTime = session.tasks
        .filter(t => t.actualDuration)
        .reduce((sum, t) => sum + (t.actualDuration || 0), 0) / session.metrics.completedTasks;

      if (avgTaskTime > 300000) { // 5 minutes
        insights.push('Tasks are taking longer than expected. Consider breaking them down further.');
      }

      session.metrics.averageTaskTime = avgTaskTime;
    }

    // Agent utilization insights
    const underutilizedAgents = Object.entries(session.metrics.agentUtilization)
      .filter(([, utilization]) => utilization < 50)
      .map(([agentId]) => agentId);

    if (underutilizedAgents.length > 0) {
      insights.push(`Some agents (${underutilizedAgents.join(', ')}) were underutilized. Consider better task distribution.`);
    }

    session.insights = insights;
    this.saveSessionData(sessionId);

    return {
      session: {
        id: session.id,
        name: session.name,
        goal: session.goal,
        status: session.status,
        progress: session.progress,
        duration: session.completedAt ? session.completedAt.getTime() - session.startedAt.getTime() : Date.now() - session.startedAt.getTime()
      },
      metrics: session.metrics,
      insights
    };
  }
}

export { Agent, Task, CollaborationSession, Message };
