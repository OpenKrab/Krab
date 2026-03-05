// ============================================================
// 🦀 Krab — Interactive Chat TUI
// ============================================================
import * as p from "@clack/prompts";
import pc from "picocolors";
import { Agent } from "../core/agent.js";
import { loadConfig } from "../core/config.js";
import { createInterface } from "readline";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export async function runChat() {
  console.clear();
  
  // Load config
  let config;
  try {
    config = loadConfig();
  } catch (err: any) {
    p.outro(pc.red(`❌ ไม่พบการตั้งค่า: ${err.message}`));
    console.log(pc.dim("\nรัน wizard เพื่อตั้งค่า:"));
    console.log(pc.cyan("  npm run dev -- wizard"));
    return;
  }
  
  const agent = new Agent(config);
  const messages: ChatMessage[] = [];
  
  // Header
  console.log(pc.bold(" 🦀 Krab Chat "));
  console.log(pc.dim(`Provider: ${config.provider.name} | Model: ${config.provider.model}`));
  console.log(pc.dim("คำสั่ง: /exit = ออก, /clear = ล้าง, /help = ช่วยเหลือ\n"));
  
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const askQuestion = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(pc.cyan("You: "), (answer) => {
        resolve(answer);
      });
    });
  };
  
  // Chat loop
  while (true) {
    const input = await askQuestion();
    
    // Handle commands
    if (input.startsWith("/")) {
      const command = input.slice(1).toLowerCase();
      
      switch (command) {
        case "exit":
        case "quit":
        case "q":
          console.log(pc.dim("\n👋 ลาก่อน!"));
          rl.close();
          return;
          
        case "clear":
        case "cls":
          console.clear();
          console.log(pc.bold(" 🦀 Krab Chat "));
          console.log(pc.dim(`Provider: ${config.provider.name} | Model: ${config.provider.model}\n`));
          messages.length = 0;
          continue;
          
        case "help":
        case "?":
          console.log(pc.dim("\nคำสั่ง:"));
          console.log("  /exit, /quit, /q  — ออกจาก chat");
          console.log("  /clear, /cls      — ล้างหน้าจอ");
          console.log("  /help, /?         — แสดงความช่วยเหลือ");
          console.log("  /model            — ดูโมเดลที่ใช้");
          console.log("  /memory           — ดูสถิติ memory\n");
          continue;
          
        case "model":
          console.log(pc.dim(`\nProvider: ${config.provider.name}`));
          console.log(pc.dim(`Model: ${config.provider.model}\n`));
          continue;
          
        case "memory":
          const stats = agent.getMemoryStats();
          console.log(pc.dim(`\nMemory: ${stats.total} messages`));
          console.log(pc.dim(`Limit: ${stats.limit}\n`));
          continue;
          
        default:
          console.log(pc.yellow(`\n❓ ไม่รู้จำคำสั่ง: /${command}`));
          console.log(pc.dim("พิมพ์ /help เพื่อดูคำสั่งทั้งหมด\n"));
          continue;
      }
    }
    
    // Skip empty messages
    if (!input.trim()) continue;
    
    // Add user message
    messages.push({
      role: "user",
      content: input,
      timestamp: new Date(),
    });
    
    // Show thinking indicator
    process.stdout.write(pc.dim("🤔 กำลังคิด..."));
    
    try {
      // Get response from agent
      const response = await agent.chat(input);
      
      // Clear thinking indicator
      process.stdout.write("\r" + " ".repeat(20) + "\r");
      
      // Print response
      console.log(pc.green("Krab: ") + response + "\n");
      
      // Add to history
      messages.push({
        role: "assistant",
        content: response,
        timestamp: new Date(),
      });
      
    } catch (err: any) {
      process.stdout.write("\r" + " ".repeat(20) + "\r");
      console.log(pc.red("❌ Error: ") + err.message + "\n");
    }
  }
  
  rl.close();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runChat().catch(console.error);
}
