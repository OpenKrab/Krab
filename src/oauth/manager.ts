// ============================================================
// 🦀 Krab — OAuth Manager (Token Management & Authentication)
// ============================================================
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { logger } from "../utils/logger.js";

export interface OAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_at?: number; // Unix timestamp
  token_type?: string;
  scope?: string;
}

export interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export interface AuthProfile {
  id: string;
  provider: string;
  type: "oauth" | "api_key" | "setup_token";
  tokens?: OAuthToken;
  api_key?: string;
  setup_token?: string;
  created_at: number;
  updated_at: number;
  expires_at?: number;
}

export interface OAuthConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  tokenUrl?: string;
  authUrl?: string;
}

export class OAuthManager {
  private profilesPath: string;
  private profiles: Map<string, AuthProfile> = new Map();
  private configs: Map<string, OAuthConfig> = new Map();

  constructor() {
    this.profilesPath = path.join(os.homedir(), ".krab", "auth-profiles.json");
    this.loadProfiles();
    this.initializeProviderConfigs();
  }

  /**
   * Initialize OAuth configurations for different providers
   */
  private initializeProviderConfigs(): void {
    // Anthropic
    this.configs.set("anthropic", {
      scopes: ["claude"],
      // Anthropic uses setup-token flow, not standard OAuth
    });

    // OpenAI
    this.configs.set("openai", {
      clientId: process.env.OPENAI_CLIENT_ID,
      clientSecret: process.env.OPENAI_CLIENT_SECRET,
      scopes: ["openid", "email", "profile"],
      authUrl: "https://auth.openai.com/authorize",
      tokenUrl: "https://auth.openai.com/token"
    });

    // Google (Gemini)
    this.configs.set("google", {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      authUrl: "https://accounts.google.com/oauth/authorize",
      tokenUrl: "https://oauth2.googleapis.com/token"
    });
  }

  /**
   * Add or update an auth profile
   */
  addProfile(profile: Omit<AuthProfile, "created_at" | "updated_at">): void {
    const now = Date.now();
    const existing = this.profiles.get(profile.id);

    const fullProfile: AuthProfile = {
      ...profile,
      created_at: existing?.created_at || now,
      updated_at: now,
      expires_at: this.calculateExpiry(profile.tokens)
    };

    this.profiles.set(profile.id, fullProfile);
    this.saveProfiles();

    logger.info(`[OAuth] Added/updated profile: ${profile.id} (${profile.provider})`);
  }

  /**
   * Get auth profile by ID
   */
  getProfile(id: string): AuthProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Get all profiles for a provider
   */
  getProfilesByProvider(provider: string): AuthProfile[] {
    return Array.from(this.profiles.values())
      .filter(profile => profile.provider === provider);
  }

  /**
   * Get all auth profiles
   */
  getAllProfiles(): AuthProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Remove an auth profile
   */
  removeProfile(id: string): boolean {
    const removed = this.profiles.delete(id);
    if (removed) {
      this.saveProfiles();
      logger.info(`[OAuth] Removed profile: ${id}`);
    }
    return removed;
  }

  /**
   * Check if a token is expired or about to expire
   */
  isTokenExpired(profileId: string, bufferMinutes = 5): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile?.tokens?.expires_at) return false;

    const bufferTime = bufferMinutes * 60 * 1000;
    return Date.now() + bufferTime >= profile.tokens.expires_at;
  }

  /**
   * Refresh an OAuth token
   */
  async refreshToken(profileId: string): Promise<boolean> {
    const profile = this.profiles.get(profileId);
    if (!profile?.tokens?.refresh_token) {
      logger.warn(`[OAuth] No refresh token available for profile: ${profileId}`);
      return false;
    }

    const config = this.configs.get(profile.provider);
    if (!config?.tokenUrl) {
      logger.warn(`[OAuth] No token URL configured for provider: ${profile.provider}`);
      return false;
    }

    try {
      const response = await fetch(config.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: profile.tokens.refresh_token,
          client_id: config.clientId || "",
          client_secret: config.clientSecret || "",
        }),
      });

      if (!response.ok) {
        logger.error(`[OAuth] Token refresh failed: ${response.status}`);
        return false;
      }

      const tokenData: OAuthTokenResponse = await response.json();
      const newTokens: OAuthToken = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || profile.tokens.refresh_token,
        expires_at: tokenData.expires_in
          ? Date.now() + (tokenData.expires_in * 1000)
          : undefined,
        token_type: tokenData.token_type,
        scope: tokenData.scope,
      };

      profile.tokens = newTokens;
      profile.updated_at = Date.now();
      profile.expires_at = this.calculateExpiry(newTokens);

      this.saveProfiles();
      logger.info(`[OAuth] Refreshed token for profile: ${profileId}`);
      return true;

    } catch (error) {
      logger.error(`[OAuth] Token refresh error:`, error);
      return false;
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidToken(profileId: string): Promise<string | null> {
    const profile = this.profiles.get(profileId);
    if (!profile) return null;

    // For API keys and setup tokens, return directly
    if (profile.api_key) return profile.api_key;
    if (profile.setup_token) return profile.setup_token;

    // For OAuth tokens, check expiry and refresh if needed
    if (profile.tokens) {
      if (this.isTokenExpired(profileId)) {
        const refreshed = await this.refreshToken(profileId);
        if (!refreshed) return null;
      }
      return profile.tokens.access_token;
    }

    return null;
  }

  /**
   * Add an API key profile
   */
  addApiKeyProfile(id: string, provider: string, apiKey: string): void {
    this.addProfile({
      id,
      provider,
      type: "api_key",
      api_key: apiKey,
    });
  }

  /**
   * Add a setup token profile (for Anthropic)
   */
  addSetupTokenProfile(id: string, setupToken: string): void {
    this.addProfile({
      id,
      provider: "anthropic",
      type: "setup_token",
      setup_token: setupToken,
    });
  }

  /**
   * Add an OAuth profile with tokens
   */
  addOAuthProfile(id: string, provider: string, tokens: OAuthToken): void {
    this.addProfile({
      id,
      provider,
      type: "oauth",
      tokens,
    });
  }

  private loadProfiles(): void {
    try {
      if (fs.existsSync(this.profilesPath)) {
        const data = JSON.parse(fs.readFileSync(this.profilesPath, "utf8"));
        for (const [id, profile] of Object.entries(data)) {
          this.profiles.set(id, profile as AuthProfile);
        }
        logger.debug(`[OAuth] Loaded ${this.profiles.size} auth profiles`);
      }
    } catch (error) {
      logger.warn("[OAuth] Failed to load auth profiles:", error);
    }
  }

  private saveProfiles(): void {
    try {
      const data: Record<string, AuthProfile> = {};
      for (const [id, profile] of this.profiles.entries()) {
        data[id] = profile;
      }
      fs.writeFileSync(this.profilesPath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error("[OAuth] Failed to save auth profiles:", error);
    }
  }

  private calculateExpiry(tokens?: OAuthToken): number | undefined {
    if (!tokens?.expires_at) return undefined;
    return tokens.expires_at;
  }
}

// Export singleton instance
export const oauthManager = new OAuthManager();
