# 🦀 Krab — Lightweight AGI Agent Framework

> Inspired by OpenClaw. Built lighter, smarter, and ours.

---

## 🎯 Vision

Krab เป็น AI Agent Framework ที่ออกแบบมาให้เบา เข้าใจง่าย
แต่มีความสามารถระดับ AGI — คิดเอง วางแผนเอง จำได้ เรียนรู้ได้

**💎 Unique Selling Proposition (USP):**

- **Lightweight & TS-native**: < 50 files, zero unnecessary abstractions. "Krab — the lighter, smarter cousin of Claw".
- **MCP-first**: Native Client/Server support (stdio & WebSocket/HTTP).
- **Local SQLite Foundation**: Hybrid retrieval (Keyword + Vector) using **sqlite-vec**.
- **AGI Behaviors**: ReAct loop + Reflection + Trigger-based summarization.
- **Agent Interoperability**: สามารถสั่ง Krab ผ่าน Claude Code, Gemini, หรือ Agent ตัวอื่น ๆ ได้ผ่าน MCP.

---

| Component        | Technology (Maret 2026 Update) |
| ---------------- | ------------------------------ |
| Language         | TypeScript (Node.js ≥ 22)      |
| Package Manager  | pnpm                           |
| LLM SDK          | **Vercel AI SDK (`ai`)** v4+   |
| MCP              | **Official MCP SDK** (@modelcontextprotocol/sdk) |
| Vector DB        | SQLite + sqlite-vec            |
| Embeddings       | **nomic-embed-text-v2** (MoE)  |
| Browser          | **Stagehand** (AI-native)      |
| Observability    | Vercel AI Tracing + OTel       |
| Server/App       | **Hono** / commander           |
| Logging          | tslog                          |

---

## 📁 Project Structure

```
krab/
├── package.json
├── tsconfig.json
├── .env.example              # API keys template
├── .env                      # API keys (gitignored)
│
├── src/
│   ├── index.ts              # Entry point
│   ├── cli.ts                # CLI commands (commander)
│   │
│   ├── core/
│   │   ├── agent.ts          # Main Agent loop (think → plan → act → reflect)
│   │   ├── types.ts          # Shared types/interfaces
│   │   └── config.ts         # Configuration loader
│   │
│   ├── providers/
│   │   ├── base.ts           # BaseProvider interface
│   │   ├── openai-compat.ts  # Unified OpenAI-compatible client
│   │   ├── gemini.ts         # Google Gemini (JSON mode optimization)
│   │   ├── anthropic.ts      # Anthropic Claude (**Prompt Caching support**)
│   │   └── base-client.ts    # Reusable openai package wrapper
│   │
│   ├── memory/
│   │   ├── conversation.ts   # Short-term: current session history
│   │   ├── long-term.ts      # Long-term: vector search (RAG)
│   │   └── store.ts          # SQLite persistence layer
│   │
│   ├── tools/
│   │   ├── registry.ts       # Tool registration system
│   │   ├── executor.ts       # Tool execution engine
│   │   └── built-in/
│   │       ├── datetime.ts   # Get current date/time
│   │       ├── search.ts     # Web Search (Tavily / Firecrawl)
│   │       ├── file-ops.ts   # Smart File Ops (Read PDF, Summarize)
│   │       ├── obsidian.ts   # Obsidian Vault tools (read, write, search)
│   │       ├── shell.ts      # Execute shell commands (Secure)
│   │       └── browser.ts    # Browser automation tool
│   │
│   ├── browser/
│   │   ├── session.ts        # Browser session manager (Playwright)
│   │   ├── stealth.ts        # **Stealth mode & User-agent rotation**
│   │   ├── actions.ts        # Core actions: navigate, click, type, scroll
│   │   ├── snapshot.ts       # Page snapshot: screenshot + DOM extraction
│   │   └── config.ts         # Browser launch options
│   │
│   ├── channels/
│   │   ├── base.ts           # BaseChannel interface
│   │   ├── cli.ts            # Terminal/CLI channel
│   │   ├── telegram.ts       # Telegram bot (Phase 3)
│   │   └── line.ts           # LINE bot (Phase 3)
│   │
│   ├── agents/
│   │   ├── planner.ts        # Planning sub-agent
│   │   ├── reflector.ts      # Self-reflection sub-agent
│   │   └── spawner.ts        # Sub-agent spawning system
│   │
│   └── utils/
│       ├── logger.ts         # Logging setup
│       ├── env.ts            # Environment variable helpers
│       └── stream.ts         # Streaming response helpers
│
│   ├── sandbox/
│   │   ├── code-runner.ts    # Code interpreter (run JS/Python safely)
│   │   └── docker.ts         # Docker sandbox for unsafe code
│   │
│   ├── computer/
│   │   ├── desktop.ts        # Desktop control (mouse, keyboard, screenshot)
│   │   └── vision.ts         # Screen analysis via LLM Vision
│   │
│   ├── voice/
│   │   ├── tts.ts            # Text-to-Speech (Edge-TTS)
│   │   └── stt.ts            # Speech-to-Text (Whisper)
│   │
│   ├── scheduler/
│   │   └── cron.ts           # Scheduled/repeating tasks
│   │
│   └── mcp/
│       ├── client.ts         # MCP client (connect to MCP servers)
│       └── server.ts         # MCP server (expose tools to other agents)
│
├── skills/                   # User-defined skills (like plugins)
│   └── example-skill/
│       ├── skill.json        # Skill metadata
│       └── index.ts          # Skill implementation
│
├── data/                     # Runtime data (gitignored)
│   ├── memory.db             # SQLite database
│   └── sessions/             # Session history files
│
└── test/
    ├── agent.test.ts
    ├── providers/
    └── tools/
```

---

## 🔑 API Keys Required

### Phase 1 (MVP) — ต้องมีอย่างน้อย 1 อัน

```env
# .env.example

# === LLM Provider (เลือกอย่างน้อย 1 ตัว) ===

# Google Gemini (ฟรี — แนะนำสำหรับเริ่มต้น)
GEMINI_API_KEY=

# OpenAI
OPENAI_API_KEY=

# Anthropic Claude
ANTHROPIC_API_KEY=

# DeepSeek (ราคาถูก)
DEEPSEEK_API_KEY=

# KiloCode (มีโมเดลฟรี: stepfun/step-3.5-flash:free)
KILOCODE_API_KEY=

# OpenCode Zen (มีโมเดลฟรี: big-pickle, minimax-m2.5-free)
OPENCODE_API_KEY=

# OpenRouter (มีโมเดลฟรีหลายตัว เช่น openrouter/free)
OPENROUTER_API_KEY=

# Ollama (local — ไม่ต้องใช้ key)
OLLAMA_BASE_URL=http://localhost:11434

# === Messaging Channels (Phase 3) ===

# Telegram
TELEGRAM_BOT_TOKEN=

# LINE
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=

# === Knowledge Base ===

# Obsidian Vault Path (Absolute path)
OBSIDIAN_VAULT_PATH=
```

---

## 📋 Implementation Phases

### Phase 1: Foundation (MVP) ⏱️ ~1-2 วัน ✅ COMPLETE

**เป้าหมาย**: Agent ที่คุยได้ผ่าน Terminal + เรียกใช้ Tool ได้ (ReAct Loop)

- [x] Initialize project (pnpm, TypeScript, tsconfig)
- [x] สร้าง Unified Provider System (รองรับ 8 providers)
  - Google Gemini, Anthropic Claude, OpenAI
  - KiloCode (with free tier support)
  - OpenCode Zen (with free models: big-pickle, minimax-m2.5-free)
  - OpenRouter (with free tier: openrouter/free, arcee-ai/trinity)
  - DeepSeek, Ollama (local)
- [x] สร้าง Agent Core พร้อม **ReAct Loop** (Thought → Action → Observation)
- [x] สร้าง Tool Registry + built-in tools (datetime, shell, web_search, file ops)
- [x] สร้าง CLI Channel (interactive terminal)
- [x] สร้าง `.env` configuration system with auto-detection
- [x] สร้าง **TUI Wizard** แบบ OpenClaw (6 ขั้นตอน):
  - ✅ Select Language (ไทย/English) — ก่อนใช้งาน
  - ✅ Detect existing config (Keep/Modify/Reset)
  - ✅ Select provider (พร้อม emoji 🌍🤖🧠⚡🚀🌐💰🏠)
  - ✅ Enter API key (หรือใช้ env ที่มีอยู่)
  - ✅ Select model (แสดงโมเดลทั้งหมดจาก API/cache)
  - ✅ Save configuration
- [x] สร้าง **Conversation Memory** (session history) — จัดเก็บประวัติการสนทนา
- [x] สร้าง **Gateway Server** (OpenClaw-inspired) — HTTP APIs + WebSocket
- [x] สร้าง **Long-term Memory** พร้อม Vector Search (sqlite-vec + nomic-embed-text)
- [x] สร้าง **Reflector** (agent ตรวจสอบคำตอบตัวเอง)

### Phase 2: Intelligence (AGI Layer) ✅ COMPLETED

**เป้าหมาย**: Agent ที่ฉลาดขึ้น — คิดก่อนทำ จำได้ข้ามเซสชัน ท่องเว็บได้

- [x] สร้าง Conversation Memory (session history) — จัดเก็บประวัติการสนทนา
- [x] สร้าง **Gateway Server** (OpenClaw-inspired) — HTTP APIs + WebSocket
- [x] สร้าง Long-term Memory พร้อม Vector Search (**sqlite-vec** + **nomic-embed-text**)
- [x] สร้าง **Reflector** (agent ตรวจสอบคำตอบตัวเอง)
- [x] สร้าง **Planner Agent** (วางแผนก่อนลงมือทำ)
- [x] สร้าง **MCP Client** (เชื่อมต่อ MCP Servers อื่น ๆ)
- [x] สร้าง **MCP Server** (เปิดให้ Claude Code/Gemini เรียกใช้ Krab เป็น Tool)
- [x] เพิ่ม built-in tools: **Tavily/Firecrawl** search, Git integration
- [x] **Obsidian Integration**: เชื่อมต่อสมองส่วนกลาง (Read/Write/Search vault)
- [x] สร้าง Skill system (user-defined plugins)
- [x] 🌐 **Browser Agent**
  - [x] สร้าง Browser session manager (Playwright)
  - [x] สร้าง Browser tools: navigate, click, type, scroll, screenshot
  - [x] สร้าง DOM snapshot + content extraction (อ่านเนื้อหาเว็บ)
  - [x] สร้าง Browser AI vision (ส่ง screenshot ให้ LLM วิเคราะห์)
  - [x] Form auto-fill (กรอกฟอร์มอัตโนมัติ)
  - [x] Multi-tab management

### Phase 3: Channels (Messaging) ⏱️ ~2-3 วัน ✅ COMPLETE

**เป้าหมาย**: Agent ตอบแชทบน Telegram / LINE ได้

- [x] สร้าง `BaseChannel` interface พร้อม multi-modal support
- [x] สร้าง Telegram Bot Channel (Bot API, webhooks, media handling)
- [x] สร้าง LINE Channel (Messaging API, webhooks, signature verification)
- [x] สร้าง WhatsApp Channel (Baileys, QR pairing, session persistence)
- [x] สร้าง Discord Channel (Discord.js, guilds, rich embeds)
- [x] สร้าง Webhook Server (Express, multi-channel routing, health checks)
- [x] สร้าง Multi-modal Support (Images, Audio, Video, Files)
- [x] สร้าง Message Persistence & State Management ข้าม Channels
- [x] สร้าง Channel Registry (dynamic loading, configuration validation)
- [x] สร้าง Web UI (Control Panel) สำหรับ Channel management
- [ ] สร้าง Slack Channel (Workspace apps) - Future enhancement

### Phase 4: Polish & Deploy ⏱️ ~3-5 วัน ✅ COMPLETE

**เป้าหมาย**: ทำให้ Krab พร้อมใช้งานจริง 100%

- [x] สร้าง Docker deployment สำหรับ Krab (multi-stage build, health checks, docker-compose)
- [x] สร้าง Railway deployment สำหรับ Krab (railway.json, auto-deploy, monitoring)
- [x] สร้าง Render deployment สำหรับ Krab (render.yaml, SSL, scaling)
- [x] สร้าง VPS deployment guide สำหรับ Krab (Ubuntu 22.04, security, monitoring, backups)
- [x] สร้าง `npx krab` one-command install (interactive wizard, multi-platform)
- [x] เพิ่ม `AnthropicProvider` สำหรับ prompt caching
- [x] สร้าง Web UI (Control Panel) สำหรับ Channel management
- [x] Docker deployment
- [x] `npx krab` one-command install
- [x] Documentation สำหรับทุก deployment method
- [x] GitHub release preparation

### Phase 5: Advanced AGI ⏱️ ~4-6 สัปดาห์

**เป้าหมาย**: Agent ที่ทำได้แทบคนจริง ๆ พร้อม Computer Use, Voice, และ Advanced Features

#### 🎯 **Core Advanced Features:**

- [x] 🖥️ **Computer Use** (Desktop Control)
  - [x] สร้าง Computer interface (`src/computer/`) พร้อม screenshot capabilities
  - [x] Implement mouse/keyboard control (pyautogui/robotjs)
  - [x] สร้าง Vision-based action recognition
  - [x] เพิ่ม Computer tool ใน registry
  - [x] Test integration กับ Agent loop

- [x] 💻 **Code Interpreter** (Safe Code Execution)
  - [x] สร้าง Code Runner (`src/sandbox/code-interpreter.ts`)
  - [x] Implement JavaScript/Python execution in isolated context
  - [x] เพิ่ม Docker sandbox สำหรับ unsafe code
  - [x] สร้าง Code Interpreter tool
  - [x] Add syntax highlighting และ error parsing

- [x] 🎙️ **Voice Features** (Speech I/O)
  - [x] สร้าง STT integration (`src/voice/stt.ts`) - Whisper API
  - [x] สร้าง TTS integration (`src/voice/tts.ts`) - Edge-TTS/ElevenLabs
  - [x] เพิ่ม voice message handling ใน channels
  - [x] สร้าง Voice tools สำหรับ Agent
  - [x] Test voice conversations

- [x] 🌐 **Web Tools Package**
  - [x] Web Fetch Tool - Content extraction with anti-bot features
  - [x] Browser Automation Tool - Full UI interaction support
  - [x] Web Search Tool - Multiple search engines integration
  - [x] CLI commands และ banner management

- [x] 💻 **Computer Use**
  - [x] Enhanced Process Management - Background execution with monitoring
  - [x] System Integration Features - Hardware access and control
  - [x] CLI tools registration และ error handling

- [x] 🖥️ **Desktop Application**
  - [x] Electron-based desktop client with modern UI
  - [x] Cross-platform support (Windows, macOS, Linux)
  - [x] Voice integration and real-time chat
  - [x] Tool panels and system integration
  - [x] Security best practices and optimization

- [x] 🌐 **Web Interface**
  - [x] Real-time web chat with Socket.IO
  - [x] Voice recording and browser-based integration
  - [x] Tool panels for interactive feature access
  - [x] Responsive design with mobile support
  - [x] WebSocket communication and API endpoints

#### 🔧 **Infrastructure & Tools:**

- [x] 🔌 **MCP Integration** (Model Context Protocol)
  - [x] สร้าง MCP Client (`src/mcp/client.ts`) - stdio + WebSocket
  - [x] สร้าง MCP Server (`src/mcp/server.ts`) - expose Krab tools
  - [x] Implement tool auto-discovery และ registration
  - [x] เพิ่ม MCP configuration ใน Krab config
  - [x] Test inter-agent communication

- [x] ⏰ **Scheduler System** (Cron Jobs)
  - [x] สร้าง Cron manager (`src/scheduler/cron.ts`)
  - [x] Implement recurring task scheduling
  - [x] เพิ่ม built-in scheduled tasks (news, monitoring)
  - [x] สร้าง Scheduler CLI commands
  - [x] Add persistence for scheduled tasks

- [x] 🌐 **Browser Agent** (Web Automation)
  - [x] สร้าง Browser session manager (`src/browser/session.ts`)
  - [x] Implement Playwright integration with stealth mode
  - [x] เพิ่ม Browser tools (navigate, click, screenshot, extract)
  - [x] สร้าง Vision-based web interaction
  - [x] Test form filling และ web scraping

#### 🎨 **Creative & Media Features:**

- [x] 🎨 **Image Generation** (DALL-E/Stable Diffusion)
  - [x] Integrate DALL-E API หรือ Stable Diffusion
  - [x] สร้าง Image Generation tool
  - [x] เพิ่ม image editing capabilities
  - [x] Implement image-to-image และ style transfer

- [x] 📊 **Advanced Analytics** (Observability)
  - [x] Implement Vercel AI Tracing สำหรับ request tracking
  - [x] เพิ่ม performance metrics และ cost tracking
  - [x] สร้าง Visual Debug Console
  - [x] Add error analysis และ learning system

#### 🤝 **Multi-Agent Features:**

- [x] 🤝 **Agent Collaboration** (Supervisor/Peer Model)
  - [x] สร้าง Agent communication protocol
  - [x] Implement task delegation และ result sharing
  - [x] เพิ่ม Shared memory system
  - [x] Test multi-agent conversations

- [x] 🛡️ **Security Enhancements**
  - [x] Implement tool approval system
  - [x] เพิ่ม rate limiting และ cost controls
  - [x] สร้าง user authentication และ authorization
  - [x] Add audit logging

#### 📚 **Quality & Polish:**

- [ ] 📚 **Documentation** (Complete Guides)
  - [ ] API documentation สำหรับ Gateway
  - [ ] Tool development guide
  - [ ] Channel integration tutorials
  - [ ] Troubleshooting guide

- [ ] 🧪 **Testing Suite**
  - [ ] Unit tests สำหรับ core components
  - [ ] Integration tests สำหรับ channels
  - [ ] E2E tests สำหรับ full workflows
  - [ ] Performance benchmarks

- [ ] 🚀 **Production Hardening**
  - [ ] Error recovery และ auto-healing
  - [ ] Resource usage optimization
  - [ ] Backup และ disaster recovery
  - [ ] Monitoring และ alerting system

#### 🎯 **Stretch Goals (Phase 5.5):**

- [x] 🏠 **Obsidian Integration** (Knowledge Base)
- [x] 🧩 **Plugin Ecosystem** (Dynamic plugin loader, scaffolding, manifest system)
- [ ] 📱 **Mobile App** (React Native/Expo)
- [ ] 🌐 **Web UI** (Full dashboard)
- [ ] 🤖 **Custom Model Training** (Fine-tuning)
- [ ] 🔮 **Predictive Features** (Pattern recognition)

---

## 🧠 Core Architecture: The Agent Loop

```
┌─────────────────────────────────────────────┐
│                  User Input                  │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│              1. THINK (Plan)                 │
│  Agent วิเคราะห์คำถาม + ดึง memory ที่เกี่ยวข้อง │
│  ตัดสินใจว่าต้องใช้ tool อะไรบ้าง              │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│              2. ACT (Execute)                │
│  เรียกใช้ Tools ตามแผน                       │
│  (datetime, search, shell, file-ops, etc.)  │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│            3. REFLECT (Verify)               │
│  ตรวจสอบผลลัพธ์ว่าถูกต้องไหม                  │
│  ถ้ายังไม่พอ → กลับไป THINK อีกรอบ           │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│            4. RESPOND (Answer)               │
│  สรุปคำตอบ + บันทึกลง Memory                 │
└─────────────────────────────────────────────┘
```

---

## 🔄 Difference from OpenClaw

| Aspect              | OpenClaw               | Krab                      |
| -------------------- | ---------------------- | ------------------------- |
| Codebase size        | 400+ files in agents   | ~30-50 files total        |
| Architecture         | WebSocket Gateway      | Simple Agent Loop         |
| Startup              | Complex multi-service  | `node index.js`           |
| AGI features         | Bolt-on / plugins      | Built-in from day 1       |
| Dependencies         | 56+ packages           | ~10-15 packages           |
| Native apps          | iOS, macOS, Android    | CLI + Web only            |
| Learning curve       | Steep                  | Minimal                   |
| Customization        | Hard (complex codebase)| Easy (small codebase)     |

---

## 📚 Inspirations (2026 Competitive Landscape)

- **VoltAgent**: โครงสร้าง MCP client/server และระบบ Observability/Debug console
- **AXAR AI**: ความ Minimalist และ type-safe design
- **OpenAI Agents SDK**: ความเร็วและ multi-agent pattern (Supervisor model)
- **Mastra**: ไอเดียเรื่อง RAG pipelines + observability
- **Letta**: การจัดการ long-term memory (MemGPT-style)
- **Jan.ai**: ปรัชญา Local-first / SLM-centric design

---

## 📌 Design Principles

1. **Simple > Complex** — ถ้าทำง่ายกว่าได้ ทำง่ายกว่า
2. **Local-first** — ทุกอย่างรันในเครื่อง ไม่พึ่ง cloud (ยกเว้น LLM API)
3. **Modular** — เพิ่ม/ลด provider, channel, tool ได้อิสระ
4. **AGI-ready** — ออกแบบให้ agent คิด วางแผน และเรียนรู้ได้ตั้งแต่แกนกลาง
5. **Developer-friendly** — โค้ดอ่านง่าย เข้าใจได้ภายใน 1ชั่วโมง

## 🚀 Advanced AGI Principles (Maret 2026 Ultimate)

### 1. Structured Everything (Vercel AI SDK)

ใช้ `generateObject` และ `streamObject` ร่วมกับ **Zod** schema สำหรับทุก LLM call เพื่อลด Hallucination และเพิ่มความแม่นยำ 99%

### 2. Official MCP Ecosystem

- **Official SDK**: รองรับทั้ง stdio และ WebSocket/HTTP
- **MCP Apps**: Tool สามารถส่ง UI กลับมาแสดงผลได้ (Interactive elements)
- **Auto-Discovery**: ค้นหา tools จาก MCP Registry โดยไม่ต้อง hardcode

### 3. AI-Native Browser (Stagehand)

เลิกใช้ Playwright เพียว ๆ แล้วเปลี่ยนเป็น **Stagehand** ที่มี AI self-healing selectors และ vision vision ในตัว สั่งงานระดับ high-level ได้ทันที เช่น `do("กรอกใบสมัคร")`

### 4. Hybrid Memory 2.0

- **Hybrid Retrieval**: ปรับระบบ SQLite ให้ค้นหาแบบ **Vector + Keyword** พร้อมกัน
- **Trigger-based Summarization**: สรุปความรู้อัตโนมัติทุก 10 turns หรือตามเหตุการณ์สำคัญ

### 5. Robust Error Recovery & Self-Healing

ระบบ Reflection ที่อึดขึ้น (max 5 retries) และความสามารถในการถาม User (MCP error elicitation) เมื่อติดขัด

### 6. Power CLI & Trace

ระบบ Trace ในตัวผ่าน **Vercel AI tracing** ทำให้ดูการทำงานของ Agent ได้ละเอียดทุกขั้นตอน

- Commands: `/tools`, `/memory`, `/clear`, `/provider`, `/cost`, `/debug`

### 7. LLM Provider Optimizations

- **Anthropic Prompt Caching**: ลดต้นทุน 90%
- **Gemini Free Tier (v2.0)**: แรงและถูกที่สุดสำหรับ MVP
