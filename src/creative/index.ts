// ============================================================
// 🦀 Krab — Creative & Media Index
// ============================================================
import {
  imageGenerationTool,
  imageEditingTool,
  imageVariationsTool,
  mediaAnalysisTool,
  mediaConversionTool,
  generatedImagesTool,
  createCreativeTools
} from './tools.js';

// Re-export everything
export {
  imageGenerationTool,
  imageEditingTool,
  imageVariationsTool,
  mediaAnalysisTool,
  mediaConversionTool,
  generatedImagesTool,
  createCreativeTools
};

// Re-export types
export type {
  ImageGenerationOptions,
  ImageEditOptions,
  ImageVariationOptions,
  GeneratedImage,
  MediaAnalysisOptions,
  MediaConversionOptions
} from './image-generator.js';

// Creative tools collection for easy registration
export const creativeTools = [
  imageGenerationTool,
  imageEditingTool,
  imageVariationsTool,
  mediaAnalysisTool,
  mediaConversionTool,
  generatedImagesTool
];
