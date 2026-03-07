// ============================================================
// 🦀 Krab — Voicecall Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";

function hasAnyKey(keys: string[]): boolean {
  return keys.some((k) => Boolean(process.env[k]));
}

async function detectTtsEngine(): Promise<string> {
  try {
    await import("edge-tts");
    return "edge-tts";
  } catch {
    return "unavailable";
  }
}

function detectSttProvider(): string {
  if (hasAnyKey(["OPENAI_API_KEY"])) return "openai-whisper";
  if (hasAnyKey(["GOOGLE_API_KEY", "GEMINI_API_KEY"])) return "google";
  return "unconfigured";
}

export const voicecallCommand = new Command("voicecall")
  .description("Voice call integration")
  .alias("call")
  .addCommand(
    new Command("status")
      .description("Check voice call status")
      .action(async () => {
        const ttsEngine = await detectTtsEngine();
        const sttProvider = detectSttProvider();
        const ttsReady = ttsEngine !== "unavailable";
        const sttReady = sttProvider !== "unconfigured";

        console.log(pc.bold("\n📞 Voice Call Status\n"));
        console.log(`Transport: ${pc.yellow("planned")}`);
        console.log(`TTS: ${ttsReady ? pc.green("ready") : pc.red("missing")} (${ttsEngine})`);
        console.log(
          `STT: ${sttReady ? pc.green("ready") : pc.red("missing")} (${sttProvider})`,
        );
        console.log(
          `Overall: ${ttsReady && sttReady ? pc.green("partially ready") : pc.yellow("setup required")}`,
        );
        console.log();

        if (!ttsReady || !sttReady) {
          console.log(pc.dim("Setup hints:"));
          if (!ttsReady) {
            console.log(pc.dim("  • Install dependency: edge-tts"));
          }
          if (!sttReady) {
            console.log(pc.dim("  • Set OPENAI_API_KEY or GOOGLE_API_KEY/GEMINI_API_KEY"));
          }
          console.log();
        }
      }),
  )
  .addCommand(
    new Command("tts")
      .description("Text-to-Speech (convert text to audio)")
      .argument("<text>", "Text to convert")
      .option("-o, --output <path>", "Output file path")
      .option("--voice <voice>", "Voice to use", "alloy")
      .action(async (text, options) => {
        console.log(pc.bold("\n🔊 Text-to-Speech\n"));
        console.log(`Text: ${text}`);
        console.log(`Voice: ${options.voice}`);

        if (options.output) {
          console.log(`Output: ${options.output}`);
        }

        console.log(pc.yellow("\n⚠️  Use voice_synthesize tool instead:"));
        console.log(pc.dim(`  krab ask "Convert to speech: ${text}"`));
        console.log();
      }),
  )
  .addCommand(
    new Command("stt")
      .description("Speech-to-Text (transcribe audio)")
      .argument("<audio-file>", "Audio file to transcribe")
      .option("--language <lang>", "Language code", "th")
      .action(async (audioFile, options) => {
        console.log(pc.bold("\n🎤 Speech-to-Text\n"));
        console.log(`File: ${audioFile}`);
        console.log(`Language: ${options.language}`);

        console.log(pc.yellow("\n⚠️  Use voice_transcribe tool instead:"));
        console.log(pc.dim(`  krab ask "Transcribe audio at ${audioFile}"`));
        console.log();
      }),
  );
