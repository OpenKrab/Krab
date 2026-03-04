// ============================================================
// 🦀 Krab — System Integration Features
// ============================================================
import { ToolDefinition as Tool, ToolResult } from "../../core/types.js";
import { logger } from "../../utils/logger.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";

export interface SystemOptions {
  action: "status" | "info" | "permissions" | "health" | "notify" | "location" | "camera_list" | "camera_snap" | "screen_record" | "run";
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  message?: string;
  title?: string;
  filePath?: string;
  duration?: number;
  needsScreenRecording?: boolean;
}

export interface SystemResult {
  action: string;
  status: "success" | "error";
  data?: any;
  error?: string;
  timestamp: Date;
}

export class SystemIntegration {
  private platform: string;
  private isMac: boolean;
  private isWindows: boolean;
  private isLinux: boolean;

  constructor() {
    this.platform = os.platform();
    this.isMac = this.platform === "darwin";
    this.isWindows = this.platform === "win32";
    this.isLinux = this.platform === "linux";
  }

  async execute(options: SystemOptions): Promise<SystemResult> {
    try {
      logger.info(`[SystemIntegration] Executing: ${options.action}`);

      switch (options.action) {
        case "status":
          return await this.getSystemStatus();
        case "info":
          return await this.getSystemInfo();
        case "permissions":
          return await this.checkPermissions();
        case "health":
          return await this.getSystemHealth();
        case "notify":
          return await this.sendNotification(options.message!, options.title);
        case "location":
          return await this.getLocation();
        case "camera_list":
          return await this.listCameras();
        case "camera_snap":
          return await this.takeCameraSnapshot(options.filePath);
        case "screen_record":
          return await this.startScreenRecording(options.duration, options.filePath);
        case "run":
          return await this.runSystemCommand(options.command!, options.args, options.cwd, options.env, options.timeout);
        default:
          throw new Error(`Unknown system action: ${options.action}`);
      }

    } catch (error) {
      logger.error(`[SystemIntegration] Action failed: ${options.action}`, error);
      return {
        action: options.action,
        status: "error",
        error: (error as Error).message,
        timestamp: new Date()
      };
    }
  }

  private async getSystemStatus(): Promise<SystemResult> {
    const status = {
      platform: this.platform,
      hostname: os.hostname(),
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      cpus: os.cpus().length,
      arch: os.arch(),
      nodeVersion: process.version,
      krabVersion: this.getKrabVersion(),
      timestamp: new Date()
    };

    return {
      action: "status",
      status: "success",
      data: status,
      timestamp: new Date()
    };
  }

  private async getSystemInfo(): Promise<SystemResult> {
    const info = {
      platform: this.platform,
      release: os.release(),
      type: os.type(),
      machine: os.machine(),
      homedir: os.homedir(),
      tmpdir: os.tmpdir(),
      endianness: os.endianness(),
      networkInterfaces: os.networkInterfaces(),
      userInfo: os.userInfo(),
      cpuInfo: os.cpus(),
      memoryInfo: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      }
    };

    return {
      action: "info",
      status: "success",
      data: info,
      timestamp: new Date()
    };
  }

  private async checkPermissions(): Promise<SystemResult> {
    const permissions = {
      canReadFiles: this.checkFileReadPermission(),
      canWriteFiles: this.checkFileWritePermission(),
      canExecuteCommands: this.checkCommandExecutionPermission(),
      canAccessNetwork: this.checkNetworkPermission(),
      canAccessCamera: this.checkCameraPermission(),
      canAccessMicrophone: this.checkMicrophonePermission(),
      canAccessLocation: this.checkLocationPermission(),
      canScreenRecord: this.checkScreenRecordingPermission()
    };

    return {
      action: "permissions",
      status: "success",
      data: permissions,
      timestamp: new Date()
    };
  }

  private async getSystemHealth(): Promise<SystemResult> {
    const health = {
      cpuUsage: await this.getCpuUsage(),
      memoryUsage: this.getMemoryUsage(),
      diskUsage: await this.getDiskUsage(),
      networkStatus: await this.getNetworkStatus(),
      processCount: this.getProcessCount(),
      temperature: await this.getSystemTemperature(),
      batteryStatus: await this.getBatteryStatus()
    };

    return {
      action: "health",
      status: "success",
      data: health,
      timestamp: new Date()
    };
  }

  private async sendNotification(message: string, title?: string): Promise<SystemResult> {
    try {
      if (this.isMac) {
        // macOS notification
        const command = `osascript -e 'display notification "${message}" with title "${title || "Krab"}"'`;
        await this.executeCommand(command);
      } else if (this.isLinux) {
        // Linux notification (requires notify-send)
        const command = `notify-send "${title || "Krab"}" "${message}"`;
        await this.executeCommand(command);
      } else if (this.isWindows) {
        // Windows notification (requires toast or similar)
        logger.warn("[SystemIntegration] Windows notifications not implemented");
      }

      return {
        action: "notify",
        status: "success",
        data: { message, title },
        timestamp: new Date()
      };

    } catch (error) {
      throw new Error(`Failed to send notification: ${(error as Error).message}`);
    }
  }

  private async getLocation(): Promise<SystemResult> {
    try {
      if (this.isMac) {
        // macOS location services
        const command = 'corelocation -f "{\\"lat\\": \\"%lat\\", \\"lon\\": \\"%lon\\", \\"accuracy\\": \\"%hacc\\", \\"timestamp\\": \\"%time\\"}"';
        const result = await this.executeCommand(command);
        
        return {
          action: "location",
          status: "success",
          data: JSON.parse(result),
          timestamp: new Date()
        };
      } else {
        throw new Error("Location services not implemented for this platform");
      }

    } catch (error) {
      throw new Error(`Failed to get location: ${(error as Error).message}`);
    }
  }

  private async listCameras(): Promise<SystemResult> {
    try {
      let cameras: any[] = [];

      if (this.isMac) {
        // macOS camera list
        const command = "system_profiler SPCameraDataType -json";
        const result = await this.executeCommand(command);
        const data = JSON.parse(result);
        
        cameras = data.SPCameraDataType.map((camera: any) => ({
          name: camera._name,
          model: camera._name,
          id: camera._name,
          connected: true
        }));
      } else if (this.isLinux) {
        // Linux camera list
        const command = "ls /dev/video* 2>/dev/null || echo ''";
        const result = await this.executeCommand(command);
        const devices = result.trim().split('\n').filter(Boolean);
        
        cameras = devices.map((device, index) => ({
          name: `Camera ${index + 1}`,
          model: device,
          id: device,
          connected: true
        }));
      }

      return {
        action: "camera_list",
        status: "success",
        data: { cameras },
        timestamp: new Date()
      };

    } catch (error) {
      throw new Error(`Failed to list cameras: ${(error as Error).message}`);
    }
  }

  private async takeCameraSnapshot(filePath?: string): Promise<SystemResult> {
    try {
      const outputPath = filePath || path.join(os.tmpdir(), `camera_snapshot_${Date.now()}.jpg`);

      if (this.isMac) {
        // macOS camera capture (requires imagesutil or similar)
        const command = `imagesutil capture -i camera -o "${outputPath}"`;
        await this.executeCommand(command);
      } else if (this.isLinux) {
        // Linux camera capture (requires fswebcam)
        const command = `fswebcam -r 1280x720 "${outputPath}"`;
        await this.executeCommand(command);
      } else {
        throw new Error("Camera capture not implemented for this platform");
      }

      return {
        action: "camera_snap",
        status: "success",
        data: { filePath: outputPath, mediaPath: `MEDIA:${outputPath}` },
        timestamp: new Date()
      };

    } catch (error) {
      throw new Error(`Failed to take camera snapshot: ${(error as Error).message}`);
    }
  }

  private async startScreenRecording(duration?: number, filePath?: string): Promise<SystemResult> {
    try {
      const outputPath = filePath || path.join(os.tmpdir(), `screen_recording_${Date.now()}.mp4`);
      const recordDuration = duration || 10; // Default 10 seconds

      if (this.isMac) {
        // macOS screen recording
        const command = `screencapture -t mp4 -T ${recordDuration} "${outputPath}"`;
        await this.executeCommand(command);
      } else if (this.isLinux) {
        // Linux screen recording (requires ffmpeg)
        const command = `ffmpeg -f x11grab -r 25 -t ${recordDuration} -s $(xdpyinfo | grep dimensions | sed -r 's/^[^0-9]*([0-9]+x[0-9]+).*/\\1/') -i :0.0 "${outputPath}"`;
        await this.executeCommand(command);
      } else {
        throw new Error("Screen recording not implemented for this platform");
      }

      return {
        action: "screen_record",
        status: "success",
        data: { filePath: outputPath, duration: recordDuration, mediaPath: `FILE:${outputPath}` },
        timestamp: new Date()
      };

    } catch (error) {
      throw new Error(`Failed to start screen recording: ${(error as Error).message}`);
    }
  }

  private async runSystemCommand(command: string, args: string[] = [], cwd?: string, env?: Record<string, string>, timeout?: number): Promise<SystemResult> {
    try {
      const fullCommand = [command, ...args].join(" ");
      const result = await this.executeCommand(fullCommand, cwd, env, timeout);

      return {
        action: "run",
        status: "success",
        data: { command: fullCommand, output: result },
        timestamp: new Date()
      };

    } catch (error) {
      throw new Error(`Failed to run command: ${(error as Error).message}`);
    }
  }

  // Helper methods
  private executeCommand(command: string, cwd?: string, env?: Record<string, string>, timeout?: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = exec(command, {
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...env },
        timeout: timeout || 30000
      }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });

      child.stdin?.end();
    });
  }

  private getKrabVersion(): string {
    try {
      const packagePath = path.join(__dirname, "../../../package.json");
      const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      return packageJson.version || "unknown";
    } catch {
      return "unknown";
    }
  }

  private checkFileReadPermission(): boolean {
    try {
      const testFile = path.join(os.tmpdir(), "krab_permission_test");
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
      return true;
    } catch {
      return false;
    }
  }

  private checkFileWritePermission(): boolean {
    return this.checkFileReadPermission(); // Same test
  }

  private checkCommandExecutionPermission(): boolean {
    try {
      require("child_process").execSync("echo test");
      return true;
    } catch {
      return false;
    }
  }

  private checkNetworkPermission(): boolean {
    // Simple check - try to resolve a domain
    try {
      require("dns").lookup("google.com", () => {});
      return true;
    } catch {
      return true; // Assume available
    }
  }

  private checkCameraPermission(): boolean {
    // Platform-specific checks would go here
    return true; // Assume available
  }

  private checkMicrophonePermission(): boolean {
    // Platform-specific checks would go here
    return true; // Assume available
  }

  private checkLocationPermission(): boolean {
    // Platform-specific checks would go here
    return this.isMac; // Only implement on macOS for now
  }

  private checkScreenRecordingPermission(): boolean {
    // Platform-specific checks would go here
    return this.isMac || this.isLinux; // Implement on macOS and Linux
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const usage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
        resolve(usage);
      }, 100);
    });
  }

  private getMemoryUsage(): any {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    
    return {
      total,
      free,
      used,
      percentage: (used / total) * 100
    };
  }

  private async getDiskUsage(): Promise<any> {
    try {
      const stats = fs.statSync(process.cwd());
      return {
        path: process.cwd(),
        available: stats.size || 0
      };
    } catch {
      return { path: process.cwd(), available: 0 };
    }
  }

  private async getNetworkStatus(): Promise<any> {
    const interfaces = os.networkInterfaces();
    const activeInterfaces = Object.values(interfaces)
      .flat()
      .filter((iface): iface is NonNullable<typeof iface> => 
        iface !== undefined && !iface.internal && iface.family === "IPv4"
      );

    return {
      interfaces: activeInterfaces,
      connected: activeInterfaces.length > 0
    };
  }

  private getProcessCount(): number {
    // Simplified - would use platform-specific commands
    return 0;
  }

  private async getSystemTemperature(): Promise<number | null> {
    // Platform-specific temperature reading
    return null;
  }

  private async getBatteryStatus(): Promise<any> {
    // Platform-specific battery status
    return null;
  }
}

// ── System Integration Tool ───────────────────────────────────
export const systemIntegrationTool: Tool = {
  name: "system",
  description: "System integration features. Supports status, info, permissions, health, notify, location, camera operations, screen recording, and command execution.",
  parameters: z.object({
    action: z.enum(["status", "info", "permissions", "health", "notify", "location", "camera_list", "camera_snap", "screen_record", "run"]).describe("System action to perform"),
    command: z.string().optional().describe("Command to execute (for run action)"),
    args: z.array(z.string()).optional().describe("Command arguments"),
    cwd: z.string().optional().describe("Working directory"),
    env: z.record(z.string(), z.string()).optional().describe("Environment variables"),
    timeout: z.number().optional().describe("Command timeout in milliseconds"),
    message: z.string().optional().describe("Message for notifications"),
    title: z.string().optional().describe("Title for notifications"),
    filePath: z.string().optional().describe("File path for camera snapshots or screen recordings"),
    duration: z.number().optional().describe("Duration for screen recordings (seconds)"),
    needsScreenRecording: z.boolean().optional().describe("Command requires screen recording permission")
  }),

  async execute(args: any): Promise<ToolResult> {
    try {
      const system = new SystemIntegration();
      const result = await system.execute(args);

      logger.info(`[SystemIntegrationTool] Action completed: ${result.action}`);
      return {
        success: true,
        output: JSON.stringify(result, null, 2)
      };

    } catch (error) {
      logger.error("[SystemIntegrationTool] Action failed:", error);
      return {
        success: false,
        output: "",
        error: `System action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: true,
  requireApproval: true
};

// Factory function
export function createSystemIntegration(): SystemIntegration {
  return new SystemIntegration();
}

// Export for dynamic loading
export default SystemIntegration;
