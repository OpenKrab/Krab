// ============================================================
// 🦀 Krab — Security Enhancements (Enterprise Security)
// ============================================================
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    department?: string;
    manager?: string;
    costLimit?: number;
    rateLimit?: number;
  };
}

export interface AuthToken {
  id: string;
  userId: string;
  token: string;
  type: 'access' | 'refresh' | 'api_key';
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
  metadata?: any;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  method: string;
  status: 'success' | 'failure' | 'warning';
  details: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  duration?: number;
  cost?: number;
}

export interface ToolApprovalRequest {
  id: string;
  userId: string;
  toolName: string;
  parameters: any;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  expiresAt: Date;
  metadata?: any;
}

export interface RateLimitRule {
  id: string;
  name: string;
  scope: 'user' | 'ip' | 'global';
  target: string; // userId, ip, or 'global'
  limit: number;
  windowMs: number; // time window in milliseconds
  currentCount: number;
  resetTime: Date;
  createdAt: Date;
  isActive: boolean;
}

export interface CostControlRule {
  id: string;
  name: string;
  scope: 'user' | 'project' | 'global';
  target: string;
  maxCostPerHour: number;
  maxCostPerDay: number;
  maxCostPerMonth: number;
  currentHourlyCost: number;
  currentDailyCost: number;
  currentMonthlyCost: number;
  lastReset: Date;
  isActive: boolean;
  createdAt: Date;
}

export class SecurityManager extends EventEmitter {
  private users: Map<string, User> = new Map();
  private tokens: Map<string, AuthToken> = new Map();
  private auditLogs: AuditLogEntry[] = [];
  private toolApprovals: Map<string, ToolApprovalRequest> = new Map();
  private rateLimits: Map<string, RateLimitRule> = new Map();
  private costControls: Map<string, CostControlRule> = new Map();

  private dataPath: string;
  private maxAuditLogs: number = 10000;
  private tokenSecret: string;

  constructor(dataPath?: string) {
    super();

    this.dataPath = dataPath || path.join(process.cwd(), 'security-data');
    this.tokenSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

    this.ensureDataDirectory();
    this.loadData();
    this.initializeDefaultSecurity();
  }

  private ensureDataDirectory(): void {
    const dirs = [
      this.dataPath,
      path.join(this.dataPath, 'audit'),
      path.join(this.dataPath, 'backups')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private loadData(): void {
    try {
      // Load users
      const usersFile = path.join(this.dataPath, 'users.json');
      if (fs.existsSync(usersFile)) {
        const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        Object.entries(usersData).forEach(([id, user]: [string, any]) => {
          this.users.set(id, {
            ...user,
            lastLogin: user.lastLogin ? new Date(user.lastLogin) : undefined,
            createdAt: new Date(user.createdAt),
            updatedAt: new Date(user.updatedAt)
          });
        });
      }

      // Load other data structures similarly...
      logger.info('[SecurityManager] Security data loaded successfully');
    } catch (error) {
      logger.error('Failed to load security data:', error);
    }
  }

  private saveData(): void {
    try {
      // Save users
      const usersData: { [key: string]: any } = {};
      this.users.forEach((user, id) => {
        usersData[id] = user;
      });
      fs.writeFileSync(path.join(this.dataPath, 'users.json'), JSON.stringify(usersData, null, 2));

      // Save other data structures...
    } catch (error) {
      logger.error('Failed to save security data:', error);
    }
  }

  private initializeDefaultSecurity(): void {
    // Create default admin user
    if (!this.users.has('admin')) {
      const adminUser: User = {
        id: 'admin',
        username: 'admin',
        email: 'admin@krab.ai',
        role: 'admin',
        permissions: ['*'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.users.set('admin', adminUser);
    }

    // Initialize default rate limits
    this.initializeDefaultRateLimits();

    // Initialize default cost controls
    this.initializeDefaultCostControls();

    this.saveData();
    logger.info('[SecurityManager] Default security configuration initialized');
  }

  private initializeDefaultRateLimits(): void {
    const defaultRules: Omit<RateLimitRule, 'id' | 'currentCount' | 'resetTime' | 'createdAt'>[] = [
      {
        name: 'Global API Rate Limit',
        scope: 'global',
        target: 'global',
        limit: 1000,
        windowMs: 60 * 60 * 1000, // 1 hour
        isActive: true
      },
      {
        name: 'User API Rate Limit',
        scope: 'user',
        target: 'default',
        limit: 100,
        windowMs: 60 * 60 * 1000, // 1 hour
        isActive: true
      }
    ];

    defaultRules.forEach(rule => {
      const id = `rate-limit-${rule.scope}-${rule.target}`;
      if (!this.rateLimits.has(id)) {
        this.rateLimits.set(id, {
          ...rule,
          id,
          currentCount: 0,
          resetTime: new Date(Date.now() + rule.windowMs),
          createdAt: new Date()
        });
      }
    });
  }

  private initializeDefaultCostControls(): void {
    const defaultRules: Omit<CostControlRule, 'id' | 'currentHourlyCost' | 'currentDailyCost' | 'currentMonthlyCost' | 'lastReset' | 'createdAt'>[] = [
      {
        name: 'Global Cost Control',
        scope: 'global',
        target: 'global',
        maxCostPerHour: 100,
        maxCostPerDay: 1000,
        maxCostPerMonth: 10000,
        isActive: true
      },
      {
        name: 'User Cost Control',
        scope: 'user',
        target: 'default',
        maxCostPerHour: 10,
        maxCostPerDay: 50,
        maxCostPerMonth: 200,
        isActive: true
      }
    ];

    defaultRules.forEach(rule => {
      const id = `cost-control-${rule.scope}-${rule.target}`;
      if (!this.costControls.has(id)) {
        this.costControls.set(id, {
          ...rule,
          id,
          currentHourlyCost: 0,
          currentDailyCost: 0,
          currentMonthlyCost: 0,
          lastReset: new Date(),
          createdAt: new Date()
        });
      }
    });
  }

  // User Management
  createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const user: User = {
      ...userData,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.users.set(id, user);
    this.saveData();

    this.auditLog({
      userId: 'system',
      action: 'user_created',
      resource: 'users',
      method: 'POST',
      status: 'success',
      details: { userId: id, username: user.username }
    });

    logger.info(`[SecurityManager] User created: ${user.username} (${id})`);
    return id;
  }

  authenticateUser(username: string, password: string): User | null {
    // Simple authentication (in production, use proper password hashing)
    const user = Array.from(this.users.values()).find(u =>
      u.username === username && u.isActive
    );

    if (user) {
      user.lastLogin = new Date();
      user.updatedAt = new Date();
      this.saveData();

      this.auditLog({
        userId: user.id,
        action: 'user_login',
        resource: 'auth',
        method: 'POST',
        status: 'success',
        details: { username: user.username }
      });
    }

    return user || null;
  }

  authorizeUser(userId: string, permission: string): boolean {
    const user = this.users.get(userId);
    if (!user || !user.isActive) return false;

    // Admin has all permissions
    if (user.role === 'admin' || user.permissions.includes('*')) return true;

    return user.permissions.includes(permission);
  }

  // Token Management
  generateToken(userId: string, type: AuthToken['type'] = 'access', expiresIn: number = 3600000): AuthToken {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresIn);

    const authToken: AuthToken = {
      id: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      token,
      type,
      expiresAt,
      isActive: true,
      createdAt: new Date()
    };

    this.tokens.set(token, authToken);
    this.saveData();

    return authToken;
  }

  validateToken(token: string): User | null {
    const authToken = this.tokens.get(token);

    if (!authToken || !authToken.isActive) return null;
    if (authToken.expiresAt < new Date()) {
      authToken.isActive = false;
      this.saveData();
      return null;
    }

    authToken.lastUsed = new Date();
    this.saveData();

    return this.users.get(authToken.userId) || null;
  }

  revokeToken(token: string): boolean {
    const authToken = this.tokens.get(token);
    if (!authToken) return false;

    authToken.isActive = false;
    this.saveData();
    return true;
  }

  // Audit Logging
  auditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    this.auditLogs.push(auditEntry);

    // Keep only recent logs
    if (this.auditLogs.length > this.maxAuditLogs) {
      this.auditLogs = this.auditLogs.slice(-this.maxAuditLogs);
    }

    // Save audit logs periodically
    if (this.auditLogs.length % 100 === 0) {
      this.saveAuditLogs();
    }

    this.emit('auditLog', auditEntry);
  }

  private saveAuditLogs(): void {
    try {
      const auditFile = path.join(this.dataPath, 'audit', `audit-${Date.now()}.json`);
      fs.writeFileSync(auditFile, JSON.stringify(this.auditLogs.slice(-1000), null, 2));
    } catch (error) {
      logger.error('Failed to save audit logs:', error);
    }
  }

  getAuditLogs(
    userId?: string,
    action?: string,
    limit: number = 100,
    startDate?: Date,
    endDate?: Date
  ): AuditLogEntry[] {
    let logs = [...this.auditLogs];

    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }

    if (action) {
      logs = logs.filter(log => log.action === action);
    }

    if (startDate) {
      logs = logs.filter(log => log.timestamp >= startDate);
    }

    if (endDate) {
      logs = logs.filter(log => log.timestamp <= endDate);
    }

    return logs.slice(-limit);
  }

  // Tool Approval System
  requestToolApproval(userId: string, toolName: string, parameters: any, reason?: string): string {
    const riskLevel = this.assessToolRisk(toolName, parameters);

    const request: ToolApprovalRequest = {
      id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      toolName,
      parameters,
      riskLevel,
      reason,
      status: 'pending',
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    this.toolApprovals.set(request.id, request);
    this.saveData();

    this.auditLog({
      userId,
      action: 'tool_approval_requested',
      resource: 'tools',
      method: 'POST',
      status: 'success',
      details: { toolName, riskLevel, requestId: request.id }
    });

    this.emit('toolApprovalRequested', request);
    return request.id;
  }

  approveToolRequest(requestId: string, reviewerId: string): boolean {
    const request = this.toolApprovals.get(requestId);
    if (!request || request.status !== 'pending') return false;

    request.status = 'approved';
    request.reviewedAt = new Date();
    request.reviewedBy = reviewerId;

    this.saveData();

    this.auditLog({
      userId: reviewerId,
      action: 'tool_approval_approved',
      resource: 'tools',
      method: 'PUT',
      status: 'success',
      details: { requestId, toolName: request.toolName }
    });

    this.emit('toolApprovalApproved', request);
    return true;
  }

  rejectToolRequest(requestId: string, reviewerId: string, reason?: string): boolean {
    const request = this.toolApprovals.get(requestId);
    if (!request || request.status !== 'pending') return false;

    request.status = 'rejected';
    request.reviewedAt = new Date();
    request.reviewedBy = reviewerId;
    request.metadata = { rejectionReason: reason };

    this.saveData();

    this.auditLog({
      userId: reviewerId,
      action: 'tool_approval_rejected',
      resource: 'tools',
      method: 'PUT',
      status: 'success',
      details: { requestId, toolName: request.toolName, reason }
    });

    this.emit('toolApprovalRejected', request);
    return true;
  }

  checkToolApproval(userId: string, toolName: string, parameters: any): ToolApprovalRequest | null {
    // Check for existing approved requests
    const userApprovals = Array.from(this.toolApprovals.values()).filter(
      approval => approval.userId === userId &&
                 approval.toolName === toolName &&
                 approval.status === 'approved' &&
                 approval.expiresAt > new Date()
    );

    // Find most recent approval
    const recentApproval = userApprovals.sort((a, b) =>
      b.reviewedAt!.getTime() - a.reviewedAt!.getTime()
    )[0];

    return recentApproval || null;
  }

  private assessToolRisk(toolName: string, parameters: any): 'low' | 'medium' | 'high' | 'critical' {
    // Risk assessment logic
    if (toolName.includes('delete') || toolName.includes('remove') || toolName.includes('drop')) {
      return 'high';
    }

    if (toolName.includes('run') || toolName.includes('execute') || toolName.includes('system')) {
      return 'medium';
    }

    if (toolName.includes('view') || toolName.includes('read') || toolName.includes('list')) {
      return 'low';
    }

    return 'medium';
  }

  // Rate Limiting
  checkRateLimit(scope: 'user' | 'ip' | 'global', target: string): boolean {
    const ruleKey = `rate-limit-${scope}-${target}`;
    const globalRuleKey = 'rate-limit-global-global';

    // Check specific rule
    let rule = this.rateLimits.get(ruleKey);

    // Fallback to global rule
    if (!rule) {
      rule = this.rateLimits.get(globalRuleKey);
      if (!rule) return true; // No rule means no limit
    }

    // Reset counter if window expired
    if (rule.resetTime <= new Date()) {
      rule.currentCount = 0;
      rule.resetTime = new Date(Date.now() + rule.windowMs);
    }

    // Check if limit exceeded
    if (rule.currentCount >= rule.limit) {
      return false;
    }

    rule.currentCount++;
    this.saveData();
    return true;
  }

  getRateLimitStatus(scope: 'user' | 'ip' | 'global', target: string): RateLimitRule | null {
    const ruleKey = `rate-limit-${scope}-${target}`;
    return this.rateLimits.get(ruleKey) || this.rateLimits.get('rate-limit-global-global') || null;
  }

  // Cost Control
  checkCostLimit(scope: 'user' | 'project' | 'global', target: string, cost: number): boolean {
    const ruleKey = `cost-control-${scope}-${target}`;
    const globalRuleKey = 'cost-control-global-global';

    let rule = this.costControls.get(ruleKey);

    // Fallback to global rule
    if (!rule) {
      rule = this.costControls.get(globalRuleKey);
      if (!rule) return true; // No rule means no limit
    }

    // Reset counters if needed
    const now = new Date();
    const hourDiff = now.getTime() - rule.lastReset.getTime();

    if (hourDiff >= 60 * 60 * 1000) { // Reset hourly
      rule.currentHourlyCost = 0;
    }

    if (hourDiff >= 24 * 60 * 60 * 1000) { // Reset daily
      rule.currentDailyCost = 0;
      rule.lastReset = now;
    }

    if (hourDiff >= 30 * 24 * 60 * 60 * 1000) { // Reset monthly
      rule.currentMonthlyCost = 0;
    }

    // Check limits
    if (rule.currentHourlyCost + cost > rule.maxCostPerHour) return false;
    if (rule.currentDailyCost + cost > rule.maxCostPerDay) return false;
    if (rule.currentMonthlyCost + cost > rule.maxCostPerMonth) return false;

    // Update costs
    rule.currentHourlyCost += cost;
    rule.currentDailyCost += cost;
    rule.currentMonthlyCost += cost;

    this.saveData();
    return true;
  }

  recordCost(scope: 'user' | 'project' | 'global', target: string, cost: number): void {
    // This is called after cost is incurred to update tracking
    const ruleKey = `cost-control-${scope}-${target}`;
    const rule = this.costControls.get(ruleKey);

    if (rule) {
      rule.currentHourlyCost += cost;
      rule.currentDailyCost += cost;
      rule.currentMonthlyCost += cost;
      this.saveData();
    }
  }

  getCostStatus(scope: 'user' | 'project' | 'global', target: string): CostControlRule | null {
    const ruleKey = `cost-control-${scope}-${target}`;
    return this.costControls.get(ruleKey) || this.costControls.get('cost-control-global-global') || null;
  }

  // Security Middleware
  createSecurityMiddleware() {
    return {
      authenticate: (req: any, res: any, next: any) => {
        const token = req.headers.authorization?.replace('Bearer ', '') ||
                     req.headers['x-api-key'] ||
                     req.query.apiKey;

        if (!token) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const user = this.validateToken(token);
        if (!user) {
          this.auditLog({
            action: 'authentication_failed',
            resource: 'api',
            method: req.method,
            status: 'failure',
            details: { reason: 'invalid_token' },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
          });
          return res.status(401).json({ error: 'Invalid token' });
        }

        req.user = user;
        next();
      },

      authorize: (permission: string) => {
        return (req: any, res: any, next: any) => {
          if (!req.user || !this.authorizeUser(req.user.id, permission)) {
            this.auditLog({
              userId: req.user?.id,
              action: 'authorization_failed',
              resource: 'api',
              method: req.method,
              status: 'failure',
              details: { permission, path: req.path },
              ipAddress: req.ip,
              userAgent: req.headers['user-agent']
            });
            return res.status(403).json({ error: 'Insufficient permissions' });
          }
          next();
        };
      },

      rateLimit: (scope: 'user' | 'ip' | 'global' = 'user') => {
        return (req: any, res: any, next: any) => {
          const target = scope === 'user' ? req.user?.id :
                        scope === 'ip' ? req.ip : 'global';

          if (!this.checkRateLimit(scope, target)) {
            this.auditLog({
              userId: req.user?.id,
              action: 'rate_limit_exceeded',
              resource: 'api',
              method: req.method,
              status: 'failure',
              details: { scope, target, path: req.path },
              ipAddress: req.ip,
              userAgent: req.headers['user-agent']
            });
            return res.status(429).json({ error: 'Rate limit exceeded' });
          }
          next();
        };
      },

      costControl: (scope: 'user' | 'project' | 'global' = 'user') => {
        return (req: any, res: any, next: any) => {
          // This would be called with estimated cost
          // For now, just pass through
          next();
        };
      },

      audit: (action: string, resource: string) => {
        return (req: any, res: any, next: any) => {
          const startTime = Date.now();

          // Override res.end to capture response
          const originalEnd = res.end;
          res.end = (...args: any[]) => {
            const duration = Date.now() - startTime;

            this.auditLog({
              userId: req.user?.id,
              action,
              resource,
              method: req.method,
              status: res.statusCode < 400 ? 'success' : 'failure',
              details: {
                path: req.path,
                query: req.query,
                statusCode: res.statusCode
              },
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
              duration
            });

            originalEnd.apply(res, args);
          };

          next();
        };
      }
    };
  }
}
