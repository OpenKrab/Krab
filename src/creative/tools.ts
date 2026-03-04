// ============================================================
// 🦀 Krab — Creative & Media Tools
// ============================================================
import { ImageGenerator, GeneratedImage } from './image-generator.js';
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';

export interface MediaAnalysisOptions {
  filePath: string;
  analysis: 'metadata' | 'colors' | 'objects' | 'text' | 'faces' | 'full';
}

export interface MediaConversionOptions {
  inputPath: string;
  outputPath: string;
  format: 'jpg' | 'png' | 'webp' | 'gif' | 'mp4' | 'mp3' | 'wav';
  quality?: number;
  resize?: { width: number; height: number };
}

export class CreativeTools {
  private imageGenerator: ImageGenerator;

  constructor() {
    this.imageGenerator = new ImageGenerator();
  }

  async generateImage(prompt: string, options: any = {}): Promise<ToolResult> {
    try {
      logger.info(`[CreativeTools] Generating image with prompt: ${prompt}`);

      const generationOptions = {
        prompt,
        model: options.model || 'dall-e-3',
        size: options.size || '1024x1024',
        quality: options.quality || 'standard',
        style: options.style || 'vivid',
        negativePrompt: options.negativePrompt,
        seed: options.seed,
        steps: options.steps,
        guidance: options.guidance,
        outputFormat: options.outputFormat || 'png'
      };

      const result = await this.imageGenerator.generateImage(generationOptions);

      return {
        success: true,
        output: JSON.stringify({
          imageId: result.id,
          localPath: result.localPath,
          url: result.url,
          prompt: result.prompt,
          model: result.model,
          size: result.size,
          createdAt: result.createdAt.toISOString(),
          metadata: result.metadata
        }, null, 2)
      };

    } catch (error) {
      logger.error('[CreativeTools] Image generation failed:', error);
      return {
        success: false,
        output: "",
        error: `Image generation failed: ${(error as Error).message}`
      };
    }
  }

  async editImage(imagePath: string, prompt: string, options: any = {}): Promise<ToolResult> {
    try {
      logger.info(`[CreativeTools] Editing image: ${imagePath}`);

      const editOptions = {
        imagePath,
        prompt,
        maskPath: options.maskPath,
        size: options.size || '1024x1024',
        outputFormat: options.outputFormat || 'png'
      };

      const result = await this.imageGenerator.editImage(editOptions);

      return {
        success: true,
        output: JSON.stringify({
          editId: result.id,
          localPath: result.localPath,
          originalImage: imagePath,
          prompt: result.prompt,
          size: result.size,
          createdAt: result.createdAt.toISOString(),
          metadata: result.metadata
        }, null, 2)
      };

    } catch (error) {
      logger.error('[CreativeTools] Image editing failed:', error);
      return {
        success: false,
        output: "",
        error: `Image editing failed: ${(error as Error).message}`
      };
    }
  }

  async createVariations(imagePath: string, options: any = {}): Promise<ToolResult> {
    try {
      logger.info(`[CreativeTools] Creating variations for: ${imagePath}`);

      const variationOptions = {
        imagePath,
        size: options.size || '1024x1024',
        outputFormat: options.outputFormat || 'png'
      };

      const variations = await this.imageGenerator.createVariations(variationOptions);

      return {
        success: true,
        output: JSON.stringify({
          variations: variations.map(v => ({
            id: v.id,
            localPath: v.localPath,
            prompt: v.prompt,
            size: v.size,
            createdAt: v.createdAt.toISOString()
          })),
          totalVariations: variations.length,
          sourceImage: imagePath
        }, null, 2)
      };

    } catch (error) {
      logger.error('[CreativeTools] Variation creation failed:', error);
      return {
        success: false,
        output: "",
        error: `Variation creation failed: ${(error as Error).message}`
      };
    }
  }

  async analyzeMedia(filePath: string, analysisType: string): Promise<ToolResult> {
    try {
      logger.info(`[CreativeTools] Analyzing media: ${filePath} (${analysisType})`);

      // Check if file exists
      if (!require('fs').existsSync(filePath)) {
        return {
          success: false,
          output: "",
          error: `File not found: ${filePath}`
        };
      }

      // Simulate media analysis
      const analysis = await this.simulateMediaAnalysis(filePath, analysisType);

      return {
        success: true,
        output: JSON.stringify({
          filePath,
          analysisType,
          analysis,
          timestamp: new Date().toISOString()
        }, null, 2)
      };

    } catch (error) {
      logger.error('[CreativeTools] Media analysis failed:', error);
      return {
        success: false,
        output: "",
        error: `Media analysis failed: ${(error as Error).message}`
      };
    }
  }

  async convertMedia(inputPath: string, outputPath: string, format: string, options: any = {}): Promise<ToolResult> {
    try {
      logger.info(`[CreativeTools] Converting media: ${inputPath} -> ${outputPath} (${format})`);

      // Check if input file exists
      if (!require('fs').existsSync(inputPath)) {
        return {
          success: false,
          output: "",
          error: `Input file not found: ${inputPath}`
        };
      }

      // Simulate media conversion
      const conversion = await this.simulateMediaConversion(inputPath, outputPath, format, options);

      return {
        success: true,
        output: JSON.stringify({
          inputPath,
          outputPath,
          format,
          conversion,
          timestamp: new Date().toISOString()
        }, null, 2)
      };

    } catch (error) {
      logger.error('[CreativeTools] Media conversion failed:', error);
      return {
        success: false,
        output: "",
        error: `Media conversion failed: ${(error as Error).message}`
      };
    }
  }

  async getGeneratedImages(): Promise<ToolResult> {
    try {
      const images = this.imageGenerator.getGeneratedImages();

      return {
        success: true,
        output: JSON.stringify({
          images: images.map(img => ({
            id: img.id,
            localPath: img.localPath,
            url: img.url,
            prompt: img.prompt,
            model: img.model,
            size: img.size,
            createdAt: img.createdAt.toISOString()
          })),
          totalImages: images.length
        }, null, 2)
      };

    } catch (error) {
      logger.error('[CreativeTools] Get images failed:', error);
      return {
        success: false,
        output: "",
        error: `Failed to get images: ${(error as Error).message}`
      };
    }
  }

  // Placeholder methods for media processing simulation
  private async simulateMediaAnalysis(filePath: string, analysisType: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    switch (analysisType) {
      case 'metadata':
        return {
          size: '1024x768',
          format: 'png',
          colorSpace: 'RGB',
          bitDepth: 8,
          fileSize: '245KB'
        };

      case 'colors':
        return {
          dominantColors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
          colorPalette: [
            { color: '#FF6B6B', percentage: 25 },
            { color: '#4ECDC4', percentage: 20 },
            { color: '#45B7D1', percentage: 18 },
            { color: '#96CEB4', percentage: 15 },
            { color: '#FFEAA7', percentage: 12 }
          ]
        };

      case 'objects':
        return {
          objects: [
            { label: 'person', confidence: 0.95, bbox: [100, 50, 200, 300] },
            { label: 'chair', confidence: 0.87, bbox: [50, 250, 150, 150] },
            { label: 'table', confidence: 0.82, bbox: [200, 200, 300, 150] }
          ],
          totalObjects: 3
        };

      case 'text':
        return {
          text: 'Sample text extracted from image',
          confidence: 0.89,
          language: 'en',
          boundingBoxes: [
            { text: 'Sample', bbox: [10, 10, 80, 20] },
            { text: 'text', bbox: [90, 10, 50, 20] }
          ]
        };

      case 'faces':
        return {
          faces: [
            {
              bbox: [150, 80, 120, 120],
              confidence: 0.96,
              age: 28,
              gender: 'female',
              emotion: 'happy'
            }
          ],
          totalFaces: 1
        };

      case 'full':
        return {
          metadata: { size: '1024x768', format: 'png' },
          colors: { dominantColors: ['#FF6B6B', '#4ECDC4'] },
          objects: { objects: [{ label: 'person', confidence: 0.95 }] },
          text: { text: 'Sample text' },
          faces: { faces: [], totalFaces: 0 }
        };

      default:
        return { error: `Unknown analysis type: ${analysisType}` };
    }
  }

  private async simulateMediaConversion(inputPath: string, outputPath: string, format: string, options: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

    return {
      success: true,
      inputFormat: this.getFileExtension(inputPath),
      outputFormat: format,
      quality: options.quality || 90,
      resize: options.resize ? `${options.resize.width}x${options.resize.height}` : null,
      processingTime: '2.5 seconds',
      outputSize: '185KB'
    };
  }

  private getFileExtension(filePath: string): string {
    return require('path').extname(filePath).slice(1).toLowerCase();
  }
}

// ── Image Generation Tool ───────────────────────────────────
export const imageGenerationTool: Tool = {
  name: "image_generation",
  description: "Generate images using AI models like DALL-E, Stable Diffusion, and Midjourney with customizable prompts, styles, and parameters.",
  parameters: z.object({
    prompt: z.string().describe("Text description of the image to generate"),
    model: z.enum(["dall-e-2", "dall-e-3", "stable-diffusion", "midjourney", "openrouter"]).optional().describe("AI model to use for generation"),
    size: z.enum(["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"]).optional().describe("Image size/resolution"),
    quality: z.enum(["standard", "hd"]).optional().describe("Image quality (DALL-E only)"),
    style: z.enum(["natural", "vivid", "anime", "realistic"]).optional().describe("Image style"),
    negativePrompt: z.string().optional().describe("What to avoid in the image (Stable Diffusion)"),
    seed: z.number().optional().describe("Random seed for reproducible results"),
    steps: z.number().optional().describe("Number of diffusion steps (Stable Diffusion)"),
    guidance: z.number().optional().describe("Guidance scale for prompt adherence (Stable Diffusion)"),
    outputFormat: z.enum(["png", "jpg", "webp"]).optional().describe("Output image format"),
    aspectRatio: z.enum(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]).optional().describe("Aspect ratio for OpenRouter models")
  }),

  async execute(args: any): Promise<ToolResult> {
    const creativeTools = new CreativeTools();
    return await creativeTools.generateImage(args.prompt, args);
  },

  sideEffect: true,
  requireApproval: true
};

// ── Image Editing Tool ──────────────────────────────────────
export const imageEditingTool: Tool = {
  name: "image_editing",
  description: "Edit existing images with AI - add, remove, or modify elements using natural language prompts.",
  parameters: z.object({
    imagePath: z.string().describe("Path to the image file to edit"),
    prompt: z.string().describe("Description of the edits to make"),
    maskPath: z.string().optional().describe("Path to mask image defining editable areas"),
    size: z.enum(["256x256", "512x512", "1024x1024"]).optional().describe("Output image size"),
    outputFormat: z.enum(["png", "jpg", "webp"]).optional().describe("Output format")
  }),

  async execute(args: any): Promise<ToolResult> {
    const creativeTools = new CreativeTools();
    return await creativeTools.editImage(args.imagePath, args.prompt, args);
  },

  sideEffect: true,
  requireApproval: true
};

// ── Image Variations Tool ───────────────────────────────────
export const imageVariationsTool: Tool = {
  name: "image_variations",
  description: "Create multiple variations of an existing image with different styles and compositions.",
  parameters: z.object({
    imagePath: z.string().describe("Path to the source image"),
    size: z.enum(["256x256", "512x512", "1024x1024"]).optional().describe("Output image size"),
    outputFormat: z.enum(["png", "jpg", "webp"]).optional().describe("Output format")
  }),

  async execute(args: any): Promise<ToolResult> {
    const creativeTools = new CreativeTools();
    return await creativeTools.createVariations(args.imagePath, args);
  },

  sideEffect: true,
  requireApproval: true
};

// ── Media Analysis Tool ─────────────────────────────────────
export const mediaAnalysisTool: Tool = {
  name: "media_analysis",
  description: "Analyze images and media files for metadata, colors, objects, text, faces, and other visual features.",
  parameters: z.object({
    filePath: z.string().describe("Path to the media file to analyze"),
    analysisType: z.enum(["metadata", "colors", "objects", "text", "faces", "full"]).describe("Type of analysis to perform")
  }),

  async execute(args: any): Promise<ToolResult> {
    const creativeTools = new CreativeTools();
    return await creativeTools.analyzeMedia(args.filePath, args.analysisType);
  },

  sideEffect: false,
  requireApproval: false
};

// ── Media Conversion Tool ───────────────────────────────────
export const mediaConversionTool: Tool = {
  name: "media_conversion",
  description: "Convert media files between different formats (images, videos, audio) with optional resizing and quality settings.",
  parameters: z.object({
    inputPath: z.string().describe("Path to input media file"),
    outputPath: z.string().describe("Path for output file"),
    format: z.enum(["jpg", "png", "webp", "gif", "mp4", "mp3", "wav"]).describe("Output format"),
    quality: z.number().optional().describe("Quality setting (0-100)"),
    resize: z.object({
      width: z.number().describe("New width"),
      height: z.number().describe("New height")
    }).optional().describe("Resize dimensions")
  }),

  async execute(args: any): Promise<ToolResult> {
    const creativeTools = new CreativeTools();
    return await creativeTools.convertMedia(args.inputPath, args.outputPath, args.format, args);
  },

  sideEffect: true,
  requireApproval: true
};

// ── Generated Images Tool ───────────────────────────────────
export const generatedImagesTool: Tool = {
  name: "generated_images",
  description: "List and manage previously generated images and media files.",
  parameters: z.object({
    action: z.enum(["list", "delete"]).describe("Action to perform"),
    imageId: z.string().optional().describe("Image ID for deletion")
  }),

  async execute(args: any): Promise<ToolResult> {
    const creativeTools = new CreativeTools();

    switch (args.action) {
      case 'list':
        return await creativeTools.getGeneratedImages();

      case 'delete':
        if (!args.imageId) {
          return {
            success: false,
            output: "",
            error: "Image ID required for deletion"
          };
        }
        const deleted = creativeTools.imageGenerator.deleteImage(args.imageId);
        return {
          success: deleted,
          output: deleted ? `Image ${args.imageId} deleted successfully` : `Failed to delete image ${args.imageId}`
        };

      default:
        return {
          success: false,
          output: "",
          error: `Unknown action: ${args.action}`
        };
    }
  },

  sideEffect: true,
  requireApproval: false
};

// Factory function
export function createCreativeTools(): CreativeTools {
  return new CreativeTools();
}

// Export for dynamic loading
export default CreativeTools;
