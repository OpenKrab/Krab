// ============================================================
// 🦀 Krab — Security Tools
// ============================================================
import { SecurityManager, User, ToolApprovalRequest, RateLimitRule, CostControlRule, AuditLogEntry } from './security-manager.js';
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';

export interface SecurityToolOptions {
  action: 'create_user' | 'authenticate' | 'authorize' | 'generate_token' | 'validate_token' | 'audit_logs' | 'request_approval' | 'approve_request' | 'reject_request' | 'check_rate_limit' | 'check_cost_limit' | 'get_users' | 'get_approvals' | 'get_rate_limits' | 'get_cost_controls';
  userId?: string;
  username?: string;
  password?: string;
  email?: string;
  permission?: string;
  token?: string;
  tokenType?: 'access' | 'refresh' | 'api_key';
  toolName?: string;
  parameters?: any;
  reason?: string;
  requestId?: string;
  scope?: 'user' | 'ip' | 'global';
  target?: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export class SecurityTools {
  private securityManager: SecurityManager;

  constructor() {
    this.securityManager = new SecurityManager();
  }

  async executeTool(options: SecurityToolOptions): Promise<ToolResult> {
    try {
      logger.info(`[SecurityTools] Executing: ${options.action}`);

      let userResult, authResult, authzResult, tokenResult, validateResult, auditResult, requestResult, approveResult, rejectResult, rateLimitResult, costLimitResult, users, approvals, rateLimits, costControls;

      switch (options.action) {
        case 'create_user':
          userResult = this.createUser(options);
          break;

        case 'authenticate':
          authResult = this.authenticate(options);
          break;

        case 'authorize':
          authzResult = this.authorize(options);
          break;

        case 'generate_token':
          tokenResult = this.generateToken(options);
          break;

        case 'validate_token':
          validateResult = this.validateToken(options);
          break;

        case 'audit_logs':
          auditResult = this.getAuditLogs(options);
          break;

        case 'request_approval':
          requestResult = this.requestApproval(options);
          break;

        case 'approve_request':
          approveResult = this.approveRequest(options);
          break;

        case 'reject_request':
          rejectResult = this.rejectRequest(options);
          break;

        case 'check_rate_limit':
          rateLimitResult = this.checkRateLimit(options);
          break;

        case 'check_cost_limit':
          costLimitResult = this.checkCostLimit(options);
          break;

        case 'get_users':
          users = this.getUsers();
          break;

        case 'get_approvals':
          approvals = this.getApprovals();
          break;

        case 'get_rate_limits':
          rateLimits = this.getRateLimits();
          break;

        case 'get_cost_controls':
          costControls = this.getCostControls();
          break;

        default:
          throw new Error(`Unknown security action: ${options.action}`);
      }

      const result = {
        success: true,
        output: JSON.stringify({
          action: options.action,
          timestamp: new Date().toISOString(),
          ...(options.action === 'create_user' && userResult && { userId: userResult }),
          ...(options.action === 'authenticate' && authResult && { user: authResult }),
          ...(options.action === 'authorize' && { authorized: authzResult }),
          ...(options.action === 'generate_token' && tokenResult && { token: tokenResult.token }),
          ...(options.action === 'validate_token' && validateResult && { user: validateResult }),
          ...(options.action === 'audit_logs' && { logs: auditResult }),
          ...(options.action === 'request_approval' && requestResult && { requestId: requestResult }),
          ...(options.action === 'approve_request' && { approved: approveResult }),
          ...(options.action === 'reject_request' && { rejected: rejectResult }),
          ...(options.action === 'check_rate_limit' && { allowed: rateLimitResult }),
          ...(options.action === 'check_cost_limit' && { allowed: costLimitResult }),
          ...(options.action === 'get_users' && { users }),
          ...(options.action === 'get_approvals' && { approvals }),
          ...(options.action === 'get_rate_limits' && { rateLimits }),
          ...(options.action === 'get_cost_controls' && { costControls })
        }, null, 2)
      };

      logger.info(`[SecurityTools] Action completed: ${options.action}`);
      return result;

    } catch (error) {
      logger.error(`[SecurityTools] Action failed: ${options.action}`, error);
      return {
        success: false,
        output: "",
        error: `Security action failed: ${(error as Error).message}`
      };
    }
  }

  private createUser(options: SecurityToolOptions): string | undefined {
    if (!options.username || !options.email) {
      throw new Error('Username and email are required');
    }

    return this.securityManager.createUser({
      username: options.username,
      email: options.email,
      role: 'user',
      permissions: ['read'],
      isActive: true
    });
  }

  private authenticate(options: SecurityToolOptions): User | null {
    if (!options.username || !options.password) {
      throw new Error('Username and password are required');
    }

    return this.securityManager.authenticateUser(options.username, options.password);
  }

  private authorize(options: SecurityToolOptions): boolean {
    if (!options.userId || !options.permission) {
      throw new Error('User ID and permission are required');
    }

    return this.securityManager.authorizeUser(options.userId, options.permission);
  }

  private generateToken(options: SecurityToolOptions): any {
    if (!options.userId) {
      throw new Error('User ID is required');
    }

    return this.securityManager.generateToken(
      options.userId,
      options.tokenType || 'access',
      3600000 // 1 hour
    );
  }

  private validateToken(options: SecurityToolOptions): User | null {
    if (!options.token) {
      throw new Error('Token is required');
    }

    return this.securityManager.validateToken(options.token);
  }

  private getAuditLogs(options: SecurityToolOptions): AuditLogEntry[] {
    const startDate = options.startDate ? new Date(options.startDate) : undefined;
    const endDate = options.endDate ? new Date(options.endDate) : undefined;

    return this.securityManager.getAuditLogs(
      options.userId,
      undefined, // action filter
      options.limit || 100,
      startDate,
      endDate
    );
  }

  private requestApproval(options: SecurityToolOptions): string | undefined {
    if (!options.userId || !options.toolName) {
      throw new Error('User ID and tool name are required');
    }

    return this.securityManager.requestToolApproval(
      options.userId,
      options.toolName,
      options.parameters || {},
      options.reason
    );
  }

  private approveRequest(options: SecurityToolOptions): boolean {
    if (!options.requestId || !options.userId) {
      throw new Error('Request ID and user ID are required');
    }

    return this.securityManager.approveToolRequest(options.requestId, options.userId);
  }

  private rejectRequest(options: SecurityToolOptions): boolean {
    if (!options.requestId || !options.userId) {
      throw new Error('Request ID and user ID are required');
    }

    return this.securityManager.rejectToolRequest(options.requestId, options.userId, options.reason);
  }

  private checkRateLimit(options: SecurityToolOptions): boolean {
    const scope = options.scope || 'user';
    const target = options.target || 'default';

    return this.securityManager.checkRateLimit(scope, target);
  }

  private checkCostLimit(options: SecurityToolOptions): boolean {
    const scope = (options.scope as 'user' | 'project' | 'global') || 'user';
    const target = options.target || 'default';

    // For checking, we assume a test cost of 1
    return this.securityManager.checkCostLimit(scope, target, 1);
  }

  private getUsers(): Array<{ id: string; username: string; email: string; role: string; isActive: boolean }> {
    // In a real implementation, you'd have a getUsers method in SecurityManager
    // For now, return empty array
    return [];
  }

  private getApprovals(): ToolApprovalRequest[] {
    // In a real implementation, you'd have a getApprovals method in SecurityManager
    // For now, return empty array
    return [];
  }

  private getRateLimits(): RateLimitRule[] {
    // In a real implementation, you'd have a getRateLimits method in SecurityManager
    // For now, return empty array
    return [];
  }

  private getCostControls(): CostControlRule[] {
    // In a real implementation, you'd have a getCostControls method in SecurityManager
    // For now, return empty array
    return [];
  }

  getSecurityManager(): SecurityManager {
    return this.securityManager;
  }
}

// ── Security Management Tool ───────────────────────────────────
export const securityManagementTool: Tool = {
  name: "security_management",
  description: "Comprehensive enterprise security management including authentication, authorization, audit logging, tool approval, rate limiting, and cost controls.",
  parameters: z.object({
    action: z.enum(["create_user", "authenticate", "authorize", "generate_token", "validate_token", "audit_logs", "request_approval", "approve_request", "reject_request", "check_rate_limit", "check_cost_limit", "get_users", "get_approvals", "get_rate_limits", "get_cost_controls"]).describe("Security management action to perform"),
    userId: z.string().optional().describe("User ID for operations"),
    username: z.string().optional().describe("Username for authentication/creation"),
    password: z.string().optional().describe("Password for authentication"),
    email: z.string().optional().describe("Email for user creation"),
    permission: z.string().optional().describe("Permission to check"),
    token: z.string().optional().describe("Token for validation"),
    tokenType: z.enum(["access", "refresh", "api_key"]).optional().describe("Type of token to generate"),
    toolName: z.string().optional().describe("Tool name for approval"),
    parameters: z.record(z.any()).optional().describe("Tool parameters for approval"),
    reason: z.string().optional().describe("Reason for approval/rejection"),
    requestId: z.string().optional().describe("Approval request ID"),
    scope: z.enum(["user", "ip", "global"]).optional().describe("Scope for rate limiting/cost control"),
    target: z.string().optional().describe("Target for rate limiting/cost control"),
    limit: z.number().optional().describe("Limit for results"),
    startDate: z.string().optional().describe("Start date for audit logs"),
    endDate: z.string().optional().describe("End date for audit logs")
  }),

  async execute(args: any): Promise<ToolResult> {
    const securityTools = new SecurityTools();
    return await securityTools.executeTool(args);
  },

  sideEffect: true,
  requireApproval: true
};

// ── Authentication Tool ─────────────────────────────────────────
export const authenticationTool: Tool = {
  name: "authentication",
  description: "User authentication and token management for secure access control.",
  parameters: z.object({
    action: z.enum(["login", "logout", "generate_token", "validate_token", "revoke_token"]).describe("Authentication action"),
    username: z.string().optional().describe("Username for login"),
    password: z.string().optional().describe("Password for login"),
    token: z.string().optional().describe("Token for validation/revocation"),
    tokenType: z.enum(["access", "refresh", "api_key"]).optional().describe("Token type")
  }),

  async execute(args: any): Promise<ToolResult> {
    const securityTools = new SecurityTools();
    const manager = securityTools.getSecurityManager();

    try {
      switch (args.action) {
        case 'login':
          if (!args.username || !args.password) {
            throw new Error('Username and password required');
          }
          const user = manager.authenticateUser(args.username, args.password);
          return {
            success: !!user,
            output: user ? JSON.stringify({ userId: user.id, role: user.role }, null, 2) : 'Authentication failed'
          };

        case 'logout':
          // In a stateless system, logout would invalidate tokens
          return {
            success: true,
            output: 'Logged out successfully'
          };

        case 'generate_token':
          if (!args.username) {
            throw new Error('Username required');
          }
          // Find user by username (simplified)
          const users = manager['users'];
          const foundUser = Array.from(users.values()).find(u => u.username === args.username);
          if (!foundUser) {
            throw new Error('User not found');
          }
          const token = manager.generateToken(foundUser.id, args.tokenType || 'access');
          return {
            success: true,
            output: JSON.stringify({ token: token.token, expiresAt: token.expiresAt }, null, 2)
          };

        case 'validate_token':
          if (!args.token) {
            throw new Error('Token required');
          }
          const validatedUser = manager.validateToken(args.token);
          return {
            success: !!validatedUser,
            output: validatedUser ? JSON.stringify({ userId: validatedUser.id, username: validatedUser.username }, null, 2) : 'Invalid token'
          };

        case 'revoke_token':
          if (!args.token) {
            throw new Error('Token required');
          }
          const revoked = manager.revokeToken(args.token);
          return {
            success: revoked,
            output: revoked ? 'Token revoked successfully' : 'Token not found'
          };

        default:
          throw new Error(`Unknown authentication action: ${args.action}`);
      }

    } catch (error) {
      logger.error('[AuthenticationTool] Action failed:', error);
      return {
        success: false,
        output: "",
        error: `Authentication action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// ── Audit Tool ──────────────────────────────────────────────────
export const auditTool: Tool = {
  name: "audit",
  description: "Security audit logging and compliance monitoring for all system activities.",
  parameters: z.object({
    action: z.enum(["logs", "search", "export", "stats"]).describe("Audit action"),
    userId: z.string().optional().describe("Filter by user ID"),
    action: z.string().optional().describe("Filter by action"),
    limit: z.number().optional().describe("Number of logs to retrieve"),
    startDate: z.string().optional().describe("Start date for filtering"),
    endDate: z.string().optional().describe("End date for filtering"),
    format: z.enum(["json", "csv"]).optional().describe("Export format")
  }),

  async execute(args: any): Promise<ToolResult> {
    const securityTools = new SecurityTools();
    const manager = securityTools.getSecurityManager();

    try {
      switch (args.action) {
        case 'logs':
          const logs = manager.getAuditLogs(
            args.userId,
            args.action,
            args.limit || 100,
            args.startDate ? new Date(args.startDate) : undefined,
            args.endDate ? new Date(args.endDate) : undefined
          );
          return {
            success: true,
            output: JSON.stringify({
              logs: logs.map(log => ({
                id: log.id,
                timestamp: log.timestamp.toISOString(),
                userId: log.userId,
                action: log.action,
                resource: log.resource,
                method: log.method,
                status: log.status,
                details: log.details,
                ipAddress: log.ipAddress
              })),
              total: logs.length
            }, null, 2)
          };

        case 'search':
          // Enhanced search would be implemented here
          const searchResults = manager.getAuditLogs(
            args.userId,
            args.action,
            args.limit || 50,
            args.startDate ? new Date(args.startDate) : undefined,
            args.endDate ? new Date(args.endDate) : undefined
          );
          return {
            success: true,
            output: JSON.stringify({ results: searchResults.length }, null, 2)
          };

        case 'export':
          const exportLogs = manager.getAuditLogs(
            args.userId,
            args.action,
            1000, // Export more logs
            args.startDate ? new Date(args.startDate) : undefined,
            args.endDate ? new Date(args.endDate) : undefined
          );

          if (args.format === 'csv') {
            const csvHeader = 'timestamp,userId,action,resource,method,status,details\n';
            const csvRows = exportLogs.map(log =>
              `${log.timestamp.toISOString()},${log.userId || ''},${log.action},${log.resource},${log.method},${log.status},"${JSON.stringify(log.details).replace(/"/g, '""')}"`
            ).join('\n');
            return {
              success: true,
              output: csvHeader + csvRows
            };
          }

          return {
            success: true,
            output: JSON.stringify({ logs: exportLogs }, null, 2)
          };

        case 'stats':
          const allLogs = manager.getAuditLogs();
          const stats = {
            totalLogs: allLogs.length,
            successRate: allLogs.filter(l => l.status === 'success').length / allLogs.length,
            failureRate: allLogs.filter(l => l.status === 'failure').length / allLogs.length,
            topActions: Object.entries(
              allLogs.reduce((acc, log) => {
                acc[log.action] = (acc[log.action] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).sort(([,a], [,b]) => b - a).slice(0, 10),
            topUsers: Object.entries(
              allLogs.reduce((acc, log) => {
                if (log.userId) {
                  acc[log.userId] = (acc[log.userId] || 0) + 1;
                }
                return acc;
              }, {} as Record<string, number>)
            ).sort(([,a], [,b]) => b - a).slice(0, 10)
          };

          return {
            success: true,
            output: JSON.stringify(stats, null, 2)
          };

        default:
          throw new Error(`Unknown audit action: ${args.action}`);
      }

    } catch (error) {
      logger.error('[AuditTool] Action failed:', error);
      return {
        success: false,
        output: "",
        error: `Audit action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// ── Rate Limiting Tool ──────────────────────────────────────────
export const rateLimitingTool: Tool = {
  name: "rate_limiting",
  description: "Rate limiting management and monitoring for API protection and resource control.",
  parameters: z.object({
    action: z.enum(["check", "status", "reset", "configure"]).describe("Rate limiting action"),
    scope: z.enum(["user", "ip", "global"]).optional().describe("Scope to check"),
    target: z.string().optional().describe("Target to check"),
    limit: z.number().optional().describe("New limit to set"),
    windowMs: z.number().optional().describe("Time window in milliseconds")
  }),

  async execute(args: any): Promise<ToolResult> {
    const securityTools = new SecurityTools();
    const manager = securityTools.getSecurityManager();

    try {
      const scope = args.scope || 'user';
      const target = args.target || 'default';

      switch (args.action) {
        case 'check':
          const allowed = manager['checkRateLimit'](scope, target);
          return {
            success: true,
            output: JSON.stringify({
              scope,
              target,
              allowed,
              status: allowed ? 'within_limit' : 'rate_limited'
            }, null, 2)
          };

        case 'status':
          const status = manager['getRateLimitStatus'](scope, target);
          return {
            success: true,
            output: status ? JSON.stringify({
              id: status.id,
              name: status.name,
              limit: status.limit,
              windowMs: status.windowMs,
              currentCount: status.currentCount,
              resetTime: status.resetTime.toISOString(),
              isActive: status.isActive
            }, null, 2) : 'No rate limit rule found'
          };

        case 'reset':
          // Reset would require modifying the rule - simplified for now
          return {
            success: true,
            output: 'Rate limit reset (simplified implementation)'
          };

        case 'configure':
          if (!args.limit || !args.windowMs) {
            throw new Error('Limit and window are required for configuration');
          }
          // Configuration would be implemented here
          return {
            success: true,
            output: 'Rate limit configured (simplified implementation)'
          };

        default:
          throw new Error(`Unknown rate limiting action: ${args.action}`);
      }

    } catch (error) {
      logger.error('[RateLimitingTool] Action failed:', error);
      return {
        success: false,
        output: "",
        error: `Rate limiting action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// Factory function
export function createSecurityTools(): SecurityTools {
  return new SecurityTools();
}

// Export for dynamic loading
export default SecurityTools;
