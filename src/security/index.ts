// ============================================================
// 🦀 Krab — Security Index
// ============================================================
import { securityManagementTool, authenticationTool, auditTool, rateLimitingTool, createSecurityTools } from './tools.js';

// Re-export everything
export {
  securityManagementTool,
  authenticationTool,
  auditTool,
  rateLimitingTool,
  createSecurityTools
};

// Re-export types
export type {
  User,
  AuthToken,
  AuditLogEntry,
  ToolApprovalRequest,
  RateLimitRule,
  CostControlRule
} from './security-manager.js';

export type {
  SecurityToolOptions
} from './tools.js';

// Security tools collection for easy registration
export const securityTools = [
  securityManagementTool,
  authenticationTool,
  auditTool,
  rateLimitingTool
];
