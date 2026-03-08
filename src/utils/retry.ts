// ============================================================
// 🦀 Krab — Retry Utility (Exponential Backoff with Jitter)
// ============================================================
import { logger } from "./logger.js";

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableErrors?: (error: any) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: any;
  attempts: number;
  totalDelay: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryableErrors: (error) => {
    // Default retryable errors: network errors, 5xx status codes
    if (error?.name === 'AbortError' || /aborted/i.test(String(error?.message || ''))) {
      return false;
    }
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    if (error.status && error.status >= 500) {
      return true;
    }
    return false;
  }
};

/**
 * Retry a function with exponential backoff and jitter
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: any;
  let totalDelay = 0;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return {
        success: true,
        result,
        attempts: attempt,
        totalDelay
      };
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!finalConfig.retryableErrors!(error)) {
        logger.debug(`[Retry] Error not retryable: ${error.message}`);
        break;
      }

      // Don't delay on the last attempt
      if (attempt === finalConfig.maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      const baseDelay = Math.min(
        finalConfig.initialDelay * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
        finalConfig.maxDelay
      );

      // Add jitter
      const jitter = baseDelay * finalConfig.jitterFactor * (Math.random() * 2 - 1);
      const delay = Math.max(0, baseDelay + jitter);

      logger.debug(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`);

      await sleep(delay);
      totalDelay += delay;
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: finalConfig.maxAttempts,
    totalDelay
  };
}

/**
 * Retry configuration for different channels
 */
export const CHANNEL_RETRY_CONFIGS: Record<string, Partial<RetryConfig>> = {
  telegram: {
    initialDelay: 400,
    maxAttempts: 3
  },
  discord: {
    initialDelay: 500,
    maxAttempts: 3
  },
  whatsapp: {
    initialDelay: 1000,
    maxAttempts: 3
  },
  default: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.1
  }
};

/**
 * Get retry config for a specific channel
 */
export function getChannelRetryConfig(channelName: string): RetryConfig {
  const channelConfig = CHANNEL_RETRY_CONFIGS[channelName] || {};
  return { ...DEFAULT_CONFIG, ...channelConfig };
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry HTTP requests with channel-specific configuration
 */
export async function retryHttpRequest<T>(
  url: string,
  options: RequestInit & { signal?: AbortSignal },
  channelName?: string
): Promise<RetryResult<T>> {
  const config = getChannelRetryConfig(channelName || 'default');

  return withRetry(async () => {
    const response = await fetch(url, options);

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      (error as any).status = response.status;
      throw error;
    }

    return response.json() as Promise<T>;
  }, config);
}

/**
 * Retry any async operation with channel-specific configuration
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  channelName?: string
): Promise<RetryResult<T>> {
  const config = getChannelRetryConfig(channelName || 'default');
  return withRetry(operation, config);
}
