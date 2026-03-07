import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
    sdk: "src/sdk/main.ts",
    "plugin-types": "src/plugins/types.ts",
    "plugin-sdk/index": "src/plugin-sdk/index.ts",
  },
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  target: "node22",
  splitting: false,
  external: ["playwright", "puppeteer-core", "better-sqlite3"],
  onSuccess: async () => {
    // Copy JSON config files to dist
    const files = ["prompts.json", "default-config.json"];
    const srcDir = resolve(__dirname, "src");
    const distDir = resolve(__dirname, "dist");
    
    for (const file of files) {
      const srcPath = resolve(srcDir, file);
      const distPath = resolve(distDir, file);
      if (existsSync(srcPath)) {
        copyFileSync(srcPath, distPath);
        console.log(`Copied ${file} to dist/`);
      }
    }
  },
});
