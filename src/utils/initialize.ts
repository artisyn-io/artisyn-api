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
    // Parse application/json
    app.use(express.json());

    // Parse application/x-www-form-urlencoded (for non-multipart forms)
    app.use(express.urlencoded({ extended: true }));

    // Method Override 
    app.use(methodOverride('X-HTTP-Method'))

    // Route And Cors
    await loadRoutes(path.resolve(__dirname, '../routes'));
    app.use(cors());

    // Passport
    if (env('GOOGLE_CLIENT_ID')) {
        passport.use(googleStrategy())
    }
    if (env('FACEBOOK_CLIENT_ID')) {
        passport.use(facebookStrategy())
    }

    // Initialize Passport
    app.use(passport.initialize());

    // Analytics Middleware - Track API calls before routing
    app.use(analyticsMiddleware);

    // Routes
    app.use(routes);

    // Initialize Schedulers
    startAnalyticsScheduler();
    startMediaScheduler();

    // Error Handler
    app.use(ErrorHandler)

    // Logger
    if (env('NODE_ENV') !== 'test') {
        app.use(logger())
    }
}

