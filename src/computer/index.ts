// ============================================================
// 🦀 Krab — Computer Tools Index
// ============================================================
import { computerControlTool, createComputerTools } from './tools.js';
import { computerVisionTool, createComputerVision } from './vision.js';

// Re-export everything
export { 
  computerControlTool, 
  createComputerTools,
  computerVisionTool,
  createComputerVision
};

// Re-export types
export type { 
  ComputerAction, 
  MouseAction, 
  KeyboardAction, 
  ScreenshotAction, 
  WindowAction 
} from './interface.js';
export type {
  ComputerToolOptions
} from './tools.js';

export type { 
  VisionAnalysis, 
  VisionOptions 
} from './vision.js';

// Computer tools collection for easy registration
export const computerTools = [
  computerControlTool,
  computerVisionTool,
  // Add system info tool here when implemented
];
