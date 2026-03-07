// ============================================================
// 🦀 Krab — Plugin SDK: Temp Path Helper
// Create temporary files/directories for plugins
// ============================================================
import { mkdtempSync, createWriteStream, ReadStream } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

export function createTempPath(prefix: string = "krab-"): {
  createDir(): string;
  createFile(ext?: string): string;
  writeFile(content: Buffer | string): Promise<string>;
} {
  const baseDir = join(tmpdir(), `krab-${randomBytes(4).toString("hex")}`);
  
  return {
    createDir(): string {
      return mkdtempSync(join(tmpdir(), prefix));
    },
    
    createFile(ext: string = "tmp"): string {
      const name = `${randomBytes(8).toString("hex")}.${ext}`;
      return join(baseDir, name);
    },
    
    async writeFile(content: Buffer | string): Promise<string> {
      const path = this.createFile();
      const stream = createWriteStream(path);
      
      return new Promise((resolve, reject) => {
        stream.on("finish", () => resolve(path));
        stream.on("error", reject);
        stream.write(content);
        stream.end();
      });
    },
  };
}
