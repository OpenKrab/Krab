// ============================================================
// 🦀 Krab — Code Interpreter Tools
// ============================================================
import { CodeInterpreter, ExecutionResult } from './code-interpreter.js';
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';

export interface CodeToolOptions {
  language: 'javascript' | 'typescript' | 'python' | 'bash' | 'sql';
  code: string;
  timeout?: number;
  sandboxed?: boolean;
  input?: string;
  env?: { [key: string]: string };
  dependencies?: string[];
}

export class CodeInterpreterTools {
  private interpreter: CodeInterpreter;

  constructor() {
    this.interpreter = new CodeInterpreter();
  }

  async executeCode(options: CodeToolOptions): Promise<ToolResult> {
    try {
      logger.info(`[CodeInterpreterTools] Executing ${options.language} code`);

      // Lint code first for security
      const lintResult = await this.interpreter.lintCode(options.code, options.language);

      if (!lintResult.valid) {
        return {
          success: false,
          output: "",
          error: `Code validation failed:\n${lintResult.errors.join('\n')}`
        };
      }

      if (lintResult.warnings.length > 0) {
        logger.warn(`[CodeInterpreterTools] Code warnings: ${lintResult.warnings.join(', ')}`);
      }

      // Execute code
      const result = await this.interpreter.executeCode(options);

      return {
        success: result.success,
        output: result.output,
        error: result.error
      };

    } catch (error) {
      logger.error('[CodeInterpreterTools] Execution failed:', error);
      return {
        success: false,
        output: "",
        error: `Code execution failed: ${(error as Error).message}`
      };
    }
  }

  async lintCode(code: string, language: string): Promise<ToolResult> {
    try {
      const result = await this.interpreter.lintCode(code, language);

      return {
        success: result.valid,
        output: JSON.stringify({
          valid: result.valid,
          errors: result.errors,
          warnings: result.warnings
        }, null, 2)
      };

    } catch (error) {
      logger.error('[CodeInterpreterTools] Lint failed:', error);
      return {
        success: false,
        output: "",
        error: `Code linting failed: ${(error as Error).message}`
      };
    }
  }

  async getSupportedLanguages(): Promise<ToolResult> {
    try {
      const languages = await this.interpreter.getSupportedLanguages();

      return {
        success: true,
        output: JSON.stringify({
          languages,
          totalSupported: languages.filter(l => l.available).length,
          timestamp: new Date().toISOString()
        }, null, 2)
      };

    } catch (error) {
      logger.error('[CodeInterpreterTools] Language check failed:', error);
      return {
        success: false,
        output: "",
        error: `Language check failed: ${(error as Error).message}`
      };
    }
  }

  async runTestCode(language: string): Promise<ToolResult> {
    const testCode = this.getTestCode(language);

    if (!testCode) {
      return {
        success: false,
        output: "",
        error: `No test code available for language: ${language}`
      };
    }

    return await this.executeCode({
      language: language as any,
      code: testCode,
      timeout: 10000
    });
  }

  private getTestCode(language: string): string | null {
    switch (language) {
      case 'javascript':
        return `
console.log("Hello from JavaScript!");
const result = 2 + 3;
console.log("2 + 3 =", result);
process.stdout.write("Test completed");
        `.trim();

      case 'typescript':
        return `
const message: string = "Hello from TypeScript!";
console.log(message);
const result: number = 2 + 3;
console.log("2 + 3 =", result);
        `.trim();

      case 'python':
        return `
print("Hello from Python!")
result = 2 + 3
print(f"2 + 3 = {result}")
        `.trim();

      case 'bash':
        return `
echo "Hello from Bash!"
result=$((2 + 3))
echo "2 + 3 = $result"
        `.trim();

      case 'sql':
        return `
CREATE TABLE test (id INTEGER, name TEXT);
INSERT INTO test VALUES (1, 'Hello'), (2, 'World');
SELECT * FROM test;
        `.trim();

      default:
        return null;
    }
  }
}

// ── Code Interpreter Tool ───────────────────────────────────
export const codeInterpreterTool: Tool = {
  name: "code_interpreter",
  description: "Execute code safely in multiple languages (JavaScript, TypeScript, Python, Bash, SQL) with sandboxing and timeout protection.",
  parameters: z.object({
    language: z.enum(["javascript", "typescript", "python", "bash", "sql"]).describe("Programming language to execute"),
    code: z.string().describe("Code to execute"),
    timeout: z.number().optional().describe("Execution timeout in milliseconds"),
    sandboxed: z.boolean().optional().describe("Use sandboxed execution"),
    input: z.string().optional().describe("Input data for the code"),
    env: z.record(z.string(), z.string()).optional().describe("Environment variables"),
    dependencies: z.array(z.string()).optional().describe("Additional dependencies to install")
  }),

  async execute(args: any): Promise<ToolResult> {
    const tools = new CodeInterpreterTools();
    return await tools.executeCode(args);
  },

  sideEffect: true,
  requireApproval: true
};

// ── Code Linter Tool ────────────────────────────────────────
export const codeLinterTool: Tool = {
  name: "code_linter",
  description: "Lint and validate code for security and best practices before execution.",
  parameters: z.object({
    code: z.string().describe("Code to lint"),
    language: z.enum(["javascript", "typescript", "python", "bash", "sql"]).describe("Programming language")
  }),

  async execute(args: any): Promise<ToolResult> {
    const tools = new CodeInterpreterTools();
    return await tools.lintCode(args.code, args.language);
  },

  sideEffect: false,
  requireApproval: false
};

// ── Language Support Tool ───────────────────────────────────
export const languageSupportTool: Tool = {
  name: "language_support",
  description: "Check available programming languages and their versions on the system.",
  parameters: z.object({
    action: z.enum(["list", "test"]).describe("Action to perform"),
    language: z.string().optional().describe("Language to test (for test action)")
  }),

  async execute(args: any): Promise<ToolResult> {
    const tools = new CodeInterpreterTools();

    switch (args.action) {
      case 'list':
        return await tools.getSupportedLanguages();

      case 'test':
        if (!args.language) {
          return {
            success: false,
            output: "",
            error: "Language parameter required for test action"
          };
        }
        return await tools.runTestCode(args.language);

      default:
        return {
          success: false,
          output: "",
          error: `Unknown action: ${args.action}`
        };
    }
  },

  sideEffect: false,
  requireApproval: false
};

// Factory function
export function createCodeInterpreterTools(): CodeInterpreterTools {
  return new CodeInterpreterTools();
}

// Export for dynamic loading
export default CodeInterpreterTools;
