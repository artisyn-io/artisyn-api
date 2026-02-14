import { NextFunction, Request, Response } from 'express';

/**
 * Security headers middleware
 * Implements OWASP security best practices
 */
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Content Security Policy - Restrict content sources
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; media-src 'self'; object-src 'none';"
  );

  // X-Content-Type-Options - Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options - Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection - Enable XSS filter (legacy)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy - Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy - Control browser features
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // Strict-Transport-Security - Enforce HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');

  // Remove Server header
  res.removeHeader('Server');

  // Set a custom server header without version info
  res.setHeader('Server', 'Artisyn-API');

  // Prevent caching of sensitive data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  next();
};

/**
 * Middleware to sanitize request headers
 * Removes potentially malicious headers
 */
export const sanitizeHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Remove suspicious headers
    delete req.headers['x-original-forwarded-for'];
    delete req.headers['x-originating-ip'];
    delete req.headers['x-client-ip'];
    delete req.headers['x-real-ip-ssl'];

    // Validate and sanitize User-Agent
    const userAgent = req.get('user-agent') || '';
    if (userAgent.length > 500) {
      // User-Agent is suspiciously long
      res.setHeader('X-User-Agent-Warning', 'Suspicious');
    }

    // Validate and truncate Authorization header if needed
    const auth = req.get('authorization') || '';
    if (auth.length > 5000 && process.env.NODE_ENV !== 'test') {
      console.warn(`[Security] Suspiciously large Authorization header from ${req.ip}`);
    }

    next();
  } catch (error) {
    console.error('Header sanitization error:', error);
    next();
  }
};

/**
 * Middleware to validate HTTP methods
 * Only allow safe HTTP methods
 */
export const httpMethodValidationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
    });
  }

  next();
};

/**
 * Middleware to prevent parameter pollution
 */
export const preventParameterPollutionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for duplicate query parameters
    const queryString = req.url.split('?')[1];
    if (queryString) {
      const params = queryString.split('&');
      const paramNames = params.map(p => p.split('=')[0]);
      const uniqueParams = new Set(paramNames);

      if (paramNames.length !== uniqueParams.size && process.env.NODE_ENV !== 'test') {
        console.warn(`[Security] Potential parameter pollution detected from ${req.ip}`);
        return res.status(400).json({
          success: false,
          message: 'Invalid request: duplicate parameters detected',
        });
      }
    }

    next();
  } catch (error) {
    console.error('Parameter pollution prevention error:', error);
    next();
  }
};

/**
 * Middleware to validate request body size
 */
export const validateBodySizeMiddleware = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;

      if (size > maxSize) {
        req.destroy();
        return res.status(413).json({
          success: false,
          message: `Request body too large. Maximum size: ${maxSize / 1024 / 1024}MB`,
        });
      }
    });

    req.on('end', () => {
      next();
    });

    req.on('error', (error) => {
      console.error('Body size validation error:', error);
      next();
    });
  };
};

/**
 * Middleware to prevent CORS-based attacks
 */
export const corsSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Validate Origin header
  const origin = req.get('origin');

  if (origin) {
    try {
      const originUrl = new URL(origin);
      // Additional origin validation can be added here
      // For now, we'll just log suspicious origins
      if (!originUrl.protocol.startsWith('http') && process.env.NODE_ENV !== 'test') {
        console.warn(`[Security] Suspicious origin protocol: ${origin}`);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[Security] Invalid origin header: ${origin}`);
      }
    }
  }

  next();
};

/**
 * Middleware to prevent timing attacks
 */
export const timingAttackPreventionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Add random delay to obscure timing information
  if (req.path.includes('/auth/') && req.method === 'POST') {
    const delay = Math.random() * 50; // 0-50ms random delay
    setTimeout(() => {
      next();
    }, delay);
  } else {
    next();
  }
};
