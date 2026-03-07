// ============================================================
// 🦀 Krab — Code Interpreter (Safe Code Execution)
// ============================================================
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';

const execAsync = promisify(exec);

export interface CodeExecutionOptions {
  language: 'javascript' | 'typescript' | 'python' | 'bash' | 'sql';
  code: string;
  timeout?: number;
  sandboxed?: boolean;
  input?: string;
  env?: { [key: string]: string };
  dependencies?: string[];
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  exitCode?: number;
  memoryUsage?: number;
  warnings?: string[];
}

export class CodeInterpreter {
  private sandboxDir: string;
  private executionTimeout: number = 30000; // 30 seconds

  constructor() {
    this.sandboxDir = path.join(process.cwd(), 'code-sandbox');
    this.ensureSandboxDirectory();
  }

  private ensureSandboxDirectory(): void {
    if (!fs.existsSync(this.sandboxDir)) {
      fs.mkdirSync(this.sandboxDir, { recursive: true });
    }

    // Create basic sandbox files
    const sandboxFiles = [
      { name: 'package.json', content: '{"name":"code-sandbox","version":"1.0.0"}' },
      { name: 'requirements.txt', content: '# Python dependencies' },
      { name: 'tsconfig.json', content: '{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true}}' }
    ];

    sandboxFiles.forEach(({ name, content }) => {
      const filePath = path.join(this.sandboxDir, name);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content);
      }
    });
  }

  async executeCode(options: CodeExecutionOptions): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = crypto.randomBytes(8).toString('hex');

    logger.info(`[CodeInterpreter] Executing ${options.language} code: ${executionId}`);

    try {
      let result: ExecutionResult;

      switch (options.language) {
        case 'javascript':
          result = await this.executeJavaScript(options, executionId);
          break;
        case 'typescript':
          result = await this.executeTypeScript(options, executionId);
          break;
        case 'python':
          result = await this.executePython(options, executionId);
          break;
        case 'bash':
          result = await this.executeBash(options, executionId);
          break;
        case 'sql':
          result = await this.executeSQL(options, executionId);
          break;
        default:
          throw new Error(`Unsupported language: ${options.language}`);
      }

      result.executionTime = Date.now() - startTime;
      logger.info(`[CodeInterpreter] Execution completed in ${result.executionTime}ms: ${executionId}`);

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`[CodeInterpreter] Execution failed after ${executionTime}ms: ${executionId}`, error);

      return {
        success: false,
        output: '',
        error: `Execution failed: ${(error as Error).message}`,
        executionTime,
        exitCode: 1
      };
    }
  }

  private async executeJavaScript(options: CodeExecutionOptions, executionId: string): Promise<ExecutionResult> {
    const tempFile = path.join(this.sandboxDir, `temp-${executionId}.js`);

    try {
      // Write code to temporary file
      fs.writeFileSync(tempFile, options.code);

      // Execute with timeout
      const timeout = options.timeout || this.executionTimeout;
      const command = `node "${tempFile}"`;

      const result = await this.executeCommand(command, {
        timeout,
        input: options.input,
        env: options.env
      });

      return result;

    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  private async executeTypeScript(options: CodeExecutionOptions, executionId: string): Promise<ExecutionResult> {
    const tempFile = path.join(this.sandboxDir, `temp-${executionId}.ts`);
    const compiledFile = path.join(this.sandboxDir, `compiled-${executionId}.js`);

    try {
      // Write TypeScript code to temporary file
      fs.writeFileSync(tempFile, options.code);

      // Compile TypeScript to JavaScript
      const compileCommand = `npx tsc "${tempFile}" --outFile "${compiledFile}" --target ES2022 --module commonjs --strict`;
      await this.executeCommand(compileCommand, { timeout: 10000 });

      // Execute compiled JavaScript
      const executeCommand = `node "${compiledFile}"`;
      const result = await this.executeCommand(executeCommand, {
        timeout: options.timeout || this.executionTimeout,
        input: options.input,
        env: options.env
      });

      return result;

    } finally {
      // Clean up temporary files
      [tempFile, compiledFile].forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    }
  }

  private async executePython(options: CodeExecutionOptions, executionId: string): Promise<ExecutionResult> {
    const tempFile = path.join(this.sandboxDir, `temp-${executionId}.py`);

    try {
      // Write Python code to temporary file
      fs.writeFileSync(tempFile, options.code);

      // Execute with timeout
      const timeout = options.timeout || this.executionTimeout;
      const command = `python "${tempFile}"`;

      const result = await this.executeCommand(command, {
        timeout,
        input: options.input,
        env: options.env
      });

      return result;

    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  private async executeBash(options: CodeExecutionOptions, executionId: string): Promise<ExecutionResult> {
    const tempFile = path.join(this.sandboxDir, `temp-${executionId}.sh`);

    try {
      // Write bash script to temporary file
      const script = `#!/bin/bash\n${options.code}`;
      fs.writeFileSync(tempFile, script);
      fs.chmodSync(tempFile, 0o755); // Make executable

      // Execute with timeout
      const timeout = options.timeout || this.executionTimeout;
      const command = `bash "${tempFile}"`;

      const result = await this.executeCommand(command, {
        timeout,
        input: options.input,
        env: options.env,
        cwd: this.sandboxDir
      });

      return result;

    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  private async executeSQL(options: CodeExecutionOptions, executionId: string): Promise<ExecutionResult> {
    // For SQL execution, we'll use SQLite as a safe default
    // In production, this would connect to configured databases
    const tempFile = path.join(this.sandboxDir, `temp-${executionId}.sql`);

    try {
      // Write SQL to temporary file
      fs.writeFileSync(tempFile, options.code);

      // Execute with SQLite (placeholder - would need actual database)
      const command = `sqlite3 :memory: ".read ${tempFile}"`;

      const result = await this.executeCommand(command, {
        timeout: options.timeout || 10000,
        input: options.input,
        env: options.env
      });

      return result;

    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  private async executeCommand(command: string, options: {
    timeout: number;
    input?: string;
    env?: { [key: string]: string };
    cwd?: string;
  }): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const child = spawn(command, [], {
        shell: true,
        cwd: options.cwd || this.sandboxDir,
        env: { ...process.env, ...options.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';
      let executionTime = 0;

      const startTime = Date.now();

      // Handle input
      if (options.input) {
        child.stdin?.write(options.input);
        child.stdin?.end();
      }

      // Collect output
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Handle timeout
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          output: output.trim(),
          error: `Execution timed out after ${options.timeout}ms`,
          executionTime: Date.now() - startTime,
          exitCode: -1
        });
      }, options.timeout);

      // Handle completion
      child.on('close', (code) => {
        clearTimeout(timeoutId);
        executionTime = Date.now() - startTime;

        resolve({
          success: code === 0,
          output: output.trim(),
          error: errorOutput.trim() || undefined,
          executionTime,
          exitCode: code || 0
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        executionTime = Date.now() - startTime;

        resolve({
          success: false,
          output: output.trim(),
          error: `Execution error: ${error.message}`,
          executionTime,
          exitCode: 1
        });
      });
    });
  }

  async lintCode(code: string, language: string): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    // Basic linting for different languages
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (language) {
      case 'javascript':
      case 'typescript':
        // Basic JS/TS checks
        if (code.includes('eval(')) {
          errors.push('Use of eval() is not allowed for security reasons');
        }
        if (code.includes('require(') && code.includes('child_process')) {
          warnings.push('Accessing child_process may be restricted');
        }
        break;

      case 'python':
        // Basic Python checks
        if (code.includes('import os') && code.includes('os.system')) {
          warnings.push('Using os.system may be restricted');
        }
        break;

      case 'bash':
        // Basic shell checks
        if (code.includes('sudo') || code.includes('rm -rf /')) {
          errors.push('Dangerous shell commands are not allowed');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async getSupportedLanguages(): Promise<{ language: string; version: string; available: boolean }[]> {
    const languages = [
      { language: 'javascript', command: 'node --version', parseVersion: (v: string) => v.trim() },
      { language: 'typescript', command: 'npx tsc --version', parseVersion: (v: string) => v.trim() },
      { language: 'python', command: 'python --version', parseVersion: (v: string) => v.trim() },
      { language: 'bash', command: 'bash --version', parseVersion: (v: string) => v.split('\n')[0] },
      { language: 'sql', command: 'sqlite3 --version', parseVersion: (v: string) => v.split(' ')[0] }
    ];

    const results = await Promise.all(
      languages.map(async ({ language, command, parseVersion }) => {
        try {
          const result = await execAsync(command);
          return {
            language,
            version: parseVersion(result.stdout || result.stderr),
            available: true
          };
        } catch {
          return {
            language,
            version: 'Not installed',
            available: false
          };
        }
      })
    );

    return results;
  }
}
