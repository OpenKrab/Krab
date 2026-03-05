// ============================================================
// 🦀 Krab — Plugin Scaffolding
// `krab plugins create <name>` — generates a ready-to-go plugin
// ============================================================
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { logger } from "../utils/logger.js";
import { pluginLoader } from "./loader.js";

export interface ScaffoldOptions {
  name: string;
  type: "tool" | "channel" | "agent" | "middleware" | "mixed";
  description?: string;
  author?: string;
  directory?: string; // defaults to ~/.krab/plugins/<name>
}

// ── Generate plugin scaffold ────────────────────────────────
export async function scaffoldPlugin(
  options: ScaffoldOptions,
): Promise<string> {
  const targetDir =
    options.directory || join(pluginLoader.getGlobalDir(), options.name);

  if (existsSync(targetDir)) {
    throw new Error(
      `Directory already exists: ${targetDir}. Choose a different name or remove it first.`,
    );
  }

  await mkdir(join(targetDir, "src"), { recursive: true });

  // 1. krab-plugin.json
  const manifest = generateManifest(options);
  await writeFile(
    join(targetDir, "krab-plugin.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );

  // 2. src/index.ts
  const sourceCode = generateSourceCode(options);
  await writeFile(join(targetDir, "src", "index.ts"), sourceCode, "utf-8");

  // 3. package.json
  const packageJson = generatePackageJson(options);
  await writeFile(
    join(targetDir, "package.json"),
    JSON.stringify(packageJson, null, 2),
    "utf-8",
  );

  // 4. tsconfig.json
  const tsconfig = generateTsConfig();
  await writeFile(
    join(targetDir, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2),
    "utf-8",
  );

  // 5. README.md
  const readme = generateReadme(options);
  await writeFile(join(targetDir, "README.md"), readme, "utf-8");

  return targetDir;
}

// ── Generate manifest ───────────────────────────────────────

function generateManifest(options: ScaffoldOptions) {
  const toolName = options.name.replace(/^krab-plugin-/, "").replace(/-/g, "_");

  const base: any = {
    name: options.name,
    version: "1.0.0",
    description: options.description || `A Krab ${options.type} plugin`,
    author: options.author || "",
    license: "MIT",

    krab: {
      minVersion: "0.2.0",
      type: options.type,
      entry: "./dist/index.js",
      permissions: [],
      config: {},
    },
  };

  if (options.type === "tool" || options.type === "mixed") {
    base.tools = [
      {
        name: toolName,
        export: `${toCamelCase(toolName)}Tool`,
      },
    ];
  }

  if (options.type === "middleware") {
    base.middleware = [
      {
        hook: "beforeChat",
        export: `${toCamelCase(options.name)}Middleware`,
        priority: 100,
      },
    ];
  }

  return base;
}

// ── Generate source code template ────────────────────────────

function generateSourceCode(options: ScaffoldOptions): string {
  const toolName = options.name.replace(/^krab-plugin-/, "").replace(/-/g, "_");
  const camelName = toCamelCase(toolName);

  if (options.type === "tool" || options.type === "mixed") {
    return `// ============================================================
// 🧩 ${options.name} — Krab Plugin
// ${options.description || "A custom tool for Krab"}
// ============================================================
import { z } from "zod";
import type { ToolDefinition, ToolResult } from "krab/types";

/**
 * ${camelName}Tool — ${options.description || "Your custom tool"}
 * 
 * This tool is automatically loaded by Krab's plugin system.
 * No need to modify Krab's core code!
 */
export const ${camelName}Tool: ToolDefinition = {
  name: "${toolName}",
  description: "${options.description || `Custom tool: ${toolName}`}",
  parameters: z.object({
    input: z.string().describe("Input for the tool"),
  }),
  sideEffect: false,
  requireApproval: false,
  execute: async (args): Promise<ToolResult> => {
    try {
      // TODO: Implement your tool logic here
      const result = \`Hello from ${options.name}! Input: \${args.input}\`;
      
      return { success: true, output: result };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
};

// Optional: Lifecycle hooks
export async function onStart() {
  console.log("[${options.name}] Plugin started");
}

export async function onShutdown() {
  console.log("[${options.name}] Plugin shutting down");
}
`;
  }

  if (options.type === "middleware") {
    return `// ============================================================
// 🧩 ${options.name} — Krab Middleware Plugin
// ${options.description || "A custom middleware for Krab"}
// ============================================================
import type { MiddlewareFn, MiddlewareContext } from "krab/types";

/**
 * Middleware that runs before every chat message.
 * Modify ctx to transform the input/output or add metadata.
 */
export const ${toCamelCase(options.name)}Middleware: MiddlewareFn = async (
  ctx: MiddlewareContext,
  next: () => Promise<void>,
) => {
  // Before: runs before the chat/tool is processed
  console.log(\`[${options.name}] Processing: \${ctx.input || ctx.toolName}\`);
  const start = Date.now();

  // Call next() to continue the chain
  await next();

  // After: runs after the chat/tool is processed
  const elapsed = Date.now() - start;
  console.log(\`[${options.name}] Completed in \${elapsed}ms\`);
};
`;
  }

  // Default: agent or channel
  return `// ============================================================
// 🧩 ${options.name} — Krab Plugin
// ${options.description || "A custom plugin for Krab"}
// ============================================================

// TODO: Implement your ${options.type} plugin here

export async function onStart() {
  console.log("[${options.name}] Plugin started");
}
`;
}

// ── Generate package.json ────────────────────────────────────

function generatePackageJson(options: ScaffoldOptions) {
  return {
    name: options.name,
    version: "1.0.0",
    description: options.description || `A Krab ${options.type} plugin`,
    type: "module",
    main: "dist/index.js",
    scripts: {
      build: "tsc",
      dev: "tsc --watch",
    },
    keywords: ["krab", "krab-plugin", options.type],
    license: "MIT",
    dependencies: {
      zod: "^4.3.6",
    },
    devDependencies: {
      typescript: "^5.9.3",
    },
    peerDependencies: {
      krab: ">=0.2.0",
    },
  };
}

// ── Generate tsconfig.json ──────────────────────────────────

function generateTsConfig() {
  return {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      lib: ["ES2022"],
      outDir: "dist",
      rootDir: "src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      sourceMap: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  };
}

// ── Generate README ─────────────────────────────────────────

function generateReadme(options: ScaffoldOptions): string {
  const toolName = options.name.replace(/^krab-plugin-/, "").replace(/-/g, "_");

  return `# 🧩 ${options.name}

${options.description || `A Krab ${options.type} plugin`}

## Installation

\`\`\`bash
# From this directory
krab plugins install .

# Or copy to Krab plugins directory
cp -r . ~/.krab/plugins/${options.name}
\`\`\`

## Development

\`\`\`bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev
\`\`\`

## Usage

Once installed, Krab will automatically load this plugin.

${
  options.type === "tool"
    ? `\`\`\`
🦀 You: Use the ${toolName} tool with input "hello"
\`\`\``
    : ""
}

## Configuration

Add any required config to your \`.env\`:

\`\`\`env
# ${options.name} configuration
# (add your config keys here)
\`\`\`

## License

MIT
`;
}

// ── Helpers ─────────────────────────────────────────────────

function toCamelCase(str: string): string {
  return str.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
}
