// ============================================================
// 🦀 Krab — Image Generation (DALL-E & Stable Diffusion)
// ============================================================
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ImageGenerationOptions {
  prompt: string;
  model?: 'dall-e-2' | 'dall-e-3' | 'stable-diffusion' | 'midjourney' | 'openrouter';
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'natural' | 'vivid' | 'anime' | 'realistic';
  negativePrompt?: string;
  seed?: number;
  steps?: number;
  guidance?: number;
  outputFormat?: 'png' | 'jpg' | 'webp';
  aspectRatio?: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
}

export interface ImageEditOptions {
  imagePath: string;
  prompt: string;
  maskPath?: string;
  size?: '256x256' | '512x512' | '1024x1024';
  outputFormat?: 'png' | 'jpg' | 'webp';
}

export interface ImageVariationOptions {
  imagePath: string;
  size?: '256x256' | '512x512' | '1024x1024';
  outputFormat?: 'png' | 'jpg' | 'webp';
}

export interface GeneratedImage {
  id: string;
  url?: string;
  localPath?: string;
  prompt: string;
  model: string;
  size: string;
  createdAt: Date;
  metadata?: any;
}

export class ImageGenerator {
  private apiKeys: { [key: string]: string } = {};
  private outputDir: string;
  private cacheDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'generated-images');
    this.cacheDir = path.join(process.cwd(), 'image-cache');

    this.ensureDirectories();

    // Load API keys from environment
    this.apiKeys = {
      openai: process.env.OPENAI_API_KEY || '',
      stability: process.env.STABILITY_API_KEY || '',
      midjourney: process.env.MIDJOURNEY_API_KEY || '',
      openrouter: process.env.OPENROUTER_API_KEY || ''
    };
  }

  private ensureDirectories(): void {
    [this.outputDir, this.cacheDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async generateImage(options: ImageGenerationOptions): Promise<GeneratedImage> {
    const imageId = crypto.randomBytes(8).toString('hex');
    logger.info(`[ImageGenerator] Generating image: ${imageId} with model ${options.model || 'dall-e-3'}`);

    try {
      let result: GeneratedImage;

      switch (options.model) {
        case 'dall-e-2':
        case 'dall-e-3':
          result = await this.generateWithDalle(options, imageId);
          break;
        case 'stable-diffusion':
          result = await this.generateWithStableDiffusion(options, imageId);
          break;
        case 'midjourney':
          result = await this.generateWithMidjourney(options, imageId);
          break;
        case 'openrouter':
          result = await this.generateWithOpenRouter(options, imageId);
          break;
        default:
          // Default to OpenRouter if API key is available
          if (this.apiKeys.openrouter) {
            result = await this.generateWithOpenRouter(options, imageId);
          } else {
            result = await this.generateWithDalle(options, imageId);
          }
      }

      logger.info(`[ImageGenerator] Image generated successfully: ${result.localPath || result.url}`);
      return result;

    } catch (error) {
      logger.error(`[ImageGenerator] Image generation failed:`, error);
      throw error;
    }
  }

  private async generateWithDalle(options: ImageGenerationOptions, imageId: string): Promise<GeneratedImage> {
    if (!this.apiKeys.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const model = options.model || 'dall-e-3';
    const size = options.size || (model === 'dall-e-3' ? '1024x1024' : '512x512');
    const quality = options.quality || 'standard';
    const style = options.style || 'vivid';

    // In a real implementation, this would call the OpenAI API
    // For now, we'll simulate the response
    const simulatedResult = await this.simulateDalleGeneration(options, imageId);

    // Save simulated image
    const outputPath = path.join(this.outputDir, `${imageId}.png`);
    await this.saveSimulatedImage(outputPath);

    return {
      id: imageId,
      localPath: outputPath,
      prompt: options.prompt,
      model,
      size,
      createdAt: new Date(),
      metadata: {
        quality,
        style,
        simulated: true
      }
    };
  }

  private async generateWithStableDiffusion(options: ImageGenerationOptions, imageId: string): Promise<GeneratedImage> {
    if (!this.apiKeys.stability) {
      throw new Error('Stability AI API key not configured');
    }

    const size = options.size || '512x512';
    const steps = options.steps || 20;
    const guidance = options.guidance || 7.5;
    const seed = options.seed || Math.floor(Math.random() * 1000000);

    // Simulate Stable Diffusion generation
    const simulatedResult = await this.simulateStableDiffusionGeneration(options, imageId);

    // Save simulated image
    const outputPath = path.join(this.outputDir, `${imageId}.png`);
    await this.saveSimulatedImage(outputPath);

    return {
      id: imageId,
      localPath: outputPath,
      prompt: options.prompt,
      model: 'stable-diffusion',
      size,
      createdAt: new Date(),
      metadata: {
        steps,
        guidance,
        seed,
        negativePrompt: options.negativePrompt,
        simulated: true
      }
    };
  }

  private async generateWithMidjourney(options: ImageGenerationOptions, imageId: string): Promise<GeneratedImage> {
    if (!this.apiKeys.midjourney) {
      throw new Error('Midjourney API key not configured');
    }

    // Simulate Midjourney generation
    const simulatedResult = await this.simulateMidjourneyGeneration(options, imageId);

    // Save simulated image
    const outputPath = path.join(this.outputDir, `${imageId}.png`);
    await this.saveSimulatedImage(outputPath);

    return {
      id: imageId,
      localPath: outputPath,
      prompt: options.prompt,
      model: 'midjourney',
      size: options.size || '1024x1024',
      createdAt: new Date(),
      metadata: {
        style: options.style,
        simulated: true
      }
    };
  }

  private async generateWithOpenRouter(options: ImageGenerationOptions, imageId: string): Promise<GeneratedImage> {
    if (!this.apiKeys.openrouter) {
      throw new Error('OpenRouter API key not configured');
    }

    const model = options.model || 'google/gemini-2.0-flash-preview-05-20';
    const aspectRatio = options.aspectRatio || '1:1';
    
    // Map aspect ratio to OpenRouter format
    const aspectRatioMap: Record<string, string> = {
      '1:1': '1:1',
      '2:3': '2:3',
      '3:2': '3:2',
      '3:4': '3:4',
      '4:3': '4:3',
      '4:5': '4:5',
      '5:4': '5:4',
      '9:16': '9:16',
      '16:9': '16:9',
      '21:9': '21:9'
    };

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKeys.openrouter}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://krab.dev',
          'X-OpenRouter-Title': 'Krab'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: options.prompt
            }
          ],
          modalities: ['image', 'text'],
          image_config: {
            aspect_ratio: aspectRatioMap[aspectRatio] || '1:1'
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      
      // Extract image from response
      const message = data.choices?.[0]?.message;
      const images = message?.images || [];
      
      if (images.length === 0) {
        // If no images in response, check for text (some models return text instead)
        const textContent = message?.content || '';
        logger.warn('[ImageGenerator] No images in OpenRouter response, text:', textContent.substring(0, 100));
        throw new Error('No images generated. Model may not support image generation.');
      }

      // Save the generated image
      const imageData = images[0].image_url.url;
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/,);
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      const outputPath = path.join(this.outputDir, `${imageId}.png`);
      fs.writeFileSync(outputPath, imageBuffer);

      return {
        id: imageId,
        localPath: outputPath,
        prompt: options.prompt,
        model: 'openrouter/' + model,
        size: aspectRatio,
        createdAt: new Date(),
        metadata: {
          aspectRatio,
          textResponse: message?.content?.substring(0, 200)
        }
      };

    } catch (error: any) {
      logger.error('[ImageGenerator] OpenRouter generation failed:', error.message);
      throw error;
    }
  }

  async editImage(options: ImageEditOptions): Promise<GeneratedImage> {
    const editId = crypto.randomBytes(8).toString('hex');
    logger.info(`[ImageGenerator] Editing image: ${editId}`);

    try {
      // Check if source image exists
      if (!fs.existsSync(options.imagePath)) {
        throw new Error(`Source image not found: ${options.imagePath}`);
      }

      // In a real implementation, this would call the image editing API
      const simulatedResult = await this.simulateImageEdit(options, editId);

      // Save edited image
      const outputPath = path.join(this.outputDir, `edit-${editId}.png`);
      await this.saveSimulatedImage(outputPath);

      return {
        id: editId,
        localPath: outputPath,
        prompt: options.prompt,
        model: 'dall-e-edit',
        size: options.size || '1024x1024',
        createdAt: new Date(),
        metadata: {
          sourceImage: options.imagePath,
          maskPath: options.maskPath,
          simulated: true
        }
      };

    } catch (error) {
      logger.error(`[ImageGenerator] Image editing failed:`, error);
      throw error;
    }
  }

  async createVariations(options: ImageVariationOptions): Promise<GeneratedImage[]> {
    const variationId = crypto.randomBytes(8).toString('hex');
    logger.info(`[ImageGenerator] Creating variations: ${variationId}`);

    try {
      // Check if source image exists
      if (!fs.existsSync(options.imagePath)) {
        throw new Error(`Source image not found: ${options.imagePath}`);
      }

      const variations: GeneratedImage[] = [];

      // Generate 4 variations
      for (let i = 0; i < 4; i++) {
        const simulatedResult = await this.simulateVariation(options, `${variationId}-${i}`);

        const outputPath = path.join(this.outputDir, `variation-${variationId}-${i}.png`);
        await this.saveSimulatedImage(outputPath);

        variations.push({
          id: `${variationId}-${i}`,
          localPath: outputPath,
          prompt: `Variation ${i + 1} of image`,
          model: 'dall-e-variation',
          size: options.size || '1024x1024',
          createdAt: new Date(),
          metadata: {
            sourceImage: options.imagePath,
            variationIndex: i,
            simulated: true
          }
        });
      }

      return variations;

    } catch (error) {
      logger.error(`[ImageGenerator] Variation creation failed:`, error);
      throw error;
    }
  }

  // Placeholder methods for API simulation
  private async simulateDalleGeneration(options: ImageGenerationOptions, imageId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    return { simulated: true, model: options.model };
  }

  private async simulateStableDiffusionGeneration(options: ImageGenerationOptions, imageId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 4000));
    return { simulated: true, model: 'stable-diffusion' };
  }

  private async simulateMidjourneyGeneration(options: ImageGenerationOptions, imageId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 15000 + Math.random() * 10000)); // Midjourney is slower
    return { simulated: true, model: 'midjourney' };
  }

  private async simulateImageEdit(options: ImageEditOptions, editId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 2500 + Math.random() * 2000));
    return { simulated: true, edit: true };
  }

  private async simulateVariation(options: ImageVariationOptions, variationId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
    return { simulated: true, variation: true };
  }

  private async saveSimulatedImage(outputPath: string): Promise<void> {
    // Create a simple placeholder image (1x1 pixel PNG)
    const placeholderImage = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x18, 0x57, 0x63, 0x60, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    fs.writeFileSync(outputPath, placeholderImage);
  }

  getGeneratedImages(): GeneratedImage[] {
    // In a real implementation, this would read from a database
    // For now, return empty array
    return [];
  }

  deleteImage(imageId: string): boolean {
    // In a real implementation, this would delete from storage
    return false;
  }
}

export { GeneratedImage, ImageGenerationOptions, ImageEditOptions, ImageVariationOptions };
