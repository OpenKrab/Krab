// ============================================================
// 🦀 Krab — Agent Collaboration Index
// ============================================================
import { agentCollaborationTool, createCollaborationTools } from './tools.js';
import { taskManagementTool } from './tools.js';

// Re-export everything
export {
  agentCollaborationTool,
  createCollaborationTools,
  taskManagementTool
};

// Re-export types
export type {
  Agent,
  Task,
  CollaborationSession,
  Message
} from './agent-collaboration.js';

export type {
  CollaborationToolOptions
} from './tools.js';

// Collaboration tools collection for easy registration
export const collaborationTools = [
  agentCollaborationTool,
  taskManagementTool
];
