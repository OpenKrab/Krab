// ============================================================
// 🦀 Krab — Voicecall Command
// ============================================================
import { Command } from "commander";
import pc from "picocolors";

export const voicecallCommand = new Command("voicecall")
  .description("Voice call integration")
  .alias("call")
  .addCommand(
    new Command("status")
      .description("Check voice call status")
      .action(() => {
        console.log(pc.bold("\n📞 Voice Call Status\n"));
        console.log("Status: " + pc.yellow("Not implemented"));
        console.log();
        console.log(pc.dim("Voice call integration is planned for future releases."));
        console.log(pc.dim("Current features:"));
        console.log(pc.dim("  • Text-to-Speech (TTS)"));
        console.log(pc.dim("  • Speech-to-Text (STT)"));
        console.log();
      })
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
      })
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
      })
  );
