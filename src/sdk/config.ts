// ============================================================
// 🦀 Krab SDK — Configuration Management
// ============================================================
import * as fs from 'fs';
import * as path from 'path';
import { KrabSDKConfig } from './index.js';

export interface SDKEnvironment {
  production: KrabSDKConfig;
  staging: KrabSDKConfig;
  development: KrabSDKConfig;
  test: KrabSDKConfig;
}

export interface SDKProfile {
  name: string;
  config: KrabSDKConfig;
  description?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class ConfigurationManager {
  private configDir: string;
  private currentProfile: string | null = null;
  private profiles: Map<string, SDKProfile> = new Map();

  constructor(configDir?: string) {
    this.configDir = configDir || path.join(process.cwd(), '.krab-sdk');
    this.ensureConfigDirectory();
    this.loadProfiles();
  }

  private ensureConfigDirectory(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  private loadProfiles(): void {
    try {
      const profilesFile = path.join(this.configDir, 'profiles.json');
      if (fs.existsSync(profilesFile)) {
        const data = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
        Object.entries(data).forEach(([name, profile]: [string, any]) => {
          this.profiles.set(name, {
            ...profile,
            createdAt: new Date(profile.createdAt),
            updatedAt: new Date(profile.updatedAt)
          });
        });
      }

      // Load current profile
      const currentFile = path.join(this.configDir, 'current-profile');
      if (fs.existsSync(currentFile)) {
        this.currentProfile = fs.readFileSync(currentFile, 'utf8').trim();
      }
    } catch (error) {
      console.error('[ConfigurationManager] Failed to load profiles:', error);
    }
  }

  private saveProfiles(): void {
    try {
      const profilesFile = path.join(this.configDir, 'profiles.json');
      const data: { [key: string]: any } = {};

      this.profiles.forEach((profile, name) => {
        data[name] = profile;
      });

      fs.writeFileSync(profilesFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[ConfigurationManager] Failed to save profiles:', error);
    }
  }

  // Profile management
  createProfile(name: string, config: KrabSDKConfig, description?: string, tags?: string[]): boolean {
    if (this.profiles.has(name)) {
      console.error(`[ConfigurationManager] Profile already exists: ${name}`);
      return false;
    }

    const profile: SDKProfile = {
      name,
      config,
      description,
      tags,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.profiles.set(name, profile);
    this.saveProfiles();

    console.log(`[ConfigurationManager] Profile created: ${name}`);
    return true;
  }

  updateProfile(name: string, updates: Partial<Pick<SDKProfile, 'config' | 'description' | 'tags'>>): boolean {
    const profile = this.profiles.get(name);
    if (!profile) {
      console.error(`[ConfigurationManager] Profile not found: ${name}`);
      return false;
    }

    if (updates.config) {
      profile.config = { ...profile.config, ...updates.config };
    }
    if (updates.description !== undefined) {
      profile.description = updates.description;
    }
    if (updates.tags !== undefined) {
      profile.tags = updates.tags;
    }

    profile.updatedAt = new Date();
    this.saveProfiles();

    console.log(`[ConfigurationManager] Profile updated: ${name}`);
    return true;
  }

  deleteProfile(name: string): boolean {
    if (!this.profiles.has(name)) {
      return false;
    }

    this.profiles.delete(name);
    this.saveProfiles();

    // Clear current profile if it was deleted
    if (this.currentProfile === name) {
      this.setCurrentProfile(null);
    }

    console.log(`[ConfigurationManager] Profile deleted: ${name}`);
    return true;
  }

  getProfile(name: string): SDKProfile | null {
    return this.profiles.get(name) || null;
  }

  listProfiles(): SDKProfile[] {
    return Array.from(this.profiles.values());
  }

  setCurrentProfile(name: string | null): boolean {
    if (name !== null && !this.profiles.has(name)) {
      console.error(`[ConfigurationManager] Profile not found: ${name}`);
      return false;
    }

    this.currentProfile = name;

    try {
      const currentFile = path.join(this.configDir, 'current-profile');
      if (name) {
        fs.writeFileSync(currentFile, name);
      } else {
        if (fs.existsSync(currentFile)) {
          fs.unlinkSync(currentFile);
        }
      }
    } catch (error) {
      console.error('[ConfigurationManager] Failed to save current profile:', error);
    }

    console.log(`[ConfigurationManager] Current profile set to: ${name || 'none'}`);
    return true;
  }

  getCurrentProfile(): SDKProfile | null {
    return this.currentProfile ? this.profiles.get(this.currentProfile) || null : null;
  }

  getCurrentConfig(): KrabSDKConfig | null {
    const profile = this.getCurrentProfile();
    return profile ? profile.config : null;
  }

  // Environment configurations
  createEnvironmentConfig(env: keyof SDKEnvironment, config: KrabSDKConfig): void {
    const envFile = path.join(this.configDir, `${env}.json`);
    fs.writeFileSync(envFile, JSON.stringify(config, null, 2));
    console.log(`[ConfigurationManager] Environment config created: ${env}`);
  }

  getEnvironmentConfig(env: keyof SDKEnvironment): KrabSDKConfig | null {
    try {
      const envFile = path.join(this.configDir, `${env}.json`);
      if (fs.existsSync(envFile)) {
        return JSON.parse(fs.readFileSync(envFile, 'utf8'));
      }
    } catch (error) {
      console.error(`[ConfigurationManager] Failed to load environment config: ${env}`, error);
    }
    return null;
  }

  // Validation
  validateConfig(config: KrabSDKConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.apiUrl && !this.isValidUrl(config.apiUrl)) {
      errors.push('Invalid API URL format');
    }

    if (config.websocketUrl && !this.isValidUrl(config.websocketUrl)) {
      errors.push('Invalid WebSocket URL format');
    }

    if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
      errors.push('Timeout must be between 1000ms and 300000ms');
    }

    if (config.maxRetries && (config.maxRetries < 0 || config.maxRetries > 10)) {
      errors.push('Max retries must be between 0 and 10');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Import/Export
  exportProfiles(): string {
    const data = {
      profiles: Object.fromEntries(this.profiles),
      currentProfile: this.currentProfile,
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  importProfiles(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);

      if (data.profiles) {
        Object.entries(data.profiles).forEach(([name, profile]: [string, any]) => {
          this.profiles.set(name, {
            ...profile,
            createdAt: new Date(profile.createdAt),
            updatedAt: new Date(profile.updatedAt)
          });
        });
      }

      if (data.currentProfile) {
        this.setCurrentProfile(data.currentProfile);
      }

      this.saveProfiles();
      console.log(`[ConfigurationManager] Profiles imported successfully`);
      return true;
    } catch (error) {
      console.error('[ConfigurationManager] Failed to import profiles:', error);
      return false;
    }
  }

  // Utilities
  getConfigPath(): string {
    return this.configDir;
  }

  reset(): void {
    this.profiles.clear();
    this.currentProfile = null;
    this.saveProfiles();
    this.setCurrentProfile(null);
    console.log(`[ConfigurationManager] Configuration reset`);
  }
}

// ── Authentication Manager ───────────────────────────────────
export interface AuthCredentials {
  apiKey?: string;
  username?: string;
  password?: string;
  token?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export class AuthenticationManager {
  private configManager: ConfigurationManager;
  private credentials: AuthCredentials | null = null;

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
    this.loadCredentials();
  }

  private loadCredentials(): void {
    try {
      const credsFile = path.join(this.configManager.getConfigPath(), 'credentials.json');
      if (fs.existsSync(credsFile)) {
        this.credentials = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
        if (this.credentials.expiresAt) {
          this.credentials.expiresAt = new Date(this.credentials.expiresAt);
        }
      }
    } catch (error) {
      console.error('[AuthenticationManager] Failed to load credentials:', error);
    }
  }

  private saveCredentials(): void {
    try {
      const credsFile = path.join(this.configManager.getConfigPath(), 'credentials.json');
      if (this.credentials) {
        fs.writeFileSync(credsFile, JSON.stringify(this.credentials, null, 2));
      } else {
        if (fs.existsSync(credsFile)) {
          fs.unlinkSync(credsFile);
        }
      }
    } catch (error) {
      console.error('[AuthenticationManager] Failed to save credentials:', error);
    }
  }

  setCredentials(credentials: AuthCredentials): void {
    this.credentials = { ...credentials };
    this.saveCredentials();
    console.log(`[AuthenticationManager] Credentials updated`);
  }

  getCredentials(): AuthCredentials | null {
    return this.credentials ? { ...this.credentials } : null;
  }

  clearCredentials(): void {
    this.credentials = null;
    this.saveCredentials();
    console.log(`[AuthenticationManager] Credentials cleared`);
  }

  isAuthenticated(): boolean {
    if (!this.credentials) return false;

    if (this.credentials.expiresAt) {
      return new Date() < this.credentials.expiresAt;
    }

    return !!(this.credentials.apiKey || this.credentials.token);
  }

  getAuthHeaders(): { [key: string]: string } {
    const headers: { [key: string]: string } = {};

    if (this.credentials?.apiKey) {
      headers['X-API-Key'] = this.credentials.apiKey;
    }

    if (this.credentials?.token) {
      headers['Authorization'] = `Bearer ${this.credentials.token}`;
    }

    return headers;
  }

  async refreshToken(): Promise<boolean> {
    if (!this.credentials?.refreshToken) {
      console.error('[AuthenticationManager] No refresh token available');
      return false;
    }

    try {
      // TODO: Implement token refresh with Krab API
      // This would make a request to refresh the token
      console.log(`[AuthenticationManager] Token refresh not implemented yet`);
      return false;
    } catch (error) {
      console.error('[AuthenticationManager] Token refresh failed:', error);
      return false;
    }
  }
}

// Factory functions
export function createConfigurationManager(configDir?: string): ConfigurationManager {
  return new ConfigurationManager(configDir);
}

export function createAuthenticationManager(configManager: ConfigurationManager): AuthenticationManager {
  return new AuthenticationManager(configManager);
}

// Export types
export type { SDKEnvironment, SDKProfile };

// Default exports
export default ConfigurationManager;
