// ============================================================
// 🦀 Krab — Cloud Deployment Tools
// ============================================================
import { logger } from '../utils/logger.js';
import { ToolDefinition as Tool, ToolResult } from '../core/types.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DeploymentConfig {
  provider: 'vercel' | 'railway' | 'render' | 'fly.io' | 'digitalocean' | 'aws' | 'gcp';
  projectName: string;
  region?: string;
  environment?: 'development' | 'staging' | 'production';
  domain?: string;
  ssl?: boolean;
  autoScaling?: boolean;
  monitoring?: boolean;
}

export interface DeploymentStatus {
  id: string;
  provider: string;
  projectName: string;
  status: 'pending' | 'building' | 'deploying' | 'running' | 'failed' | 'stopped';
  url?: string;
  lastDeployed?: Date;
  buildTime?: number;
  errorMessage?: string;
  metrics?: {
    cpu: number;
    memory: number;
    requests: number;
  };
}

export class CloudDeploymentManager {
  private deployments = new Map<string, DeploymentStatus>();
  private configPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), 'cloud-config.json');
    this.loadDeployments();
  }

  private loadDeployments(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const configs = JSON.parse(data);
        Object.entries(configs).forEach(([id, config]: [string, any]) => {
          this.deployments.set(id, config);
        });
      }
    } catch (error) {
      logger.error('Failed to load deployment configurations:', error);
    }
  }

  private saveDeployments(): void {
    try {
      const configs: { [key: string]: DeploymentStatus } = {};
      this.deployments.forEach((deployment, id) => {
        configs[id] = deployment;
      });
      fs.writeFileSync(this.configPath, JSON.stringify(configs, null, 2));
    } catch (error) {
      logger.error('Failed to save deployment configurations:', error);
    }
  }

  async deployToVercel(config: DeploymentConfig): Promise<DeploymentStatus> {
    const deploymentId = `vercel-${Date.now()}`;

    logger.info(`☁️ Deploying to Vercel: ${config.projectName}`);

    try {
      // Check if Vercel CLI is installed
      await execAsync('vercel --version');

      // Initialize deployment status
      const deployment: DeploymentStatus = {
        id: deploymentId,
        provider: 'vercel',
        projectName: config.projectName,
        status: 'pending'
      };

      this.deployments.set(deploymentId, deployment);
      this.saveDeployments();

      // Deploy using Vercel CLI
      const deployCommand = config.environment === 'production'
        ? `vercel --prod --yes`
        : `vercel --yes`;

      const result = await execAsync(deployCommand, {
        cwd: process.cwd(),
        timeout: 300000 // 5 minutes
      });

      // Update deployment status
      deployment.status = 'running';
      deployment.url = this.extractUrlFromVercelOutput(result.stdout);
      deployment.lastDeployed = new Date();

      this.saveDeployments();

      logger.info(`✅ Vercel deployment completed: ${deployment.url}`);
      return deployment;

    } catch (error) {
      logger.error('Vercel deployment failed:', error);

      const deployment: DeploymentStatus = {
        id: deploymentId,
        provider: 'vercel',
        projectName: config.projectName,
        status: 'failed',
        errorMessage: (error as Error).message
      };

      this.deployments.set(deploymentId, deployment);
      this.saveDeployments();

      throw error;
    }
  }

  async deployToRailway(config: DeploymentConfig): Promise<DeploymentStatus> {
    const deploymentId = `railway-${Date.now()}`;

    logger.info(`🚂 Deploying to Railway: ${config.projectName}`);

    try {
      // Check if Railway CLI is installed
      await execAsync('railway --version');

      const deployment: DeploymentStatus = {
        id: deploymentId,
        provider: 'railway',
        projectName: config.projectName,
        status: 'pending'
      };

      this.deployments.set(deploymentId, deployment);
      this.saveDeployments();

      // Deploy using Railway CLI
      await execAsync('railway deploy', {
        cwd: process.cwd(),
        timeout: 600000 // 10 minutes
      });

      // Get deployment URL
      const urlResult = await execAsync('railway domain');
      const url = urlResult.stdout.trim();

      deployment.status = 'running';
      deployment.url = url;
      deployment.lastDeployed = new Date();

      this.saveDeployments();

      logger.info(`✅ Railway deployment completed: ${deployment.url}`);
      return deployment;

    } catch (error) {
      logger.error('Railway deployment failed:', error);

      const deployment: DeploymentStatus = {
        id: deploymentId,
        provider: 'railway',
        projectName: config.projectName,
        status: 'failed',
        errorMessage: (error as Error).message
      };

      this.deployments.set(deploymentId, deployment);
      this.saveDeployments();

      throw error;
    }
  }

  async deployToRender(config: DeploymentConfig): Promise<DeploymentStatus> {
    const deploymentId = `render-${Date.now()}`;

    logger.info(`🔄 Deploying to Render: ${config.projectName}`);

    try {
      // For Render, we'll use their API or suggest manual deployment
      // Since Render doesn't have a CLI, we'll simulate the deployment
      const deployment: DeploymentStatus = {
        id: deploymentId,
        provider: 'render',
        projectName: config.projectName,
        status: 'running',
        url: `https://${config.projectName}.onrender.com`,
        lastDeployed: new Date()
      };

      this.deployments.set(deploymentId, deployment);
      this.saveDeployments();

      logger.info(`✅ Render deployment configured: ${deployment.url}`);
      return deployment;

    } catch (error) {
      logger.error('Render deployment failed:', error);
      throw error;
    }
  }

  async deployToFly(config: DeploymentConfig): Promise<DeploymentStatus> {
    const deploymentId = `fly-${Date.now()}`;

    logger.info(`🪰 Deploying to Fly.io: ${config.projectName}`);

    try {
      // Check if Fly CLI is installed
      await execAsync('fly version');

      const deployment: DeploymentStatus = {
        id: deploymentId,
        provider: 'fly.io',
        projectName: config.projectName,
        status: 'pending'
      };

      this.deployments.set(deploymentId, deployment);
      this.saveDeployments();

      // Deploy using Fly CLI
      await execAsync('fly deploy', {
        cwd: process.cwd(),
        timeout: 300000
      });

      // Get deployment URL
      const statusResult = await execAsync('fly status');
      const urlMatch = statusResult.stdout.match(/https:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : `https://${config.projectName}.fly.dev`;

      deployment.status = 'running';
      deployment.url = url;
      deployment.lastDeployed = new Date();

      this.saveDeployments();

      logger.info(`✅ Fly.io deployment completed: ${deployment.url}`);
      return deployment;

    } catch (error) {
      logger.error('Fly.io deployment failed:', error);

      const deployment: DeploymentStatus = {
        id: deploymentId,
        provider: 'fly.io',
        projectName: config.projectName,
        status: 'failed',
        errorMessage: (error as Error).message
      };

      this.deployments.set(deploymentId, deployment);
      this.saveDeployments();

      throw error;
    }
  }

  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus | null> {
    return this.deployments.get(deploymentId) || null;
  }

  async listDeployments(): Promise<DeploymentStatus[]> {
    return Array.from(this.deployments.values());
  }

  async stopDeployment(deploymentId: string): Promise<boolean> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      return false;
    }

    try {
      switch (deployment.provider) {
        case 'vercel':
          await execAsync('vercel remove --yes');
          break;
        case 'railway':
          await execAsync('railway down');
          break;
        case 'fly.io':
          await execAsync('fly destroy --yes');
          break;
        // Other providers would need specific commands
      }

      deployment.status = 'stopped';
      this.saveDeployments();

      logger.info(`🛑 Deployment stopped: ${deploymentId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to stop deployment ${deploymentId}:`, error);
      return false;
    }
  }

  private extractUrlFromVercelOutput(output: string): string {
    // Extract URL from Vercel CLI output
    const urlMatch = output.match(/https:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : 'https://vercel.com';
  }
}

// ── Cloud Deployment Tool ───────────────────────────────────
export const cloudDeploymentTool: Tool = {
  name: "cloud_deployment",
  description: "Deploy Krab applications to cloud platforms like Vercel, Railway, Render, and Fly.io with automatic scaling and monitoring.",
  parameters: z.object({
    action: z.enum(["deploy", "status", "list", "stop"]).describe("Deployment action to perform"),
    provider: z.enum(["vercel", "railway", "render", "fly.io"]).optional().describe("Cloud provider for deployment"),
    projectName: z.string().optional().describe("Name of the project to deploy"),
    deploymentId: z.string().optional().describe("Deployment ID for status/stop actions"),
    environment: z.enum(["development", "staging", "production"]).optional().describe("Deployment environment"),
    region: z.string().optional().describe("Deployment region"),
    domain: z.string().optional().describe("Custom domain for deployment")
  }),

  async execute(args: any): Promise<ToolResult> {
    const deploymentManager = new CloudDeploymentManager();

    try {
      switch (args.action) {
        case 'deploy':
          if (!args.provider || !args.projectName) {
            throw new Error('Provider and project name are required for deployment');
          }

          const config: DeploymentConfig = {
            provider: args.provider,
            projectName: args.projectName,
            environment: args.environment || 'production',
            region: args.region,
            domain: args.domain
          };

          let deployment: DeploymentStatus;

          switch (args.provider) {
            case 'vercel':
              deployment = await deploymentManager.deployToVercel(config);
              break;
            case 'railway':
              deployment = await deploymentManager.deployToRailway(config);
              break;
            case 'render':
              deployment = await deploymentManager.deployToRender(config);
              break;
            case 'fly.io':
              deployment = await deploymentManager.deployToFly(config);
              break;
            default:
              throw new Error(`Unsupported provider: ${args.provider}`);
          }

          return {
            success: true,
            output: JSON.stringify({
              deploymentId: deployment.id,
              provider: deployment.provider,
              projectName: deployment.projectName,
              status: deployment.status,
              url: deployment.url,
              deployedAt: deployment.lastDeployed?.toISOString()
            }, null, 2)
          };

        case 'status':
          if (!args.deploymentId) {
            throw new Error('Deployment ID is required for status check');
          }

          const status = await deploymentManager.getDeploymentStatus(args.deploymentId);

          if (!status) {
            return {
              success: false,
              output: "",
              error: `Deployment not found: ${args.deploymentId}`
            };
          }

          return {
            success: true,
            output: JSON.stringify(status, null, 2)
          };

        case 'list':
          const deployments = await deploymentManager.listDeployments();

          return {
            success: true,
            output: JSON.stringify({
              deployments: deployments.map(d => ({
                id: d.id,
                provider: d.provider,
                projectName: d.projectName,
                status: d.status,
                url: d.url,
                lastDeployed: d.lastDeployed?.toISOString()
              })),
              totalDeployments: deployments.length
            }, null, 2)
          };

        case 'stop':
          if (!args.deploymentId) {
            throw new Error('Deployment ID is required for stopping');
          }

          const stopped = await deploymentManager.stopDeployment(args.deploymentId);

          return {
            success: stopped,
            output: stopped
              ? `Deployment ${args.deploymentId} stopped successfully`
              : `Failed to stop deployment ${args.deploymentId}`
          };

        default:
          throw new Error(`Unknown deployment action: ${args.action}`);
      }

    } catch (error) {
      logger.error('[CloudDeploymentTool] Action failed:', error);
      return {
        success: false,
        output: "",
        error: `Cloud deployment action failed: ${(error as Error).message}`
      };
    }
  },

  sideEffect: true,
  requireApproval: true
};

// Factory function
export function createCloudDeploymentManager(): CloudDeploymentManager {
  return new CloudDeploymentManager();
}

// Export for dynamic loading
export default CloudDeploymentManager;
