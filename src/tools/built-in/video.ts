// ============================================================
// 🦀 Krab — Video Analysis Tool (OpenRouter)
// ============================================================
import { z } from "zod";
import type { ToolDefinition, ToolResult } from "../../core/types.js";
import { logger } from "../../utils/logger.js";
import * as fs from "fs";
import * as path from "path";

export interface VideoAnalysisOptions {
  videoPath: string;
  prompt?: string;
  model?: string;
  provider?: "openrouter" | "google";
  signal?: AbortSignal;
}

export interface VideoAnalysisResult {
  description: string;
  objects?: string[];
  activities?: string[];
  duration?: number;
  model: string;
}

// ── Encode video file to base64 ──────────────────────────────
async function encodeVideoToBase64(videoPath: string): Promise<string> {
  const videoBuffer = fs.readFileSync(videoPath);
  const base64Video = videoBuffer.toString('base64');
  
  // Determine MIME type from extension
  const ext = path.extname(videoPath).toLowerCase();
  const mimeTypeMap: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mpeg': 'video/mpeg',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm'
  };
  const mimeType = mimeTypeMap[ext] || 'video/mp4';
  
  return `data:${mimeType};base64,${base64Video}`;
}

// ── Video Analysis with OpenRouter ──────────────────────────
async function analyzeVideoWithOpenRouter(
  options: VideoAnalysisOptions
): Promise<VideoAnalysisResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.");
  }

  const model = options.model || "google/gemini-2.5-flash";
  const prompt = options.prompt || "Please describe what's happening in this video.";
  
  let videoUrl: string;
  
  // Check if it's a URL or file path
  if (options.videoPath.startsWith('http://') || options.videoPath.startsWith('https://')) {
    videoUrl = options.videoPath;
    logger.info(`[VideoAnalysis] Using video URL: ${videoUrl}`);
  } else {
    // Encode local file to base64
    if (!fs.existsSync(options.videoPath)) {
      throw new Error(`Video file not found: ${options.videoPath}`);
    }
    
    // Check file size (OpenRouter typically has limits)
    const stats = fs.statSync(options.videoPath);
    const maxSize = 100 * 1024 * 1024; // 100MB limit
    if (stats.size > maxSize) {
      throw new Error(`Video file too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB (max: 100MB)`);
    }
    
    logger.info(`[VideoAnalysis] Encoding video to base64: ${options.videoPath}`);
    videoUrl = await encodeVideoToBase64(options.videoPath);
  }

  try {
    logger.info(`[VideoAnalysis] Analyzing video with OpenRouter: ${model}`);
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://krab.dev",
        "X-OpenRouter-Title": "Krab"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "video_url",
                video_url: {
                  url: videoUrl
                }
              }
            ]
          }
        ]
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const description = data.choices?.[0]?.message?.content || "";

    logger.info(`[VideoAnalysis] Analysis completed: ${description.substring(0, 100)}...`);

    return {
      description,
      model,
      duration: undefined // OpenRouter doesn't provide duration
    };

  } catch (error: any) {
    logger.error("[VideoAnalysis] OpenRouter analysis failed:", error.message);
    throw error;
  }
}

// ── Video Analysis Tool Definition ───────────────────────────
export const videoAnalysisTool: ToolDefinition = {
  name: "video_analyze",
  description: "Analyze video files using AI. Supports video summarization, object recognition, activity detection, and scene understanding. Works with local video files (MP4, MOV, WebM) or YouTube URLs (for Gemini models).",
  parameters: z.object({
    videoPath: z.string().describe("Path to local video file or URL (YouTube URLs supported for Gemini)"),
    prompt: z.string().optional().describe("Specific question or instruction about the video (e.g., 'Describe the main events', 'What objects are visible?', 'Summarize this video')"),
    model: z.string().optional().describe("Model to use for analysis (default: google/gemini-2.5-flash)"),
    provider: z.enum(["openrouter", "google"]).optional().describe("Provider to use (default: openrouter)")
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      logger.info("[VideoTool] Starting video analysis:", args.videoPath);

      const options: VideoAnalysisOptions = {
        videoPath: args.videoPath,
        prompt: args.prompt,
        model: args.model,
        provider: args.provider || "openrouter"
      };

      let result: VideoAnalysisResult;

      switch (options.provider) {
        case "openrouter":
          result = await analyzeVideoWithOpenRouter(options);
          break;

        default:
          result = await analyzeVideoWithOpenRouter(options);
      }

      return {
        success: true,
        output: JSON.stringify({
          description: result.description,
          model: result.model,
          prompt: options.prompt
        }, null, 2)
      };

    } catch (error) {
      logger.error("[VideoTool] Analysis failed:", error);
      return {
        success: false,
        output: "",
        error: `Error analyzing video: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// ── Video Summarization Tool ─────────────────────────────────
export const videoSummarizeTool: ToolDefinition = {
  name: "video_summarize",
  description: "Generate a concise summary of a video file. Extracts key events, main topics, and important moments.",
  parameters: z.object({
    videoPath: z.string().describe("Path to local video file or URL"),
    maxLength: z.number().optional().describe("Maximum summary length in sentences (default: 5)"),
    model: z.string().optional().describe("Model to use (default: google/gemini-2.5-flash)")
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const maxLength = args.maxLength || 5;
      const prompt = `Please provide a concise summary of this video in ${maxLength} sentences or less. Focus on the main events and key information.`;

      const options: VideoAnalysisOptions = {
        videoPath: args.videoPath,
        prompt,
        model: args.model,
        provider: "openrouter"
      };

      const result = await analyzeVideoWithOpenRouter(options);

      return {
        success: true,
        output: result.description
      };

    } catch (error) {
      logger.error("[VideoTool] Summarization failed:", error);
      return {
        success: false,
        output: "",
        error: `Error summarizing video: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// ── Export video tools collection ────────────────────────────
export const videoTools = [
  videoAnalysisTool,
  videoSummarizeTool
];
