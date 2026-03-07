// ============================================================
// 🦀 Krab — Browser Form Automation
// ============================================================
import { BrowserSessionManager } from './session.js';
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';

export interface FormAutomationOptions {
  sessionId: string;
  action: 'fill_form' | 'submit_form' | 'select_option' | 'upload_file';
  formSelector?: string;
  fields: Array<{
    selector: string;
    value: string;
    type: 'text' | 'select' | 'checkbox' | 'radio' | 'file';
    options?: string[];
  }>;
  filePath?: string;
  optionSelector?: string;
  optionValue?: string;
}

export interface FormField {
  selector: string;
  value: string;
  type: 'text' | 'select' | 'checkbox' | 'radio' | 'file';
  options?: string[];
}

export class BrowserFormAutomation {
  private sessionManager: BrowserSessionManager;

  constructor() {
    this.sessionManager = new BrowserSessionManager();
  }

  async fillForm(sessionId: string, formSelector: string, fields: FormField[]): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserFormAutomation] Filling form: ${sessionId}`);

    try {
      // Wait for form to be visible
      await session.page.waitForSelector(formSelector, { timeout: 5000 });

      // Fill each field
      for (const field of fields) {
        await session.page.waitForSelector(field.selector, { timeout: 3000 });
        
        switch (field.type) {
          case 'text':
            await session.page.fill(field.selector, field.value);
            break;

          case 'select':
            await session.page.selectOption(field.selector, field.value);
            break;

          case 'checkbox':
            const checkbox = await session.page.$(field.selector);
            if (checkbox && !(await checkbox.isChecked())) {
              await checkbox.check();
            }
            break;

          case 'radio':
            const radio = await session.page.$(field.selector);
            if (radio && !(await radio.isChecked())) {
              await radio.check();
            }
            break;

          case 'file':
            const fileInput = await session.page.$(field.selector);
            if (fileInput) {
              await fileInput.setInputFiles(field.value);
            }
            break;
        }

        // Small delay between fields
        await session.page.waitForTimeout(100 + Math.random() * 200);
      }

      session.lastActivity = new Date();
      logger.info(`[BrowserFormAutomation] Form filled successfully`);

    } catch (error) {
      logger.error(`[BrowserFormAutomation] Form fill failed:`, error);
      throw error;
    }
  }

  async submitForm(sessionId: string, formSelector?: string, submitSelector?: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserFormAutomation] Submitting form: ${sessionId}`);

    try {
      const actualSubmitSelector = submitSelector || `${formSelector} button[type='submit'], ${formSelector} input[type='submit']`;
      
      await session.page.waitForSelector(actualSubmitSelector, { timeout: 5000 });
      await session.page.click(actualSubmitSelector);
      
      session.lastActivity = new Date();
      logger.info(`[BrowserFormAutomation] Form submitted successfully`);

    } catch (error) {
      logger.error(`[BrowserFormAutomation] Form submission failed:`, error);
      throw error;
    }
  }

  async selectOption(sessionId: string, selector: string, value: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserFormAutomation] Selecting option: ${value} in ${selector}`);

    try {
      await session.page.waitForSelector(selector, { timeout: 3000 });
      await session.page.selectOption(selector, value);
      
      session.lastActivity = new Date();
      logger.info(`[BrowserFormAutomation] Option selected: ${value}`);

    } catch (error) {
      logger.error(`[BrowserFormAutomation] Option selection failed:`, error);
      throw error;
    }
  }

  async uploadFile(sessionId: string, selector: string, filePath: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserFormAutomation] Uploading file: ${filePath} to ${selector}`);

    try {
      await session.page.waitForSelector(selector, { timeout: 3000 });
      const fileInput = await session.page.$(selector);
      
      if (fileInput) {
        await fileInput.setInputFiles(filePath);
      }
      
      session.lastActivity = new Date();
      logger.info(`[BrowserFormAutomation] File uploaded successfully`);

    } catch (error) {
      logger.error(`[BrowserFormAutomation] File upload failed:`, error);
      throw error;
    }
  }

  async extractFormData(sessionId: string, formSelector: string): Promise<FormField[]> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || !session.page || session.status !== 'active') {
      throw new Error(`Invalid session or session not active: ${sessionId}`);
    }

    logger.info(`[BrowserFormAutomation] Extracting form data: ${sessionId}`);

    try {
      await session.page.waitForSelector(formSelector, { timeout: 5000 });
      
      const fields = await session.page.evaluate((formSelector) => {
        const doc = (globalThis as any).document;
        const getSelector = (element: any): string => {
          if (element.id) return `#${element.id}`;
          if (element.name) return `[name="${element.name}"]`;
          if (element.className) return `.${String(element.className).split(' ')[0]}`;
          return String(element.tagName).toLowerCase();
        };
        const getFieldType = (element: any): FormField['type'] => {
          const tagName = String(element.tagName).toLowerCase();
          const inputType = element.type?.toLowerCase();
          if (tagName === 'input') {
            if (['text', 'password', 'email', 'search', 'tel'].includes(inputType)) return 'text';
            if (inputType === 'checkbox') return 'checkbox';
            if (inputType === 'radio') return 'radio';
            if (inputType === 'file') return 'file';
          }
          if (tagName === 'textarea') return 'text';
          if (tagName === 'select') return 'select';
          return 'text';
        };
        const form = doc.querySelector(formSelector);
        if (!form) return [];

        const inputs = form.querySelectorAll('input, select, textarea, input[type="checkbox"], input[type="radio"]');
        const fields: FormField[] = [];

        inputs.forEach((input: any) => {
          const field: FormField = {
            selector: getSelector(input),
            value: input.value || input.textContent || '',
            type: getFieldType(input),
            options: input.options ? Array.from(input.options).map((opt: any) => opt.value) : undefined
          };

          fields.push(field);
        });

        return fields;
      }, formSelector);

      session.lastActivity = new Date();
      logger.info(`[BrowserFormAutomation] Form data extracted: ${fields.length} fields`);
      return fields;

    } catch (error) {
      logger.error(`[BrowserFormAutomation] Form data extraction failed:`, error);
      throw error;
    }
  }

  private getSelector(element: any): string {
    if (element.id) {
      return `#${element.id}`;
    } else if (element.name) {
      return `[name="${element.name}"]`;
    } else if (element.className) {
      return `.${element.className.split(' ')[0]}`;
    } else {
      return element.tagName.toLowerCase();
    }
  }

  private getFieldType(element: any): FormField['type'] {
    const tagName = element.tagName.toLowerCase();
    const inputType = element.type?.toLowerCase();

    if (tagName === 'input') {
      if (inputType === 'text' || inputType === 'password' || inputType === 'email' || inputType === 'search' || inputType === 'tel') {
        return 'text';
      } else if (inputType === 'checkbox') {
        return 'checkbox';
      } else if (inputType === 'radio') {
        return 'radio';
      } else if (inputType === 'file') {
        return 'file';
      }
    }

    if (tagName === 'textarea') {
      return 'text';
    }

    if (tagName === 'select') {
      return 'select';
    }

    return 'text'; // Default
  }
}

// ── Browser Form Automation Tool ───────────────────────────────
export const browserFormTool: Tool = {
  name: "browser_form",
  description: "Browser form automation tool. Fill forms, select options, upload files, and submit forms.",
  parameters: z.object({
    action: z.enum(["fill_form", "submit_form", "select_option", "upload_file", "extract_form"]).describe("Form automation action"),
    sessionId: z.string().describe("Browser session ID"),
    formSelector: z.string().optional().describe("CSS selector for the form"),
    fields: z.array(z.object({
      selector: z.string().describe("CSS selector for the field"),
      value: z.string().describe("Value to fill or option to select"),
      type: z.enum(["text", "select", "checkbox", "radio", "file"]).optional().describe("Field type"),
      options: z.array(z.string()).optional().describe("Options for select/radio fields")
    })).optional().describe("Form fields to fill"),
    optionSelector: z.string().optional().describe("CSS selector for option selection"),
    optionValue: z.string().optional().describe("Option value to select"),
    filePath: z.string().optional().describe("File path for upload")
  }),

  async execute(args: any): Promise<ToolResult> {
    const formAutomation = new BrowserFormAutomation();
    let extractedFields: FormField[] | undefined;
    
    try {
      switch (args.action) {
        case 'fill_form':
          if (!args.formSelector || !args.fields) {
            throw new Error('Form selector and fields are required for fill_form action');
          }
          await formAutomation.fillForm(args.sessionId, args.formSelector, args.fields);
          break;

        case 'submit_form':
          await formAutomation.submitForm(args.sessionId, args.formSelector, args.submitSelector);
          break;

        case 'select_option':
          if (!args.optionSelector || !args.optionValue) {
            throw new Error('Option selector and value are required for select_option action');
          }
          await formAutomation.selectOption(args.sessionId, args.optionSelector, args.optionValue);
          break;

        case 'upload_file':
          if (!args.selector || !args.filePath) {
            throw new Error('Selector and file path are required for upload_file action');
          }
          await formAutomation.uploadFile(args.sessionId, args.selector, args.filePath);
          break;

        case 'extract_form':
          if (!args.formSelector) {
            throw new Error('Form selector is required for extract_form action');
          }
          extractedFields = await formAutomation.extractFormData(args.sessionId, args.formSelector);
          break;

        default:
          throw new Error(`Unknown form action: ${args.action}`);
      }

      return {
        success: true,
        output: JSON.stringify({
          action: args.action,
          sessionId: args.sessionId,
          timestamp: new Date().toISOString(),
          ...(args.action === 'extract_form' && { fields: extractedFields })
        }, null, 2)
      };

    } catch (error) {
      logger.error('[BrowserFormTool] Action failed:', error);
      return {
        success: false,
        output: "",
        error: `Form action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: true,
  requireApproval: true
};

// Factory function
export function createBrowserFormAutomation(): BrowserFormAutomation {
  return new BrowserFormAutomation();
}

// Export for dynamic loading
export default BrowserFormAutomation;
