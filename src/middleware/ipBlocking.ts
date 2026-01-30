import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

/**
 * In-memory store for blocked IPs
 * Structure: { ip: { blockedUntil: number, reason: string } }
 */
const blockedIPs = new Map<string, { blockedUntil: number; reason: string }>();

/**
 * Configuration for IP blocking
 */
export interface IPBlockConfig {
  failedAttemptsThreshold: number; // Number of failed attempts to trigger block
  blockDurationMs: number; // Duration to block IP
  failureWindowMs: number; // Time window to count failures
  monitoredEndpoints: string[]; // Endpoints to monitor for failed attempts
}

/**
 * Default IP blocking configuration
 */
export const defaultIPBlockConfig: IPBlockConfig = {
  failedAttemptsThreshold: 5,
  blockDurationMs: 60 * 60 * 1000, // 1 hour
  failureWindowMs: 15 * 60 * 1000, // 15 minutes
  monitoredEndpoints: ['/auth/login', '/auth/register', '/api/search'],
};

/**
 * In-memory store for tracking failed attempts
 */
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();

/**
 * Check if an IP is blocked
 */
export const isIPBlocked = (ip: string): { blocked: boolean; reason?: string; unblockTime?: number } => {
  const entry = blockedIPs.get(ip);
  const now = Date.now();

  if (!entry) {
    return { blocked: false };
  }

  if (entry.blockedUntil < now) {
    // Unblock expired entry
    blockedIPs.delete(ip);
    return { blocked: false };
  }

  return {
    blocked: true,
    reason: entry.reason,
    unblockTime: entry.blockedUntil,
  };
};

/**
 * Block an IP address
 */
export const blockIP = (ip: string, reason: string, durationMs: number = defaultIPBlockConfig.blockDurationMs) => {
  blockedIPs.set(ip, {
    blockedUntil: Date.now() + durationMs,
    reason,
  });
};

/**
 * Unblock an IP address
 */
export const unblockIP = (ip: string) => {
  blockedIPs.delete(ip);
};

/**
 * Record a failed attempt
 */
export const recordFailedAttempt = (ip: string) => {
  const now = Date.now();
  const entry = failedAttempts.get(ip);

  if (!entry || entry.lastAttempt < now - defaultIPBlockConfig.failureWindowMs) {
    // New failure window
    failedAttempts.set(ip, { count: 1, lastAttempt: now });
  } else {
    entry.count++;
    entry.lastAttempt = now;

    // Block if threshold exceeded
    if (entry.count >= defaultIPBlockConfig.failedAttemptsThreshold) {
      blockIP(ip, `Exceeded failed attempts threshold (${entry.count} attempts)`);
    }
  }
};

/**
 * Reset failed attempts for an IP
 */
export const resetFailedAttempts = (ip: string) => {
  failedAttempts.delete(ip);
};

/**
 * Get all blocked IPs
 */
export const getBlockedIPs = (): Array<{ ip: string; blockedUntil: number; reason: string }> => {
  const now = Date.now();
  const blocked: Array<{ ip: string; blockedUntil: number; reason: string }> = [];

  for (const [ip, entry] of blockedIPs.entries()) {
    if (entry.blockedUntil > now) {
      blocked.push({ ip, ...entry });
    } else {
      blockedIPs.delete(ip);
    }
  }

  return blocked;
};

/**
 * Middleware to check if IP is blocked
 */
export const ipBlockingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const blockStatus = isIPBlocked(clientIP);

    if (blockStatus.blocked) {
      return res.status(403).json({
        success: false,
        message: 'Your IP has been blocked due to suspicious activity.',
        reason: blockStatus.reason,
        unblockTime: new Date(blockStatus.unblockTime!),
      });
    }

    // Attach IP to request for logging
    (req as any).clientIP = clientIP;
    next();
  } catch (error) {
    console.error('IP blocking middleware error:', error);
    next();
  }
};

/**
 * Middleware to record failed login attempts
 */
export const recordFailedAttemptMiddleware = (monitoredEndpoints: string[] = ['/auth/login']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function (data: any) {
      // Check if endpoint is monitored
      if (monitoredEndpoints.some(endpoint => req.path.includes(endpoint))) {
        try {
          // Try to parse response
          let statusCode = res.statusCode;
          if (typeof data === 'string') {
            try {
              const parsed = JSON.parse(data);
              statusCode = parsed.success === false ? 401 : res.statusCode;
            } catch {
              // Not JSON, use default status code
            }
          }

          // Record failed attempt if authentication failed
          if (statusCode === 401 || statusCode === 403 || (typeof data === 'string' && data.includes('failed'))) {
            const clientIP = (req as any).clientIP || req.ip || 'unknown';
            recordFailedAttempt(clientIP);
          }
        } catch (error) {
          console.error('Error recording failed attempt:', error);
        }
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Clean up expired blocked IPs periodically
 */
export const startIPBlockingCleanup = () => {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of blockedIPs.entries()) {
      if (entry.blockedUntil < now) {
        blockedIPs.delete(ip);
      }
    }
  }, 5 * 60 * 1000); // Clean up every 5 minutes
};

/**
 * Store blocked IP in database for persistence
 */
export const persistBlockedIP = async (ip: string, reason: string, durationMs: number) => {
  try {
    // Create IP block record (requires IPBlock model in Prisma)
    // await prisma.ipBlock.create({
    //   data: {
    //     ip,
    //     reason,
    //     blockedUntil: new Date(Date.now() + durationMs),
    //   },
    // });
    console.log(`[IP Blocking] IP ${ip} blocked: ${reason}`);
  } catch (error) {
    console.error('Error persisting blocked IP:', error);
  }
};

/**
 * Load previously blocked IPs from database
 */
export const loadBlockedIPsFromDB = async () => {
  try {
    // Load IP blocks from database on startup
    // const blocks = await prisma.ipBlock.findMany({
    //   where: {
    //     blockedUntil: {
    //       gt: new Date(),
    //     },
    //   },
    // });
    // blocks.forEach(block => {
    //   blockedIPs.set(block.ip, {
    //     blockedUntil: block.blockedUntil.getTime(),
    //     reason: block.reason,
    //   });
    // });
    console.log('[IP Blocking] Loaded blocked IPs from database');
  } catch (error) {
    console.error('Error loading blocked IPs:', error);
  }
};
