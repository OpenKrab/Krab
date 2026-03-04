// ============================================================
// 🦀 Krab — Computer Use Interface
// ============================================================
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';

const execAsync = promisify(exec);

export interface ComputerAction {
  type: 'mouse' | 'keyboard' | 'screenshot' | 'window' | 'process' | 'file';
  action: string;
  parameters?: any;
}

export interface MouseAction {
  action: 'click' | 'move' | 'drag' | 'scroll' | 'double_click' | 'right_click';
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  duration?: number;
}

export interface KeyboardAction {
  action: 'type' | 'key' | 'shortcut';
  text?: string;
  key?: string;
  modifiers?: string[];
}

export interface ScreenshotAction {
  action: 'capture' | 'region' | 'window';
  region?: { x: number; y: number; width: number; height: number };
  window?: string;
  format?: 'png' | 'jpg';
  quality?: number;
}

export interface WindowAction {
  action: 'list' | 'activate' | 'close' | 'minimize' | 'maximize';
  title?: string;
  id?: number;
}

export class ComputerInterface {
  private platform: NodeJS.Platform;

  constructor() {
    this.platform = process.platform;
    logger.info(`[ComputerInterface] Initialized for platform: ${this.platform}`);
  }

  async takeScreenshot(options: ScreenshotAction = { action: 'capture' }): Promise<string> {
    logger.info(`[ComputerInterface] Taking screenshot: ${options.action}`);

    try {
      let command: string;
      let outputPath: string;

      if (this.platform === 'win32') {
        // Windows - use PowerShell
        const timestamp = Date.now();
        outputPath = path.join(process.cwd(), 'computer-screenshots', `screenshot-${timestamp}.png`);
        
        if (options.action === 'region' && options.region) {
          command = `Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName System.Windows.Forms; $screen = [System.Windows.Forms.Screen]::PrimaryScreen; $bitmap = New-Object System.Drawing.Bitmap $screen.Bounds.Width, $screen.Bounds.Height; $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen($screen.Bounds.X, $screen.Bounds.Y, 0, 0, $screen.Bounds.Size, [System.Drawing.CopyPixelOperation]::SourceCopy); $region = New-Object System.Drawing.Rectangle(${options.region.x}, ${options.region.y}, ${options.region.width}, ${options.region.height}); $cropped = $bitmap.Clone($region, $bitmap.PixelFormat); $cropped.Save('${outputPath}', [System.Drawing.Imaging.ImageFormat]::Png);`;
        } else {
          command = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $screen = [System.Windows.Forms.Screen]::PrimaryScreen; $bitmap = New-Object System.Drawing.Bitmap $screen.Bounds.Width, $screen.Bounds.Height; $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen($screen.Bounds.X, $screen.Bounds.Y, 0, 0, $screen.Bounds.Size, [System.Drawing.CopyPixelOperation]::SourceCopy); $bitmap.Save('${outputPath}', [System.Drawing.Imaging.ImageFormat]::Png);`;
        }
      } else if (this.platform === 'darwin') {
        // macOS - use screencapture
        const timestamp = Date.now();
        outputPath = path.join(process.cwd(), 'computer-screenshots', `screenshot-${timestamp}.png`);
        
        if (options.action === 'region' && options.region) {
          command = `screencapture -R${options.region.x}:${options.region.y}:${options.region.width}:${options.region.height} "${outputPath}"`;
        } else {
          command = `screencapture "${outputPath}"`;
        }
      } else {
        // Linux - use scrot or import
        const timestamp = Date.now();
        outputPath = path.join(process.cwd(), 'computer-screenshots', `screenshot-${timestamp}.png`);
        
        if (options.action === 'region' && options.region) {
          command = `import -window root -crop ${options.region.width}x${options.region.height}+${options.region.x}+${options.region.y} "${outputPath}"`;
        } else {
          command = `import -window root "${outputPath}"`;
        }
      }

      // Ensure screenshots directory exists
      const screenshotsDir = path.dirname(outputPath);
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }

      await execAsync(command);
      
      logger.info(`[ComputerInterface] Screenshot saved: ${outputPath}`);
      return outputPath;

    } catch (error) {
      logger.error(`[ComputerInterface] Screenshot failed:`, error);
      throw error;
    }
  }

  async performMouseAction(action: MouseAction): Promise<void> {
    logger.info(`[ComputerInterface] Mouse action: ${action.action} at (${action.x}, ${action.y})`);

    try {
      let command: string;

      if (this.platform === 'win32') {
        // Windows - use PowerShell with SendKeys
        switch (action.action) {
          case 'click':
            command = `$pos = [System.Windows.Forms.Cursor]::Position; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("{CLICK}");`;
            break;
          case 'move':
            command = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${action.x}, ${action.y});`;
            break;
          case 'double_click':
            command = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("{DOUBLECLICK}");`;
            break;
          case 'right_click':
            command = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("{RIGHTCLICK}");`;
            break;
          default:
            throw new Error(`Unsupported mouse action: ${action.action}`);
        }
      } else if (this.platform === 'darwin') {
        // macOS - use AppleScript
        switch (action.action) {
          case 'click':
            command = `osascript -e 'tell application "System Events" to click at {${action.x}, ${action.y}}'`;
            break;
          case 'move':
            command = `osascript -e 'tell application "System Events" to set frontmost of application "System Events" to true; tell application "System Events" to move mouse to {${action.x}, ${action.y}}'`;
            break;
          case 'double_click':
            command = `osascript -e 'tell application "System Events" to click at {${action.x}, ${action.y}}'`;
            break;
          case 'right_click':
            command = `osascript -e 'tell application "System Events" to right click at {${action.x}, ${action.y}}'`;
            break;
          default:
            throw new Error(`Unsupported mouse action: ${action.action}`);
        }
      } else {
        // Linux - use xdotool
        switch (action.action) {
          case 'click':
            command = `xdotool mousemove ${action.x} ${action.y} click 1`;
            break;
          case 'move':
            command = `xdotool mousemove ${action.x} ${action.y}`;
            break;
          case 'double_click':
            command = `xdotool mousemove ${action.x} ${action.y} click --repeat 2 --delay 100 1`;
            break;
          case 'right_click':
            command = `xdotool mousemove ${action.x} ${action.y} click 3`;
            break;
          default:
            throw new Error(`Unsupported mouse action: ${action.action}`);
        }
      }

      await execAsync(command);
      logger.info(`[ComputerInterface] Mouse action completed: ${action.action}`);

    } catch (error) {
      logger.error(`[ComputerInterface] Mouse action failed:`, error);
      throw error;
    }
  }

  async performKeyboardAction(action: KeyboardAction): Promise<void> {
    logger.info(`[ComputerInterface] Keyboard action: ${action.action}`);

    try {
      let command: string;

      if (this.platform === 'win32') {
        // Windows - use PowerShell SendKeys
        switch (action.action) {
          case 'type':
            command = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${this.escapeSendKeys(action.text || '')}")`;
            break;
          case 'key':
            command = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("{${action.key}}")`;
            break;
          case 'shortcut':
            const modifiers = action.modifiers?.map(m => m.toUpperCase()).join('+') || '';
            command = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("%{${modifiers}${action.key}}")`;
            break;
          default:
            throw new Error(`Unsupported keyboard action: ${action.action}`);
        }
      } else if (this.platform === 'darwin') {
        // macOS - use AppleScript
        switch (action.action) {
          case 'type':
            command = `osascript -e 'tell application "System Events" to keystroke "${action.text}"'`;
            break;
          case 'key':
            command = `osascript -e 'tell application "System Events" to key code ${this.getKeyCode(action.key || '')}'`;
            break;
          case 'shortcut':
            const modifiers = action.modifiers?.join(' down, ') + ' down';
            command = `osascript -e 'tell application "System Events" to keystroke "${action.key}" using {${modifiers}}}'`;
            break;
          default:
            throw new Error(`Unsupported keyboard action: ${action.action}`);
        }
      } else {
        // Linux - use xdotool
        switch (action.action) {
          case 'type':
            command = `xdotool type "${action.text}"`;
            break;
          case 'key':
            command = `xdotool key ${action.key}`;
            break;
          case 'shortcut':
            const modifiers = action.modifiers?.map(m => m + '+').join('') || '';
            command = `xdotool key ${modifiers}${action.key}`;
            break;
          default:
            throw new Error(`Unsupported keyboard action: ${action.action}`);
        }
      }

      await execAsync(command);
      logger.info(`[ComputerInterface] Keyboard action completed: ${action.action}`);

    } catch (error) {
      logger.error(`[ComputerInterface] Keyboard action failed:`, error);
      throw error;
    }
  }

  async listWindows(): Promise<any[]> {
    logger.info(`[ComputerInterface] Listing windows`);

    try {
      let command: string;
      let result: any;

      if (this.platform === 'win32') {
        command = `Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object ProcessName, MainWindowTitle, Id | ConvertTo-Json`;
        result = await execAsync(`powershell -Command "${command}"`);
      } else if (this.platform === 'darwin') {
        command = `osascript -e 'tell application "System Events" to get name of every process whose background only is false'`;
        result = await execAsync(command);
      } else {
        command = `wmctrl -l`;
        result = await execAsync(command);
      }

      // Parse and return windows list
      const windows = this.parseWindowsList(result.stdout || result, this.platform);
      logger.info(`[ComputerInterface] Found ${windows.length} windows`);
      return windows;

    } catch (error) {
      logger.error(`[ComputerInterface] Window listing failed:`, error);
      throw error;
    }
  }

  async activateWindow(titleOrId: string | number): Promise<void> {
    logger.info(`[ComputerInterface] Activating window: ${titleOrId}`);

    try {
      let command: string;

      if (this.platform === 'win32') {
        const id = typeof titleOrId === 'number' ? titleOrId : `(Get-Process | Where-Object {$_.MainWindowTitle -like "*${titleOrId}*"} | Select-Object -First 1).Id`;
        command = `$process = Get-Process -Id ${id}; $process.MainWindowHandle | ForEach-Object { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Form]::ActiveForm = $_; [System.Windows.Forms.Form]::Activate() }`;
      } else if (this.platform === 'darwin') {
        command = `osascript -e 'tell application "${titleOrId}" to activate'`;
      } else {
        command = `wmctrl -a "${titleOrId}"`;
      }

      await execAsync(command);
      logger.info(`[ComputerInterface] Window activated: ${titleOrId}`);

    } catch (error) {
      logger.error(`[ComputerInterface] Window activation failed:`, error);
      throw error;
    }
  }

  private escapeSendKeys(text: string): string {
    return text
      .replace(/\+/g, '{+}')
      .replace(/\^/g, '{^}')
      .replace(/%/g, '{%}')
      .replace(/~/g, '{~}')
      .replace(/\(/g, '{(}')
      .replace(/\)/g, '{)}')
      .replace(/\[/g, '{[}')
      .replace(/\]/g, '{]}')
      .replace(/\{/g, '{{}')
      .replace(/\}/g, '{}}');
  }

  private getKeyCode(key: string): string {
    const keyMap: { [key: string]: string } = {
      'enter': '36',
      'tab': '48',
      'space': '49',
      'backspace': '51',
      'delete': '117',
      'escape': '53',
      'up': '126',
      'down': '125',
      'left': '123',
      'right': '124'
    };
    return keyMap[key.toLowerCase()] || key;
  }

  private parseWindowsList(output: string, platform: NodeJS.Platform): any[] {
    if (platform === 'win32') {
      try {
        return JSON.parse(output);
      } catch {
        return [];
      }
    } else if (platform === 'darwin') {
      return output.split(', ').map(name => ({ title: name.trim(), id: name.trim() }));
    } else {
      return output.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            id: parts[0],
            desktop: parts[1],
            title: parts.slice(3).join(' ')
          };
        });
    }
  }
}

export { ComputerAction, MouseAction, KeyboardAction, ScreenshotAction, WindowAction };
