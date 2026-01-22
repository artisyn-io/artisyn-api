import { Request, Response, NextFunction } from 'express';
import AnalyticsService from 'src/resources/AnalyticsService';
import { EventType } from '@prisma/client';

/**
 * Error Analytics Middleware
 * Captures and tracks error events for analytics while preserving
 * original error handling behavior
 */
export const trackErrorEvent = (
    error: Error,
    req: Request,
    userId?: string
): void => {
    // Track error asynchronously - never block error handling
    AnalyticsService.trackEvent({
        eventType: EventType.ERROR_OCCURRED,
        userId,
        endpoint: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'] as string,
        ip: req.ip || req.socket.remoteAddress,
        metadata: {
            errorName: error.name,
            errorMessage: error.message,
            statusCode: (error as { statusCode?: number }).statusCode || 500,
        },
    }).catch((err) => console.error('Error analytics tracking failed:', err));
};

/**
 * Express error handling middleware with analytics tracking
 * Use this as the last error middleware in your chain
 */
export const errorAnalyticsMiddleware = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Track the error
    trackErrorEvent(error, req, req.user?.id);
    
    // Pass to next error handler
    next(error);
};

export default errorAnalyticsMiddleware;
