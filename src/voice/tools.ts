// ============================================================
// 🦀 Krab — Voice Tools for Agent
// ============================================================
import { ToolDefinition as Tool } from "../core/types.js";
import { logger } from "../utils/logger.js";
import { createSTT, SpeechToText, STTResult } from "./stt.js";
import { createTTS, TextToSpeech, TTSResult } from "./tts.js";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";

// Global voice instances
let sttInstance: SpeechToText | null = null;
let ttsInstance: TextToSpeech | null = null;

async function getSTTInstance(): Promise<SpeechToText> {
  if (!sttInstance) {
    // Use OpenRouter if API key is available, otherwise use OpenAI
    const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
    sttInstance = createSTT({
      provider: useOpenRouter ? "openrouter" : "openai",
      model: useOpenRouter ? "google/gemini-2.5-flash" : "whisper-1",
      language: "th"
    });
    await sttInstance.initialize();
  }
  return sttInstance;
}

async function getTTSInstance(): Promise<TextToSpeech> {
  if (!ttsInstance) {
    // Use OpenRouter if API key is available, otherwise use OpenAI
    const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
    ttsInstance = createTTS({
      provider: useOpenRouter ? "openrouter" : "openai",
      voice: "alloy",
      model: useOpenRouter ? "openai/gpt-4o-audio-preview" : "tts-1",
      outputFormat: "mp3"
    });
    await ttsInstance.initialize();
  }
  return ttsInstance;
}

// ── Voice Transcription Tool ────────────────────────────────────
export const voiceTranscribeTool: Tool = {
  name: "voice_transcribe",
  description: "Transcribe audio file to text using speech-to-text. Supports various audio formats and languages.",
  inputSchema: {
    type: "object",
    properties: {
      audioPath: {
        type: "string",
        description: "Path to audio file or URL to transcribe"
      },
      language: {
        type: "string",
        description: "Language code (e.g., 'th', 'en', 'ja')",
        default: "th"
      },
      provider: {
        type: "string",
        enum: ["openai", "whisper-api", "openrouter"],
        description: "STT provider to use",
        default: "openai"
      }
    },
    required: ["audioPath"]
  },

  async execute(args: any): Promise<ToolResult> {
    try {
      logger.info("[VoiceTool] Starting transcription:", args);

      const stt = await getSTTInstance();

      // Update options if provided
      if (args.language) {
        stt.updateOptions({ language: args.language });
      }
      if (args.provider) {
        stt.updateOptions({ provider: args.provider as any });
      }

      let result: STTResult;

      // Check if it's a URL or file path
      if (args.audioPath.startsWith('http://') || args.audioPath.startsWith('https://')) {
        result = await stt.transcribeAudioUrl(args.audioPath);
      } else {
        result = await stt.transcribeAudio(args.audioPath);
      }

      const response = {
        text: result.text,
        language: result.language,
        confidence: result.confidence,
        duration: result.duration,
        segments: result.segments?.slice(0, 5) // Limit segments for response
      };

      logger.info("[VoiceTool] Transcription completed");
      return {
        success: true,
        output: JSON.stringify(response, null, 2)
      };

    } catch (error) {
      logger.error("[VoiceTool] Transcription failed:", error);
      return {
        success: false,
        output: "",
        error: `Error transcribing audio: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// ── Voice Synthesis Tool ───────────────────────────────────────
export const voiceSynthesizeTool: Tool = {
  name: "voice_synthesize",
  description: "Convert text to speech audio. Supports multiple voices and formats.",
  inputSchema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "Text to convert to speech"
      },
      voice: {
        type: "string",
        description: "Voice to use (alloy, echo, fable, onyx, nova, shimmer)",
        default: "alloy"
      },
      speed: {
        type: "number",
        description: "Speech speed (0.5-2.0)",
        minimum: 0.5,
        maximum: 2.0,
        default: 1.0
      },
      outputFormat: {
        type: "string",
        enum: ["mp3", "wav", "flac", "aac"],
        description: "Audio output format",
        default: "mp3"
      },
      provider: {
        type: "string",
        enum: ["openai", "edge-tts", "openrouter"],
        description: "TTS provider to use",
        default: "openai"
      },
      saveToFile: {
        type: "string",
        description: "Optional: Save audio to file path"
      }
    },
    required: ["text"]
  },

  async execute(args: any): Promise<ToolResult> {
    try {
      logger.info("[VoiceTool] Starting speech synthesis:", args.text.substring(0, 50));

      const tts = await getTTSInstance();

      // Update options if provided
      const options: any = {};
      if (args.voice) options.voice = args.voice;
      if (args.speed) options.speed = args.speed;
      if (args.outputFormat) options.outputFormat = args.outputFormat;
      if (args.provider) options.provider = args.provider;
      tts.updateOptions(options);

      let result: TTSResult;
      if (args.saveToFile) {
        result = await tts.synthesizeToFile(args.text, args.saveToFile, options);
        return {
          success: true,
          output: `Audio saved to: ${result.filePath}\nDuration: ${result.duration?.toFixed(1)}s\nContent-Type: ${result.contentType}`
        };
      } else {
        result = await tts.synthesizeSpeech(args.text, options);
        return {
          success: true,
          output: `Speech synthesized successfully\nDuration: ${result.duration?.toFixed(1)}s\nContent-Type: ${result.contentType}\nAudio size: ${result.audioData.length} bytes`
        };
      }

    } catch (error) {
      logger.error("[VoiceTool] Speech synthesis failed:", error);
      return {
        success: false,
        output: "",
        error: `Error synthesizing speech: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// ── Voice Analysis Tool ────────────────────────────────────────
export const voiceAnalyzeTool: Tool = {
  name: "voice_analyze",
  description: "Analyze audio file for voice characteristics, language detection, and quality metrics.",
  inputSchema: {
    type: "object",
    properties: {
      audioPath: {
        type: "string",
        description: "Path to audio file to analyze"
      }
    },
    required: ["audioPath"]
  },

  async execute(args: any): Promise<ToolResult> {
    try {
      logger.info("[VoiceTool] Starting voice analysis:", args.audioPath);

      const stt = await getSTTInstance();

      // Use verbose format to get detailed analysis
      stt.updateOptions({
        responseFormat: "verbose_json",
        language: undefined // Auto-detect
      });

      const result = await stt.transcribeAudio(args.audioPath);

      const analysis = {
        detectedLanguage: result.language,
        confidence: result.confidence,
        duration: result.duration,
        wordCount: result.text ? result.text.split(' ').length : 0,
        segmentCount: result.segments?.length || 0,
        averageConfidence: result.segments ?
          result.segments.reduce((sum, seg) => sum + (seg.confidence || 0), 0) / result.segments.length : 0
      };

      logger.info("[VoiceTool] Voice analysis completed");
      return {
        success: true,
        output: JSON.stringify(analysis, null, 2)
      };

    } catch (error) {
      logger.error("[VoiceTool] Voice analysis failed:", error);
      return {
        success: false,
        output: "",
        error: `Error analyzing voice: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// ── Voice Conversation Tool ────────────────────────────────────
export const voiceConversationTool: Tool = {
  name: "voice_conversation",
  description: "Have a voice conversation by transcribing user audio and responding with synthesized speech.",
  inputSchema: {
    type: "object",
    properties: {
      audioPath: {
        type: "string",
        description: "Path to user's voice input audio"
      },
      conversationId: {
        type: "string",
        description: "Conversation ID for context",
        default: "voice_conversation"
      },
      voice: {
        type: "string",
        description: "Voice for response (alloy, echo, fable, onyx, nova, shimmer)",
        default: "alloy"
      },
      saveResponse: {
        type: "string",
        description: "Optional: Save response audio to file path"
      }
    },
    required: ["audioPath"]
  },

  async execute(args: any): Promise<ToolResult> {
    try {
      logger.info("[VoiceTool] Starting voice conversation");

      // Step 1: Transcribe user input
      const stt = await getSTTInstance();
      const transcription = await stt.transcribeAudio(args.audioPath);

      logger.info(`[VoiceTool] User said: ${transcription.text}`);

      // Step 2: Generate AI response (simplified - in real implementation would use Agent)
      const userInput = transcription.text;
      let aiResponse = "";

      // Simple response logic (would be replaced with actual Agent call)
      if (userInput.toLowerCase().includes("สวัสดี") || userInput.toLowerCase().includes("hello")) {
        aiResponse = "สวัสดีครับ! มีอะไรให้ช่วยเหลือไหมครับ?";
      } else if (userInput.toLowerCase().includes("ขอบคุณ") || userInput.toLowerCase().includes("thank")) {
        aiResponse = "ยินดีครับ! ถ้ามีอะไรให้ช่วยอีก สามารถบอกได้เลยนะครับ";
      } else {
        aiResponse = `คุณพูดว่า: "${userInput}". ผมเข้าใจแล้วครับ. มีอะไรให้ช่วยเพิ่มเติมไหมครับ?`;
      }

      // Step 3: Synthesize response to speech
      const tts = await getTTSInstance();
      tts.updateOptions({ voice: args.voice });

      let result: TTSResult;
      if (args.saveResponse) {
        result = await tts.synthesizeToFile(aiResponse, args.saveResponse);
      } else {
        result = await tts.synthesizeSpeech(aiResponse);
      }

      const response = {
        userTranscription: transcription.text,
        aiResponse: aiResponse,
        audioDuration: result.duration,
        audioSize: result.audioData.length,
        savedTo: result.filePath || null
      };

      logger.info("[VoiceTool] Voice conversation completed");
      return {
        success: true,
        output: JSON.stringify(response, null, 2)
      };

    } catch (error) {
      logger.error("[VoiceTool] Voice conversation failed:", error);
      return {
        success: false,
        output: "",
        error: `Error in voice conversation: ${(error as Error).message}`
      };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// ── Voice Tools Collection ─────────────────────────────────────
export const voiceTools = [
  voiceTranscribeTool,
  voiceSynthesizeTool,
  voiceAnalyzeTool,
  voiceConversationTool
];

// ── Voice Manager ─────────────────────────────────────────────
export class VoiceManager {
  private stt: SpeechToText;
  private tts: TextToSpeech;

  constructor(options: {
    stt?: any;
    tts?: any;
  } = {}) {
    this.stt = options.stt || createSTT();
    this.tts = options.tts || createTTS();
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.stt.initialize(),
      this.tts.initialize()
    ]);
    logger.info("[VoiceManager] Initialized");
  }

  async transcribeAudio(audioPath: string): Promise<STTResult> {
    return await this.stt.transcribeAudio(audioPath);
  }

  async transcribeAudioBuffer(audioBuffer: Buffer, filename: string = "audio.wav"): Promise<STTResult> {
    return await this.stt.transcribeAudioBuffer(audioBuffer, filename);
  }

  async transcribeAudioUrl(audioUrl: string): Promise<STTResult> {
    return await this.stt.transcribeAudioUrl(audioUrl);
  }

  async synthesizeSpeech(text: string): Promise<TTSResult> {
    return await this.tts.synthesizeSpeech(text);
  }

  async voiceConversation(audioPath: string, options?: {
    voice?: string;
    saveResponse?: string;
  }): Promise<{
    transcription: string;
    response: string;
    audioResult: TTSResult;
  }> {
    // Transcribe
    const transcription = await this.stt.transcribeAudio(audioPath);

    // Generate simple response (would use Agent in real implementation)
    const response = `คุณพูดว่า: "${transcription.text}". ผมเข้าใจแล้วครับ!`;

    // Synthesize response
    if (options?.voice) {
      this.tts.updateOptions({ voice: options.voice });
    }

    const audioResult = options?.saveResponse
      ? await this.tts.synthesizeToFile(response, options.saveResponse)
      : await this.tts.synthesizeSpeech(response);

    return {
      transcription: transcription.text,
      response,
      audioResult
    };
  }

  updateSTTOptions(options: any): void {
    this.stt.updateOptions(options);
  }

  updateTTSOptions(options: any): void {
    this.tts.updateOptions(options);
  }
}

// Factory function
export function createVoiceManager(options?: { stt?: any; tts?: any }): VoiceManager {
  return new VoiceManager(options);
}

// Export for dynamic loading
export default VoiceManager;
