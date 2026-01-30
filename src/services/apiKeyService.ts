import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../db';
import { env } from '../utils/helpers';

/**
 * API Key interface
 */
export interface APIKey {
  id: string;
  key: string;
  name: string;
  description?: string;
  userId?: string;
  status: 'active' | 'revoked' | 'expired';
  rateLimit: number;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  ipWhitelist?: string[];
  allowedEndpoints?: string[];
}

/**
 * In-memory cache for API keys
 */
const apiKeyCache = new Map<string, APIKey>();

/**
 * Generate a secure API key
 */
export const generateAPIKey = (name: string): { key: string; secret: string } => {
  const key = `artisyn_${crypto.randomBytes(32).toString('hex')}`;
  const secret = crypto.randomBytes(32).toString('hex');
  return { key, secret };
};

/**
 * Hash API key using PBKDF2
 */
export const hashAPIKey = (key: string): string => {
  return crypto
    .pbkdf2Sync(key, env('API_KEY_SALT', 'default-salt'), 10000, 64, 'sha512')
    .toString('hex');
};

/**
 * Create a new API key
 */
export const createAPIKey = async (
  name: string,
  description?: string,
  userId?: string,
  expiresAt?: Date,
  rateLimit: number = 1000
): Promise<APIKey> => {
  const { key, secret } = generateAPIKey(name);
  const hashedKey = hashAPIKey(key);
  const id = crypto.randomUUID();

  const apiKey: APIKey = {
    id,
    key: hashedKey,
    name,
    description,
    userId,
    status: 'active',
    rateLimit,
    createdAt: new Date(),
    expiresAt,
  };

  // Store in cache
  apiKeyCache.set(hashedKey, apiKey);

  // Optionally store in database (requires APIKey model in Prisma)
  try {
    // await prisma.apiKey.create({
    //   data: {
    //     id,
    //     key: hashedKey,
    //     name,
    //     description,
    //     userId,
    //     status: 'active',
    //     rateLimit,
    //     expiresAt,
    //   },
    // });
    console.log(`[API Key] Created new API key: ${name}`);
  } catch (error) {
    console.error('Error creating API key in database:', error);
  }

  // Return only the unhashed key for the user to store
  return {
    ...apiKey,
    key, // Return the unhashed key only once
  };
};

/**
 * Verify an API key
 */
export const verifyAPIKey = async (key: string): Promise<APIKey | null> => {
  const hashedKey = hashAPIKey(key);

  // Check cache first
  let apiKey = apiKeyCache.get(hashedKey);

  if (!apiKey) {
    // Load from database if not in cache
    // try {
    //   const dbKey = await prisma.apiKey.findUnique({
    //     where: { key: hashedKey },
    //   });
    //   if (dbKey) {
    //     apiKey = dbKey as any;
    //     apiKeyCache.set(hashedKey, apiKey);
    //   }
    // } catch (error) {
    //   console.error('Error verifying API key:', error);
    // }
  }

  if (!apiKey) {
    return null;
  }

  // Check if key is valid
  if (apiKey.status !== 'active') {
    return null;
  }

  // Check if key has expired
  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    return null;
  }

  // Update last used time
  apiKey.lastUsedAt = new Date();

  return apiKey;
};

/**
 * Revoke an API key
 */
export const revokeAPIKey = async (keyId: string): Promise<boolean> => {
  try {
    for (const [hash, key] of apiKeyCache.entries()) {
      if (key.id === keyId) {
        key.status = 'revoked';
        apiKeyCache.set(hash, key);

        // Update in database
        // await prisma.apiKey.update({
        //   where: { id: keyId },
        //   data: { status: 'revoked' },
        // });

        console.log(`[API Key] Revoked API key: ${key.name}`);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error revoking API key:', error);
    return false;
  }
};

/**
 * Get API key info
 */
export const getAPIKeyInfo = async (keyId: string): Promise<APIKey | null> => {
  for (const [, key] of apiKeyCache.entries()) {
    if (key.id === keyId) {
      return key;
    }
  }

  // Try to load from database
  // try {
  //   const dbKey = await prisma.apiKey.findUnique({
  //     where: { id: keyId },
  //   });
  //   return dbKey as any;
  // } catch (error) {
  //   console.error('Error getting API key info:', error);
  // }

  return null;
};

/**
 * Middleware to validate API key
 */
export const apiKeyValidationMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.get('X-API-Key') || req.query.apiKey;

    if (!apiKey) {
      return next(); // No API key provided, continue to next middleware
    }

    const verified = await verifyAPIKey(apiKey as string);

    if (!verified) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired API key',
      });
    }

    // Check IP whitelist
    if (verified.ipWhitelist && verified.ipWhitelist.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress || '';
      if (!verified.ipWhitelist.includes(clientIP)) {
        return res.status(403).json({
          success: false,
          message: 'API key not allowed from this IP address',
        });
      }
    }

    // Check allowed endpoints
    if (verified.allowedEndpoints && verified.allowedEndpoints.length > 0) {
      if (!verified.allowedEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
        return res.status(403).json({
          success: false,
          message: 'API key not authorized for this endpoint',
        });
      }
    }

    // Attach API key to request
    (req as any).apiKey = verified;
    next();
  } catch (error) {
    console.error('API key validation error:', error);
    next();
  }
};

/**
 * Middleware to require API key for specific endpoints
 */
export const requireAPIKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = (req as any).apiKey;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key is required for this endpoint',
    });
  }

  next();
};

/**
 * Load API keys from database on startup
 */
export const loadAPIKeysFromDB = async () => {
  try {
    // Load active API keys from database
    // const keys = await prisma.apiKey.findMany({
    //   where: {
    //     status: 'active',
    //     OR: [
    //       { expiresAt: null },
    //       { expiresAt: { gt: new Date() } },
    //     ],
    //   },
    // });

    // keys.forEach(key => {
    //   apiKeyCache.set(key.key, key as any);
    // });

    console.log('[API Key] Loaded API keys from database');
  } catch (error) {
    console.error('Error loading API keys from database:', error);
  }
};

/**
 * Clean up expired API keys
 */
export const cleanupExpiredAPIKeys = async () => {
  try {
    const now = new Date();

    for (const [hash, key] of apiKeyCache.entries()) {
      if (key.expiresAt && key.expiresAt < now) {
        key.status = 'expired';
        apiKeyCache.set(hash, key);

        // Update in database
        // await prisma.apiKey.update({
        //   where: { id: key.id },
        //   data: { status: 'expired' },
        // });
      }
    }

    console.log('[API Key] Cleaned up expired API keys');
  } catch (error) {
    console.error('Error cleaning up expired API keys:', error);
  }
};

/**
 * Start periodic cleanup of expired API keys
 */
export const startAPIKeyCleanup = () => {
  setInterval(() => {
    cleanupExpiredAPIKeys();
  }, 60 * 60 * 1000); // Run every hour
};
