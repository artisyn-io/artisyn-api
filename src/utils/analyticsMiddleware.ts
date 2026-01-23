import { Request, Response, NextFunction } from 'express';
import AnalyticsService from '../resources/AnalyticsService';
import { EventType } from '@prisma/client';

/**
 * Analytics Middleware
 * Tracks API calls and captures performance metrics
 * Implements GDPR-compliant data collection
 */
export const analyticsMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  // Skip analytics tracking for the analytics endpoints themselves
  if (req.path.startsWith('/api/analytics')) {
    return next();
  }

  // Capture the original res.json to intercept response
  const originalJson = res.json.bind(res);

  res.json = (body: unknown) => {
    const responseTime = Date.now() - startTime;

    // Track the API call asynchronously (don't wait for it)
    AnalyticsService.trackEvent({
      eventType: EventType.API_CALL,
      userId: req.user?.id,
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.headers['user-agent'] as string,
      ip: req.ip || req.socket.remoteAddress,
      referrer: req.headers.referer as string,
      metadata: {
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
      },
    }).catch((err) => console.error('Analytics middleware error:', err));

    return originalJson(body);
  };

  next();
};

/**
 * Tracks specific business events
 */
export const trackBusinessEvent = async (
  eventType: EventType,
  userId?: string,
  metadata?: Record<string, unknown>
) => {
  return AnalyticsService.trackEvent({
    eventType,
    userId,
    metadata,
  });
};

export default analyticsMiddleware;
