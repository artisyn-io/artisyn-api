import express, { Express } from "express"
import { facebookStrategy, googleStrategy } from './passport';
import routes, { loadRoutes } from 'src/routes/index';

import { ErrorHandler } from "./request-handlers";
import { analyticsMiddleware } from './analyticsMiddleware';
import { startAnalyticsScheduler } from './analyticsScheduler';
import { startMediaScheduler } from './mediaScheduler';
import cors from 'cors';
import { env } from './helpers';
import { fileURLToPath } from "url";
import logger from 'pino-http';
import methodOverride from 'method-override';
import passport from 'passport';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const initialize = async (app: Express) => {
    // Parse application/x-www-form-urlencoded (for non-multipart forms)
    app.use(express.urlencoded({ extended: true }));

    // Method Override 
    app.use(methodOverride('X-HTTP-Method'))

    // Route And Cors
    await loadRoutes(path.resolve(__dirname, '../routes'));
    app.use(cors());

    // Analytics Middleware - Track API calls before routing
    app.use(analyticsMiddleware);

    app.use(routes);

    // Initialize Analytics Scheduler for automatic report generation
    startAnalyticsScheduler();

    // Start Media Scheduler for orphaned files cleanup
    startMediaScheduler();

    // Passport
    if (env('GOOGLE_CLIENT_ID')) {
        passport.use(googleStrategy())
    }
    if (env('FACEBOOK_CLIENT_ID')) {
        passport.use(facebookStrategy())
    }

    // Initialize 
    app.use(passport.initialize());

    // Error Handler
    app.use(ErrorHandler)

    // Logger
    if (env('NODE_ENV') !== 'test') {
        app.use(logger())
    }
}

