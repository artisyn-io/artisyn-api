import express, { Express } from "express";
import { facebookStrategy, googleStrategy } from "./passport";
import routes, { loadRoutes } from "src/routes/index";

import { ErrorHandler } from "./request-handlers";
import { analyticsMiddleware } from "./analyticsMiddleware";
import { startAnalyticsScheduler } from "./analyticsScheduler";
import { startMediaScheduler } from "./mediaScheduler";
import cors from "cors";
import { env } from "./helpers";
import { fileURLToPath } from "url";
import logger from "pino-http";
import methodOverride from "method-override";
import passport from "passport";
import path from "path";

// Security imports
import { rateLimitMiddleware, startRateLimitCleanup } from "src/middleware/rateLimiter";
import { ipBlockingMiddleware, recordFailedAttemptMiddleware, startIPBlockingCleanup, loadBlockedIPsFromDB } from "src/middleware/ipBlocking";
import { securityHeadersMiddleware, sanitizeHeadersMiddleware, preventParameterPollutionMiddleware, timingAttackPreventionMiddleware } from "src/middleware/securityHeaders";
import { apiKeyValidationMiddleware } from "src/services/apiKeyService";
import { startMonitoringScheduler } from "src/services/monitoringService";
import { requestLoggingMiddleware, startLogCleanupScheduler } from "src/utils/securityLogging";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const initialize = async (app: Express) => {
  // ===== SECURITY MIDDLEWARE (Must be first) =====
  
  // Security headers - protects against common vulnerabilities
  app.use(securityHeadersMiddleware);
  
  // Sanitize request headers
  app.use(sanitizeHeadersMiddleware);
  
  // IP blocking - blocks IPs with suspicious behavior
  app.use(ipBlockingMiddleware);
  
  // Prevent parameter pollution attacks
  app.use(preventParameterPollutionMiddleware);
  
  // Timing attack prevention for auth endpoints
  app.use(timingAttackPreventionMiddleware);
  
  // Rate limiting middleware - tiered by user type
  app.use(rateLimitMiddleware);
  
  // API key validation
  app.use(apiKeyValidationMiddleware);
  
  // Request logging for security events
  app.use(requestLoggingMiddleware);
  
  // Record failed authentication attempts for IP blocking
  app.use(recordFailedAttemptMiddleware(['/auth/login', '/auth/register']));

  // Parse application/json
  app.use(express.json());

  // Parse application/x-www-form-urlencoded (for non-multipart forms)
  app.use(express.urlencoded({ extended: true }));

  // Method Override
  app.use(methodOverride("X-HTTP-Method"));

  // Route And Cors
  await loadRoutes(path.resolve(__dirname, "../routes"));
  app.use(cors());

  // Passport
  if (env("GOOGLE_CLIENT_ID")) {
    passport.use(googleStrategy());
  }
  if (env("FACEBOOK_CLIENT_ID")) {
    passport.use(facebookStrategy());
  }

  // Initialize Passport
  app.use(passport.initialize());

  // Analytics Middleware - Track API calls before routing
  app.use(analyticsMiddleware);

  // Routes
  app.use(routes);

  // Initialize Schedulers and Security Services
  console.log('[Security] Starting security services and schedulers...');
  
  // Start rate limit cleanup
  startRateLimitCleanup();
  
  // Start IP blocking cleanup
  startIPBlockingCleanup();
  
  // Load previously blocked IPs from database
  await loadBlockedIPsFromDB();
  
  // Start monitoring scheduler
  startMonitoringScheduler();
  
  // Start log cleanup scheduler
  startLogCleanupScheduler();
  
  // Start analytics and media schedulers
  startAnalyticsScheduler();
  startMediaScheduler();
  
  console.log('[Security] All security services initialized successfully');

  // Error Handler
  app.use(ErrorHandler);

  // Logger
  if (env("NODE_ENV") !== "test") {
    app.use(logger());
  }
};
