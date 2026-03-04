// ============================================================
// 🦀 Krab — Voice Features Test Script
// ============================================================
import { createVoiceManager } from "../voice/tools.js";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger.js";

async function testVoiceFeatures() {
  console.log("🦀 Testing Krab Voice Features...\n");

  try {
    // Initialize voice manager
    const voiceManager = createVoiceManager();
    await voiceManager.initialize();
    console.log("✅ Voice manager initialized\n");

    // Test TTS (Text-to-Speech)
    console.log("🎤 Testing Text-to-Speech...");
    const testText = "สวัสดีครับ! นี่คือการทดสอบระบบเสียงของ Krab";
    const ttsResult = await voiceManager.synthesizeSpeech(testText);

    console.log(`✅ TTS completed:`);
    console.log(`   Text: "${testText}"`);
    console.log(`   Audio size: ${ttsResult.audioData.length} bytes`);
    console.log(`   Content-Type: ${ttsResult.contentType}`);
    console.log(`   Duration: ${ttsResult.duration?.toFixed(1)}s\n`);

    // Save TTS output for verification
    const outputDir = path.join(process.cwd(), "test-output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const ttsFile = path.join(outputDir, "test_tts_output.mp3");
    fs.writeFileSync(ttsFile, ttsResult.audioData);
    console.log(`✅ TTS audio saved to: ${ttsFile}\n`);

    // Test STT (Speech-to-Text) if we have the TTS audio file
    console.log("🎧 Testing Speech-to-Text...");
    try {
      const sttResult = await voiceManager.transcribeAudio(ttsFile);

      console.log(`✅ STT completed:`);
      console.log(`   Original text: "${testText}"`);
      console.log(`   Transcribed: "${sttResult.text}"`);
      console.log(`   Language: ${sttResult.language}`);
      console.log(`   Confidence: ${sttResult.confidence?.toFixed(3)}`);
      console.log(`   Duration: ${sttResult.duration?.toFixed(1)}s\n`);

    } catch (sttError) {
      console.log(`⚠️  STT test skipped (API key may not be configured): ${(sttError as Error).message}\n`);
    }

    // Test voice conversation simulation
    console.log("💬 Testing Voice Conversation...");
    try {
      const conversationResult = await voiceManager.voiceConversation(
        ttsFile, // Use our generated audio as input
        {
          voice: "alloy",
          saveResponse: path.join(outputDir, "test_conversation_response.mp3")
        }
      );

      console.log(`✅ Voice conversation completed:`);
      console.log(`   Input transcription: "${conversationResult.transcription}"`);
      console.log(`   AI Response: "${conversationResult.response}"`);
      console.log(`   Response audio saved to: ${conversationResult.audioResult.filePath}`);
      console.log(`   Response duration: ${conversationResult.audioResult.duration?.toFixed(1)}s\n`);

    } catch (conversationError) {
      console.log(`⚠️  Voice conversation test failed: ${(conversationError as Error).message}\n`);
    }

    console.log("🎉 Voice Features Test Completed!");
    console.log("📁 Test outputs saved in: test-output/");

  } catch (error) {
    console.error("❌ Voice Features Test Failed:", error);
    process.exit(1);
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testVoiceFeatures();
}

export { testVoiceFeatures };
