import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { logger } from '../utils/logger';

// Create a cache instance for rate limiting
const rateLimitCache = new NodeCache({ stdTTL: 60 }); // 60 second window

interface RateLimitConfig {
  windowMs?: number; // Time window in milliseconds (default: 60000 = 1 minute)
  maxRequests?: number; // Max requests per window (default: 100)
  skipJWT?: boolean; // Skip rate limiting for JWT auth (default: true)
}

export const apiKeyRateLimit = (config: RateLimitConfig = {}) => {
  const { windowMs = 60000, maxRequests = 100, skipJWT = true } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting if it's JWT auth and skipJWT is true
    if (skipJWT && !(req as any).isApiKeyAuth) {
      return next();
    }

    // Only apply rate limiting to API key authentication
    if (!(req as any).isApiKeyAuth) {
      return next();
    }

    const apiKeyId = (req as any).apiKeyId;
    if (!apiKeyId) {
      return next();
    }

    const key = `rate_limit_${apiKeyId}`;
    const currentCount = rateLimitCache.get<number>(key) || 0;

    if (currentCount >= maxRequests) {
      logger.warn('API key rate limit exceeded', {
        apiKeyId,
        currentCount,
        maxRequests,
      });

      return res.status(429).json({
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000), // seconds
      });
    }

    // Increment the counter
    rateLimitCache.set(key, currentCount + 1, Math.ceil(windowMs / 1000));

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader(
      'X-RateLimit-Remaining',
      (maxRequests - currentCount - 1).toString(),
    );
    res.setHeader(
      'X-RateLimit-Reset',
      new Date(Date.now() + windowMs).toISOString(),
    );

    next();
  };
};

