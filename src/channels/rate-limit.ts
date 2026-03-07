// ============================================================
// 🦀 Krab — Rate Limiting
// ============================================================
import { logger } from "../utils/logger.js";
import { z } from "zod";

export const RateLimitSchema = z.object({
  windowMs: z.number().positive(),
  maxRequests: z.number().positive(),
  keyGenerator: z.function().optional(),
  skipSuccessfulRequests: z.boolean().default(false),
  skipFailedRequests: z.boolean().default(false),
  handler: z.function().optional(),
});

export type RateLimitConfig = z.infer<typeof RateLimitSchema>;

export interface RateLimitInfo {
  totalHits: number;
  resetTime: Date;
  remaining: number;
  isLimited: boolean;
}

export class RateLimiter {
  private hits = new Map<string, { count: number; resetTime: number }>();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: config.windowMs || 60000,
      maxRequests: config.maxRequests || 100,
      skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
      skipFailedRequests: config.skipFailedRequests ?? false,
    };
    
    this.startCleanup();
  }

  check(key: string): RateLimitInfo {
    const now = Date.now();
    const record = this.hits.get(key);
    
    if (!record || record.resetTime < now) {
      const resetTime = new Date(now + this.config.windowMs);
      this.hits.set(key, { count: 1, resetTime: now + this.config.windowMs });
      
      return {
        totalHits: 1,
        resetTime,
        remaining: this.config.maxRequests - 1,
        isLimited: false,
      };
    }

    if (record.count >= this.config.maxRequests) {
      return {
        totalHits: record.count,
        resetTime: new Date(record.resetTime),
        remaining: 0,
        isLimited: true,
      };
    }

    record.count++;
    
    return {
      totalHits: record.count,
      resetTime: new Date(record.resetTime),
      remaining: this.config.maxRequests - record.count,
      isLimited: false,
    };
  }

  consume(key: string): { allowed: boolean; info: RateLimitInfo } {
    const info = this.check(key);
    
    if (info.isLimited) {
      logger.warn(`[RateLimiter] Rate limit exceeded for: ${key}`);
    }
    
    return { allowed: !info.isLimited, info };
  }

  reset(key: string): void {
    this.hits.delete(key);
    logger.debug(`[RateLimiter] Reset limit for: ${key}`);
  }

  resetAll(): void {
    this.hits.clear();
    logger.info("[RateLimiter] All limits reset");
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.windowMs);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, record] of this.hits) {
      if (record.resetTime < now) {
        this.hits.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`[RateLimiter] Cleaned up ${cleaned} expired entries`);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.hits.clear();
  }
}

// ── Token Bucket ───────────────────────────────────────────────

export interface TokenBucketConfig {
  capacity: number;
  refillRate: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private config: TokenBucketConfig;

  constructor(config: TokenBucketConfig) {
    this.config = config;
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
  }

  consume(tokens = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = (elapsed / 1000) * this.config.refillRate;
    
    this.tokens = Math.min(this.config.capacity, this.tokens + newTokens);
    this.lastRefill = now;
  }

  getTokens(): number {
    this.refill();
    return this.tokens;
  }

  reset(): void {
    this.tokens = this.config.capacity;
    this.lastRefill = Date.now();
  }
}

// ── Channel Rate Limiter ────────────────────────────────────────

export interface ChannelRateLimitConfig {
  user?: RateLimitConfig;
  channel?: RateLimitConfig;
  group?: RateLimitConfig;
}

export class ChannelRateLimiter {
  private userLimiter: RateLimiter;
  private channelLimiter: RateLimiter;
  private groupLimiter: RateLimiter;

  constructor(config: ChannelRateLimitConfig = {}) {
    this.userLimiter = new RateLimiter(config.user || { windowMs: 60000, maxRequests: 30 });
    this.channelLimiter = new RateLimiter(config.channel || { windowMs: 60000, maxRequests: 100 });
    this.groupLimiter = new RateLimiter(config.group || { windowMs: 60000, maxRequests: 50 });
  }

  checkUser(userId: string): RateLimitInfo {
    return this.userLimiter.check(userId);
  }

  checkChannel(channelId: string): RateLimitInfo {
    return this.channelLimiter.check(channelId);
  }

  checkGroup(groupId: string): RateLimitInfo {
    return this.groupLimiter.check(groupId);
  }

  checkAll(userId: string, channelId: string, groupId?: string): {
    allowed: boolean;
    user: RateLimitInfo;
    channel: RateLimitInfo;
    group?: RateLimitInfo;
  } {
    const user = this.userLimiter.check(userId);
    const channel = this.channelLimiter.check(channelId);
    const group = groupId ? this.groupLimiter.check(groupId) : undefined;

    const allowed = !user.isLimited && !channel.isLimited && !(group?.isLimited);

    return { allowed, user, channel, group };
  }

  consumeUser(userId: string): { allowed: boolean; info: RateLimitInfo } {
    return this.userLimiter.consume(userId);
  }

  resetUser(userId: string): void {
    this.userLimiter.reset(userId);
  }

  resetAll(): void {
    this.userLimiter.resetAll();
    this.channelLimiter.resetAll();
    this.groupLimiter.resetAll();
  }

  destroy(): void {
    this.userLimiter.destroy();
    this.channelLimiter.destroy();
    this.groupLimiter.destroy();
  }
}

// ── Distributed Rate Limiter (Redis-based) ─────────────────────

export interface RedisRateLimiterConfig {
  redis: any;
  keyPrefix: string;
  windowMs: number;
  maxRequests: number;
}

export class RedisRateLimiter {
  private config: RedisRateLimiterConfig;

  constructor(config: RedisRateLimiterConfig) {
    this.config = config;
  }

  async check(key: string): Promise<RateLimitInfo> {
    const redisKey = `${this.config.keyPrefix}:${key}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      const redis = this.config.redis;
      
      await redis.multi()
        .zremrangebyscore(redisKey, 0, windowStart)
        .zcard(redisKey)
        .zadd(redisKey, now, `${now}`)
        .pexpire(redisKey, this.config.windowMs)
        .exec();

      const result = await redis.zcard(redisKey);
      const count = result[1];
      const remaining = Math.max(0, this.config.maxRequests - count);

      return {
        totalHits: count,
        resetTime: new Date(now + this.config.windowMs),
        remaining,
        isLimited: count > this.config.maxRequests,
      };
    } catch (error) {
      logger.error("[RedisRateLimiter] Error:", error);
      return {
        totalHits: 0,
        resetTime: new Date(now + this.config.windowMs),
        remaining: this.config.maxRequests,
        isLimited: false,
      };
    }
  }

  async consume(key: string): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const info = await this.check(key);
    return { allowed: !info.isLimited, info };
  }
}
