// ============================================================
// 🦀 Krab — Agent Collaboration Tools
// ============================================================
import { AgentCollaboration, Agent, Task, CollaborationSession, Message } from './agent-collaboration.js';
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';

export interface CollaborationToolOptions {
  action: 'create_agent' | 'list_agents' | 'create_task' | 'assign_task' | 'update_task' | 'start_session' | 'add_task_to_session' | 'send_message' | 'get_messages' | 'generate_report';
  agentId?: string;
  taskId?: string;
  sessionId?: string;
  agentData?: Partial<Agent>;
  taskData?: Partial<Task>;
  sessionData?: { name: string; goal: string; agents?: string[] };
  messageData?: { to: string; type: Message['type']; content: string; priority?: Message['priority']; requiresResponse?: boolean };
  limit?: number;
}

export class CollaborationTools {
  private collaboration: AgentCollaboration;

  constructor() {
    this.collaboration = new AgentCollaboration();
  }

  async executeTool(options: CollaborationToolOptions): Promise<ToolResult> {
    try {
      logger.info(`[CollaborationTools] Executing: ${options.action}`);

      switch (options.action) {
        case 'create_agent':
          const agentResult = this.createAgent(options.agentData);
          break;

        case 'list_agents':
          const agents = this.collaboration.getAllAgents();
          break;

        case 'create_task':
          const taskResult = this.createTask(options.taskData);
          break;

        case 'assign_task':
          const assignResult = this.assignTask(options.taskId, options.agentId);
          break;

        case 'update_task':
          const updateResult = this.updateTask(options.taskId, 'completed');
          break;

        case 'start_session':
          const sessionResult = this.startSession(options.sessionData);
          break;

        case 'add_task_to_session':
          const addResult = this.addTaskToSession(options.sessionId, options.taskId);
          break;

        case 'send_message':
          const messageResult = this.sendMessage(options.messageData);
          break;

        case 'get_messages':
          const messages = this.getMessages(options.agentId, options.limit);
          break;

        case 'generate_report':
          const report = this.generateReport(options.sessionId);
          break;

        default:
          throw new Error(`Unknown collaboration action: ${options.action}`);
      }

      const result = {
        success: true,
        output: JSON.stringify({
          action: options.action,
          timestamp: new Date().toISOString(),
          ...(options.action === 'create_agent' && agentResult && { agentId: agentResult }),
          ...(options.action === 'list_agents' && { agents: agents.map(a => ({ id: a.id, name: a.name, role: a.role, status: a.status })) }),
          ...(options.action === 'create_task' && taskResult && { taskId: taskResult }),
          ...(options.action === 'assign_task' && { assigned: assignResult }),
          ...(options.action === 'update_task' && { updated: updateResult }),
          ...(options.action === 'start_session' && sessionResult && { sessionId: sessionResult }),
          ...(options.action === 'add_task_to_session' && { added: addResult }),
          ...(options.action === 'send_message' && messageResult && { messageId: messageResult }),
          ...(options.action === 'get_messages' && { messages }),
          ...(options.action === 'generate_report' && { report })
        }, null, 2)
      };

      logger.info(`[CollaborationTools] Action completed: ${options.action}`);
      return result;

    } catch (error) {
      logger.error(`[CollaborationTools] Action failed: ${options.action}`, error);
      return {
        success: false,
        output: "",
        error: `Collaboration action failed: ${(error as Error).message}`
      };
    }
  }

  private createAgent(agentData?: Partial<Agent>): string | undefined {
    if (!agentData?.name || !agentData?.role) {
      throw new Error('Agent name and role are required');
    }

    return this.collaboration.registerAgent({
      name: agentData.name,
      role: agentData.role,
      capabilities: agentData.capabilities || [],
      status: 'idle',
      performance: {
        tasksCompleted: 0,
        averageResponseTime: 0,
        successRate: 1.0,
        specialization: {}
      },
      lastActive: new Date(),
      ...agentData
    });
  }

  private createTask(taskData?: Partial<Task>): string | undefined {
    if (!taskData?.title || !taskData?.description) {
      throw new Error('Task title and description are required');
    }

    return this.collaboration.createTask({
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority || 'medium',
      status: 'pending',
      dependencies: taskData.dependencies || [],
      subtasks: taskData.subtasks || [],
      estimatedDuration: taskData.estimatedDuration || 3600000, // 1 hour
      tags: taskData.tags || [],
      context: taskData.context || {},
      ...taskData
    });
  }

  private assignTask(taskId?: string, agentId?: string): boolean {
    if (!taskId || !agentId) {
      throw new Error('Task ID and Agent ID are required');
    }
    return this.collaboration.assignTask(taskId, agentId);
  }

  private updateTask(taskId?: string, status: Task['status'] = 'completed'): boolean {
    if (!taskId) {
      throw new Error('Task ID is required');
    }
    return this.collaboration.updateTaskStatus(taskId, status);
  }

  private startSession(sessionData?: { name: string; goal: string; agents?: string[] }): string | undefined {
    if (!sessionData?.name || !sessionData?.goal) {
      throw new Error('Session name and goal are required');
    }
    return this.collaboration.startSession(sessionData.name, sessionData.goal, sessionData.agents);
  }

  private addTaskToSession(sessionId?: string, taskId?: string): boolean {
    if (!sessionId || !taskId) {
      throw new Error('Session ID and Task ID are required');
    }
    return this.collaboration.addTaskToSession(sessionId, taskId);
  }

  private sendMessage(messageData?: { to: string; type: Message['type']; content: string; priority?: Message['priority']; requiresResponse?: boolean }): string | undefined {
    if (!messageData?.to || !messageData?.type || !messageData?.content) {
      throw new Error('Message recipient, type, and content are required');
    }
    return this.collaboration.sendMessage({
      from: 'system', // Could be parameterized
      to: messageData.to,
      type: messageData.type,
      content: messageData.content,
      priority: messageData.priority || 'medium',
      requiresResponse: messageData.requiresResponse || false
    });
  }

  private getMessages(agentId?: string, limit: number = 50): Message[] {
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    return this.collaboration.getMessagesForAgent(agentId, limit);
  }

  private generateReport(sessionId?: string): any {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    return this.collaboration.generateSessionReport(sessionId);
  }

  // Advanced features
  async autoDelegateTasks(sessionId: string): Promise<ToolResult> {
    try {
      const session = this.collaboration.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const pendingTasks = session.tasks.filter(task => task.status === 'pending');
      let delegatedCount = 0;

      for (const task of pendingTasks) {
        const assignedAgent = await this.collaboration.delegateTask(task.id);
        if (assignedAgent) {
          delegatedCount++;
        }
      }

      return {
        success: true,
        output: JSON.stringify({
          sessionId,
          pendingTasks: pendingTasks.length,
          delegatedTasks: delegatedCount,
          success: delegatedCount > 0
        }, null, 2)
      };

    } catch (error) {
      logger.error('[CollaborationTools] Auto-delegation failed:', error);
      return {
        success: false,
        output: "",
        error: `Auto-delegation failed: ${(error as Error).message}`
      };
    }
  }

  async getCollaborationInsights(): Promise<ToolResult> {
    try {
      const agents = this.collaboration.getAllAgents();
      const tasks = Array.from(this.collaboration['tasks'].values());
      const sessions = Array.from(this.collaboration['sessions'].values());

      const insights = [];

      // Agent performance insights
      const topPerformers = agents
        .filter(a => a.performance.tasksCompleted > 0)
        .sort((a, b) => b.performance.successRate - a.performance.successRate)
        .slice(0, 3);

      if (topPerformers.length > 0) {
        insights.push(`Top performing agents: ${topPerformers.map(a => `${a.name} (${Math.round(a.performance.successRate * 100)}% success rate)`).join(', ')}`);
      }

      // Task completion insights
      const completedTasks = tasks.filter(t => t.status === 'completed');
      const failedTasks = tasks.filter(t => t.status === 'failed');

      if (failedTasks.length > completedTasks.length * 0.1) {
        insights.push(`High failure rate detected: ${failedTasks.length}/${completedTasks.length + failedTasks.length} tasks failed`);
      }

      // Session insights
      const activeSessions = sessions.filter(s => s.status !== 'completed');
      if (activeSessions.length > 0) {
        insights.push(`${activeSessions.length} active collaboration sessions`);
      }

      return {
        success: true,
        output: JSON.stringify({
          summary: {
            totalAgents: agents.length,
            totalTasks: tasks.length,
            totalSessions: sessions.length,
            activeSessions: activeSessions.length
          },
          insights,
          recommendations: this.generateRecommendations(agents, tasks, sessions)
        }, null, 2)
      };

    } catch (error) {
      logger.error('[CollaborationTools] Insights generation failed:', error);
      return {
        success: false,
        output: "",
        error: `Insights generation failed: ${(error as Error).message}`
      };
    }
  }

  private generateRecommendations(agents: Agent[], tasks: Task[], sessions: CollaborationSession[]): string[] {
    const recommendations = [];

    // Check for agent overload
    const busyAgents = agents.filter(a => a.status === 'working');
    if (busyAgents.length > agents.length * 0.7) {
      recommendations.push('Consider adding more agents or redistributing tasks');
    }

    // Check for task bottlenecks
    const oldPendingTasks = tasks.filter(t =>
      t.status === 'pending' &&
      Date.now() - t.createdAt.getTime() > 24 * 60 * 60 * 1000 // 24 hours
    );

    if (oldPendingTasks.length > 0) {
      recommendations.push(`${oldPendingTasks.length} tasks have been pending for over 24 hours`);
    }

    // Check for session efficiency
    const inefficientSessions = sessions.filter(s =>
      s.status === 'completed' &&
      s.metrics.completedTasks > 0 &&
      s.metrics.averageTaskTime > 3600000 // 1 hour per task
    );

    if (inefficientSessions.length > 0) {
      recommendations.push(`${inefficientSessions.length} sessions took unusually long to complete`);
    }

    return recommendations;
  }
}

// ── Agent Collaboration Tool ───────────────────────────────────
export const agentCollaborationTool: Tool = {
  name: "agent_collaboration",
  description: "Multi-agent collaboration system with task delegation, session management, and intelligent agent coordination for complex workflows.",
  parameters: z.object({
    action: z.enum(["create_agent", "list_agents", "create_task", "assign_task", "update_task", "start_session", "add_task_to_session", "send_message", "get_messages", "generate_report", "auto_delegate", "get_insights"]).describe("Collaboration action to perform"),
    agentId: z.string().optional().describe("Agent ID for operations"),
    taskId: z.string().optional().describe("Task ID for operations"),
    sessionId: z.string().optional().describe("Session ID for operations"),
    agentData: z.object({
      name: z.string().describe("Agent name"),
      role: z.string().describe("Agent role"),
      capabilities: z.array(z.string()).optional().describe("Agent capabilities"),
      metadata: z.any().optional().describe("Additional agent metadata")
    }).optional().describe("Agent creation data"),
    taskData: z.object({
      title: z.string().describe("Task title"),
      description: z.string().describe("Task description"),
      priority: z.enum(["low", "medium", "high", "critical"]).optional().describe("Task priority"),
      dependencies: z.array(z.string()).optional().describe("Task dependencies"),
      estimatedDuration: z.number().optional().describe("Estimated duration in milliseconds"),
      tags: z.array(z.string()).optional().describe("Task tags"),
      deadline: z.string().optional().describe("Task deadline")
    }).optional().describe("Task creation data"),
    sessionData: z.object({
      name: z.string().describe("Session name"),
      goal: z.string().describe("Session goal"),
      agents: z.array(z.string()).optional().describe("Agent IDs to include")
    }).optional().describe("Session creation data"),
    messageData: z.object({
      to: z.string().describe("Recipient agent ID"),
      type: z.enum(["task_assignment", "progress_update", "question", "answer", "suggestion", "feedback"]).describe("Message type"),
      content: z.string().describe("Message content"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("Message priority"),
      requiresResponse: z.boolean().optional().describe("Whether response is required")
    }).optional().describe("Message data"),
    limit: z.number().optional().describe("Result limit")
  }),

  async execute(args: any): Promise<ToolResult> {
    const collaborationTools = new CollaborationTools();

    // Handle special actions
    if (args.action === 'auto_delegate') {
      if (!args.sessionId) {
        return {
          success: false,
          output: "",
          error: "Session ID is required for auto-delegation"
        };
      }
      return await collaborationTools.autoDelegateTasks(args.sessionId);
    }

    if (args.action === 'get_insights') {
      return await collaborationTools.getCollaborationInsights();
    }

    // Handle standard actions
    return await collaborationTools.executeTool(args);
  },

  sideEffect: true,
  requireApproval: true
};

// ── Task Management Tool ──────────────────────────────────────
export const taskManagementTool: Tool = {
  name: "task_management",
  description: "Intelligent task management with automatic delegation, progress tracking, and dependency resolution.",
  parameters: z.object({
    action: z.enum(["create", "list", "assign", "update", "delegate", "analyze"]).describe("Task management action"),
    taskId: z.string().optional().describe("Task ID"),
    agentId: z.string().optional().describe("Agent ID"),
    title: z.string().optional().describe("Task title"),
    description: z.string().optional().describe("Task description"),
    priority: z.enum(["low", "medium", "high", "critical"]).optional().describe("Task priority"),
    status: z.enum(["pending", "assigned", "in_progress", "completed", "failed"]).optional().describe("Task status")
  }),

  async execute(args: any): Promise<ToolResult> {
    const collaborationTools = new CollaborationTools();

    try {
      switch (args.action) {
        case 'create':
          if (!args.title || !args.description) {
            throw new Error('Task title and description are required');
          }
          const taskId = collaborationTools.createTask({
            title: args.title,
            description: args.description,
            priority: args.priority || 'medium',
            estimatedDuration: 3600000, // 1 hour default
            tags: [],
            context: {}
          });
          return {
            success: true,
            output: JSON.stringify({ taskId, message: 'Task created successfully' }, null, 2)
          };

        case 'list':
          const tasks = Array.from(collaborationTools.collaboration['tasks'].values());
          return {
            success: true,
            output: JSON.stringify({
              tasks: tasks.map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                assignedTo: t.assignedTo
              }))
            }, null, 2)
          };

        case 'assign':
          if (!args.taskId || !args.agentId) {
            throw new Error('Task ID and Agent ID are required');
          }
          const assigned = collaborationTools.assignTask(args.taskId, args.agentId);
          return {
            success: assigned,
            output: assigned ? 'Task assigned successfully' : 'Task assignment failed'
          };

        case 'update':
          if (!args.taskId || !args.status) {
            throw new Error('Task ID and status are required');
          }
          const updated = collaborationTools.updateTask(args.taskId, args.status);
          return {
            success: updated,
            output: updated ? 'Task updated successfully' : 'Task update failed'
          };

        case 'delegate':
          if (!args.taskId) {
            throw new Error('Task ID is required');
          }
          const delegatedAgent = await collaborationTools.collaboration.delegateTask(args.taskId);
          return {
            success: !!delegatedAgent,
            output: delegatedAgent ? `Task delegated to agent: ${delegatedAgent}` : 'No suitable agent found for delegation'
          };

        case 'analyze':
          // Analyze task dependencies and suggest improvements
          const allTasks = Array.from(collaborationTools.collaboration['tasks'].values());
          const analysis = {
            totalTasks: allTasks.length,
            pendingTasks: allTasks.filter(t => t.status === 'pending').length,
            inProgressTasks: allTasks.filter(t => t.status === 'in_progress').length,
            completedTasks: allTasks.filter(t => t.status === 'completed').length,
            failedTasks: allTasks.filter(t => t.status === 'failed').length,
            averageCompletionTime: 0,
            bottlenecks: []
          };

          // Calculate average completion time
          const completedTasks = allTasks.filter(t => t.status === 'completed' && t.actualDuration);
          if (completedTasks.length > 0) {
            analysis.averageCompletionTime = completedTasks.reduce((sum, t) => sum + (t.actualDuration || 0), 0) / completedTasks.length;
          }

          return {
            success: true,
            output: JSON.stringify({ analysis }, null, 2)
          };

        default:
          throw new Error(`Unknown task management action: ${args.action}`);
      }

    } catch (error) {
      logger.error('[TaskManagementTool] Action failed:', error);
      return {
        success: false,
        output: "",
        error: `Task management action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: true,
  requireApproval: true
};

// Factory function
export function createCollaborationTools(): CollaborationTools {
  return new CollaborationTools();
}

// Export for dynamic loading
export default CollaborationTools;
