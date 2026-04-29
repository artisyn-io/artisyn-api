import { NextFunction, Request, Response } from 'express';

import { env } from '../utils/helpers';

/**
 * In-memory store for rate limiting
 * Structure: { key: { count: number, resetTime: number } }
 */
export const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Set of authorized bypass tokens (hashed)
 * These should be scoped, auditable credentials separate from JWT_SECRET
 */
const authorizedBypassTokens = new Set<string>();

/**
 * Register an authorized bypass token
 * @param token - The bypass token to register
 */
export const registerBypassToken = (token: string): void => {
  // Store hashed token for security
  const hash = require('crypto').createHash('sha256').update(token).digest('hex');
  authorizedBypassTokens.add(hash);
};

/**
 * Remove an authorized bypass token
 * @param token - The bypass token to remove
 */
export const revokeBypassToken = (token: string): void => {
  const hash = require('crypto').createHash('sha256').update(token).digest('hex');
  authorizedBypassTokens.delete(hash);
};

/**
 * Validate if a bypass token is authorized
 * @param token - The bypass token to validate
 * @returns boolean - Whether the token is authorized
 */
const isValidBypassToken = (token: string | undefined): boolean => {
  if (!token) return false;
  const hash = require('crypto').createHash('sha256').update(token).digest('hex');
  return authorizedBypassTokens.has(hash);
};

/**
 * Rate limit configuration for different user types
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Function to generate unique key
  handler?: (req: Request, res: Response) => void; // Custom handler for rate limit exceeded
  skip?: (req: Request) => boolean; // Skip rate limiting for certain requests
}

/**
 * Default rate limit configurations
 */
export const rateLimitConfigs = {
  // Strict limits for unauthenticated users
  public: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50,
  },
  // Moderate limits for authenticated users
  authenticated: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 200,
  },
  // Loose limits for premium users
  premium: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
  },
  // Very strict limits for suspicious IPs
  suspicious: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
  },
  // Limits for auth endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  // Limits for search endpoints
  search: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 30,
  },
  // Account linking operations: 10 per hour (documented contract)
  accountLinking: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
  },
  // Privacy update operations: 20 per hour (documented contract)
  privacyUpdates: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
  },
};

/**
 * Clean up old entries from the rate limit store
 */
export const cleanupRateLimit = () => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
};

/**
 * Core rate limiting logic
 */
export const checkRateLimit = (
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; retryAfter: number } => {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Reset entry
    const newEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      retryAfter: 0,
    };
  }

  if (entry.count < config.maxRequests) {
    entry.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      retryAfter: 0,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    retryAfter: Math.ceil((entry.resetTime - now) / 1000),
  };
};

/**
 * Create a rate limiting middleware
 */
export const createRateLimiter = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if configured
      if (config.skip && config.skip(req)) {
        return next();
      }

      // Generate unique key
      const key = config.keyGenerator ? config.keyGenerator(req) : req.ip || 'unknown';

      // Check rate limit
      const result = checkRateLimit(key, config);

      // Set response headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + config.windowMs).toISOString());

      // Skip rate limiting only for authorized bypass tokens
      // This uses scoped credentials that are auditable and separate from JWT_SECRET
      if (!result.allowed && !isValidBypassToken(req.header('x-bypass-token'))) {
        res.setHeader('Retry-After', result.retryAfter);

        if (config.handler) {
          return config.handler(req, res);
        }

        return res.status(429).json({
          success: false,
          message: 'Too many requests, please try again later.',
          retryAfter: result.retryAfter,
        });
      }

      next();
    } catch (error) {
      // Log error but don't block request
      console.error('Rate limit error:', error);
      next();
    }
  };
};

/**
 * Determine user tier based on request context
 */
export const getUserTier = (req: Request): 'public' | 'authenticated' | 'premium' => {
  if (!req.user) {
    return 'public';
  }

  // Check if user has premium status (extend based on your model)
  if ((req.user as any).isPremium || (req.user as any).subscriptionStatus === 'premium') {
    return 'premium';
  }

  return 'authenticated';
};

/**
 * Get appropriate rate limit config based on user tier and route
 */
export const getRouteLimitConfig = (req: Request, route: string): RateLimitConfig => {
  const userTier = getUserTier(req);
  const baseConfig = rateLimitConfigs.public;
  let selectedConfig = rateLimitConfigs[userTier as keyof typeof rateLimitConfigs] || baseConfig;

  // Override for specific routes
  if (route.includes('/auth/') || route.includes('/login') || route.includes('/register')) {
    selectedConfig = rateLimitConfigs.auth;
  } else if (route.includes('/search') || route.includes('/artisans')) {
    selectedConfig = rateLimitConfigs.search;
  }

  return {
    ...selectedConfig,
    keyGenerator: getRequestRateLimitKey,
  };
};

/**
 * Generate a stable rate-limit key before auth middleware has populated req.user.
 * If an Authorization header is present, scope the bucket to that caller instead
 * of collapsing every authenticated request onto the shared test runner IP.
 */
export const getRequestRateLimitKey = (req: Request): string => {
  if (req.user) {
    return `user-${(req.user as any).id}`;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (token) {
    return `token-${token}`;
  }

  return `ip-${req.ip}`;
};

/**
 * Rate limiter for account-linking write operations (10 per hour per user)
 */
export const accountLinkingRateLimiter = createRateLimiter({
  windowMs: rateLimitConfigs.accountLinking.windowMs,
  maxRequests: rateLimitConfigs.accountLinking.maxRequests,
  keyGenerator: getRequestRateLimitKey,
});

/**
 * Rate limiter for privacy update operations (20 per hour per user)
 */
export const privacyRateLimiter = createRateLimiter({
  windowMs: rateLimitConfigs.privacyUpdates.windowMs,
  maxRequests: rateLimitConfigs.privacyUpdates.maxRequests,
  keyGenerator: getRequestRateLimitKey,
});

/**
 * Middleware to apply rate limiting with automatic cleanup
 */
export const rateLimitMiddleware = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: getRequestRateLimitKey,
});

/**
 * Periodic cleanup of expired rate limit entries
 */
export const startRateLimitCleanup = () => {
  // Clean up every 5 minutes
  setInterval(() => {
    cleanupRateLimit();
  }, 5 * 60 * 1000);
};
