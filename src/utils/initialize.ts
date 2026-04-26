import express, { Express } from "express";
import { facebookStrategy, googleStrategy } from "./passport";
import {
  ipBlockingMiddleware,
  recordFailedAttemptMiddleware,
  startIPBlockingCleanup,
} from "src/middleware/ipBlocking";
import {
  preventParameterPollutionMiddleware,
  sanitizeHeadersMiddleware,
  securityHeadersMiddleware,
  timingAttackPreventionMiddleware,
} from "src/middleware/securityHeaders";
import {
  rateLimitMiddleware,
  registerBypassToken,
  startRateLimitCleanup,
} from "src/middleware/rateLimiter";
import {
  requestLoggingMiddleware,
  startLogCleanupScheduler,
} from "src/utils/securityLogging";
import routes, { loadRoutes } from "src/routes/index";
import { ErrorHandler } from "./request-handlers";
import { analyticsMiddleware } from "./analyticsMiddleware";
import { apiKeyValidationMiddleware } from "src/services/apiKeyService";
import cors from "cors";
import { CorsOptions } from "cors";
import { env } from "./helpers";
import { fileURLToPath } from "url";
import logger from "pino-http";
import methodOverride from "method-override";
import passport from "passport";
import path from "path";
import { startAnalyticsScheduler } from "./analyticsScheduler";
import { startMediaScheduler } from "./mediaScheduler";
import { startMonitoringScheduler } from "src/services/monitoringService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CORS CONFIGURATION =====
const buildCorsOptions = (): CorsOptions => {
  const allowedOrigins = env("CORS_ALLOWED_ORIGINS")
    ? env("CORS_ALLOWED_ORIGINS")!.split(",").map((o) => o.trim())
    : [];

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.length === 0 ||
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-HTTP-Method"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 86400,
  };
};

export const initialize = async (app: Express) => {
  // ===== BODY PARSING MIDDLEWARE =====
  // Registered here only. Do not add body parsers in src/index.ts or any
  // other bootstrap file — duplicate registration causes unpredictable
  // request-processing behavior and makes middleware ordering harder to reason about.

  // Parse application/json
  app.use(express.json());

  // Parse application/x-www-form-urlencoded (for non-multipart forms)
  app.use(express.urlencoded({ extended: true }));

  // ===== SECURITY MIDDLEWARE =====

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

  // Initialize rate limit bypass tokens from environment
  const bypassTokensEnv = process.env.RATE_LIMIT_BYPASS_TOKENS || "";
  if (bypassTokensEnv) {
    const tokens = bypassTokensEnv.split(",").map((t: string) => t.trim());
    tokens.forEach((token: string) => {
      if (token) {
        registerBypassToken(token);
        console.log(`[Security] Registered rate limit bypass token`);
      }
    });
  }

  // API key validation
  app.use(apiKeyValidationMiddleware);

  // Request logging for security events
  app.use(requestLoggingMiddleware);

  // Record failed authentication attempts for IP blocking
  app.use(recordFailedAttemptMiddleware(["/auth/login", "/auth/register"]));

  // Method Override
  app.use(methodOverride("X-HTTP-Method"));

  // Route And Cors
  await loadRoutes(path.resolve(__dirname, "../routes"));
  app.use(cors(buildCorsOptions()));

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
  if (process.env.NODE_ENV !== "test") {
    console.log("[Security] Starting security services and schedulers...");
  }

  startRateLimitCleanup();
  startIPBlockingCleanup();
  startMonitoringScheduler();
  startLogCleanupScheduler();
  startAnalyticsScheduler();
  startMediaScheduler();

  if (process.env.NODE_ENV !== "test") {
    console.log("[Security] All security services initialized successfully");
  }

  // Error Handler
  app.use(ErrorHandler);

  // Logger
  if (env("NODE_ENV") !== "test") {
    app.use(logger());
  }
};