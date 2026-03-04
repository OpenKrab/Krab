// ============================================================
// 🦀 Krab — Browser Tools Index
// ============================================================
import { browserAutomationTool, createBrowserTools } from './tools.js';
import { browserSessionTool } from './tools.js';
import { browserVisionTool, createBrowserVision } from './vision.js';
import { browserFormTool, createBrowserFormAutomation } from './form-automation.js';

// Re-export everything
export { 
  browserAutomationTool, 
  createBrowserTools,
  browserSessionTool,
  browserVisionTool,
  createBrowserVision,
  browserFormTool,
  createBrowserFormAutomation
};

// Re-export types
export type { 
  BrowserToolOptions, 
  BrowserSession, 
  BrowserOptions 
} from './session.js';

export type { 
  VisionOptions, 
  VisionResult 
} from './vision.js';

export type { 
  FormAutomationOptions, 
  FormField 
} from './form-automation.js';

// Browser tools collection for easy registration
export const browserTools = [
  browserAutomationTool,
  browserSessionTool,
  browserVisionTool,
  browserFormTool
];
