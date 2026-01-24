import { createHash } from 'crypto';
import { prisma } from 'src/db';
import { EventType, Prisma } from '@prisma/client';

/**
 * Analytics Service
 * Handles all analytics data collection, anonymization, and retrieval
 * Ensures GDPR compliance through data anonymization
 */
export class AnalyticsService {
  /**
   * Anonymizes a user ID using SHA-256 hash
   * Ensures user privacy while maintaining consistency for analytics
   */
  static anonymizeUserId(userId: string | null | undefined): string | null {
    if (!userId) return null;
    return createHash('sha256').update(userId).digest('hex').substring(0, 32);
  }

  /**
   * Anonymizes an IP address using SHA-256 hash
   */
  static anonymizeIp(ip: string | null | undefined): string | null {
    if (!ip) return null;
    // Hash the IP to maintain privacy
    return createHash('sha256').update(ip).digest('hex').substring(0, 16);
  }

  /**
   * Extracts and anonymizes user agent info
   */
  static anonymizeUserAgent(userAgent: string | null | undefined): string | null {
    if (!userAgent) return null;
    // Keep only browser and OS info, remove personal identifiers
    const simplified = userAgent.split(' ').slice(0, 3).join(' ');
    return simplified.substring(0, 100);
  }

/**
   * Records an analytics event with proper anonymization
   */
  static async trackEvent(params: {
    eventType: EventType;
    userId?: string | null;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    responseTime?: number;
    userAgent?: string;
    ip?: string;
    referrer?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      return await prisma.analyticsEvent.create({
        data: {
          eventType: params.eventType,
          anonymizedUserId: this.anonymizeUserId(params.userId),
          endpoint: params.endpoint,
          method: params.method,
          statusCode: params.statusCode,
          responseTime: params.responseTime,
          userAgent: this.anonymizeUserAgent(params.userAgent),
          ipHash: this.anonymizeIp(params.ip),
          referrer: params.referrer ? new URL(params.referrer).hostname : null,
          metadata: params.metadata as Prisma.JsonObject,
        },
      });
    } catch (error) {
      // Log error but don't throw - analytics should not break the app
      console.error('Analytics tracking error:', error);
      return null;
    }
  }

  /**
   * Builds a reusable where clause for AnalyticsEvent queries
   */
  private static buildEventWhere(params: {
    eventType?: EventType;
    startDate?: Date;
    endDate?: Date;
    endpoint?: string;
    userId?: string;
  }): Prisma.AnalyticsEventWhereInput {
    const where: Prisma.AnalyticsEventWhereInput = {};

    if (params.eventType) {
      where.eventType = params.eventType;
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }

    if (params.endpoint) {
      where.endpoint = { contains: params.endpoint };
    }

    if (params.userId) {
      where.anonymizedUserId = this.anonymizeUserId(params.userId) ?? undefined;
    }

    return where;
  }

  /**
   * Retrieves analytics events with filtering and pagination
   */
  static async getEvents(params: {
    eventType?: EventType;
    startDate?: Date;
    endDate?: Date;
    endpoint?: string;
    userId?: string;
    take?: number;
    skip?: number;
  }) {
    const where = this.buildEventWhere(params);

    const [events, total] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where,
        take: params.take || 50,
        skip: params.skip || 0,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.analyticsEvent.count({ where }),
    ]);

    return { events, total };
  }

  /**
   * Export analytics events for offline analysis
   * Applies the same filters as getEvents but returns a bounded set
   */
  static async exportEvents(params: {
    eventType?: EventType;
    startDate?: Date;
    endDate?: Date;
    endpoint?: string;
    userId?: string;
    limit?: number;
  }) {
    const where = this.buildEventWhere(params);
    const MAX_LIMIT = 10000;
    const take = Math.min(params.limit ?? 1000, MAX_LIMIT);

    const events = await prisma.analyticsEvent.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
    });

    return events;
  }

  /**
   * Detects basic security anomalies using recent analytics events
   */
  static async detectAnomalies(params: { windowMinutes?: number } = {}) {
    const windowMinutes = params.windowMinutes ?? 60;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

    const anomalies: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      context: Record<string, unknown>;
    }> = [];

    // Rule 1: Possible brute-force login attempts (many LOGIN_FAILED from same IP hash)
    try {
      const bruteForceCandidates = await prisma.analyticsEvent.groupBy({
        by: ['ipHash'],
        where: {
          eventType: EventType.LOGIN_FAILED,
          createdAt: { gte: windowStart, lte: now },
          ipHash: { not: null },
        },
        _count: { id: true },
        having: {
          ipHash: { not: null },
          _count: { id: { gt: 5 } },
        },
      });

      for (const row of bruteForceCandidates) {
        anomalies.push({
          type: 'BRUTE_FORCE_LOGIN',
          severity: 'high',
          description: `Multiple failed logins from the same IP hash in the last ${windowMinutes} minutes`,
          context: {
            ipHash: row.ipHash,
            failedLogins: row._count.id,
            windowMinutes,
          },
        });
      }
    } catch (error) {
      console.error('Anomaly detection (brute force) error:', error);
    }

    // Rule 2: Elevated error rate in recent window compared to previous window
    try {
      const previousWindowStart = new Date(windowStart.getTime() - windowMinutes * 60 * 1000);

      const [currentErrors, previousErrors] = await Promise.all([
        prisma.analyticsEvent.count({
          where: {
            eventType: EventType.ERROR_OCCURRED,
            createdAt: { gte: windowStart, lte: now },
          },
        }),
        prisma.analyticsEvent.count({
          where: {
            eventType: EventType.ERROR_OCCURRED,
            createdAt: { gte: previousWindowStart, lte: windowStart },
          },
        }),
      ]);

      if (currentErrors >= 10 && previousErrors > 0 && currentErrors > previousErrors * 2) {
        anomalies.push({
          type: 'ERROR_RATE_SPIKE',
          severity: 'medium',
          description: 'Error events spiked compared to the previous window',
          context: {
            windowMinutes,
            currentErrors,
            previousErrors,
          },
        });
      }
    } catch (error) {
      console.error('Anomaly detection (error spike) error:', error);
    }

    return {
      windowMinutes,
      anomalies,
    };
  }

  /**
   * Gets aggregated analytics summary
   */
  static async getSummary(params: {
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: Prisma.AnalyticsEventWhereInput = {};

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    // Get event counts by type
    const eventsByType = await prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      where,
      _count: { id: true },
    });

    // Get average response time for API calls
    const apiMetrics = await prisma.analyticsEvent.aggregate({
      where: { ...where, eventType: 'API_CALL', responseTime: { not: null } },
      _avg: { responseTime: true },
      _max: { responseTime: true },
      _min: { responseTime: true },
    });

    // Get unique users count
    const uniqueUsers = await prisma.analyticsEvent.groupBy({
      by: ['anonymizedUserId'],
      where: { ...where, anonymizedUserId: { not: null } },
    });

    // Get top endpoints
    const topEndpoints = await prisma.analyticsEvent.groupBy({
      by: ['endpoint'],
      where: { ...where, endpoint: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Get error rate
    const totalRequests = await prisma.analyticsEvent.count({
      where: { ...where, eventType: 'API_CALL' },
    });

    const errorCount = await prisma.analyticsEvent.count({
      where: { ...where, eventType: 'ERROR_OCCURRED' },
    });

    return {
      eventsByType: eventsByType.reduce((acc, item) => {
        acc[item.eventType] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      apiMetrics: {
        avgResponseTime: apiMetrics._avg.responseTime,
        maxResponseTime: apiMetrics._max.responseTime,
        minResponseTime: apiMetrics._min.responseTime,
      },
      uniqueUsersCount: uniqueUsers.length,
      topEndpoints: topEndpoints.map(e => ({
        endpoint: e.endpoint,
        count: e._count.id,
      })),
      errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
      totalEvents: await prisma.analyticsEvent.count({ where }),
    };
  }

  /**
   * Generates and stores aggregated reports
   */
  static async generateAggregation(periodType: 'hourly' | 'daily' | 'weekly' | 'monthly') {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    switch (periodType) {
      case 'hourly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
        break;
      case 'daily':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodEnd = now;
        break;
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        periodEnd = now;
        break;
    }

    // Get all event types
    const eventTypes = Object.values(EventType);

    for (const eventType of eventTypes) {
      const [count, uniqueUsers, avgResponse] = await Promise.all([
        prisma.analyticsEvent.count({
          where: {
            eventType,
            createdAt: { gte: periodStart, lte: periodEnd },
          },
        }),
        prisma.analyticsEvent.groupBy({
          by: ['anonymizedUserId'],
          where: {
            eventType,
            createdAt: { gte: periodStart, lte: periodEnd },
            anonymizedUserId: { not: null },
          },
        }),
        eventType === 'API_CALL'
          ? prisma.analyticsEvent.aggregate({
              where: {
                eventType,
                createdAt: { gte: periodStart, lte: periodEnd },
                responseTime: { not: null },
              },
              _avg: { responseTime: true },
            })
          : Promise.resolve({ _avg: { responseTime: null } }),
      ]);

      // Upsert aggregation record
      await prisma.analyticsAggregation.upsert({
        where: {
          periodType_periodStart_eventType: {
            periodType,
            periodStart,
            eventType,
          },
        },
        create: {
          periodType,
          periodStart,
          periodEnd,
          eventType,
          eventCount: count,
          uniqueUsers: uniqueUsers.length,
          avgResponseTime: avgResponse._avg.responseTime,
        },
        update: {
          eventCount: count,
          uniqueUsers: uniqueUsers.length,
          avgResponseTime: avgResponse._avg.responseTime,
        },
      });
    }

    return { periodType, periodStart, periodEnd, processedEventTypes: eventTypes.length };
  }

  /**
   * Retrieves stored aggregation reports
   */
  static async getAggregations(params: {
    periodType?: string;
    eventType?: EventType;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: Prisma.AnalyticsAggregationWhereInput = {};

    if (params.periodType) where.periodType = params.periodType;
    if (params.eventType) where.eventType = params.eventType;
    if (params.startDate) where.periodStart = { gte: params.startDate };
    if (params.endDate) where.periodEnd = { lte: params.endDate };

    return prisma.analyticsAggregation.findMany({
      where,
      orderBy: { periodStart: 'desc' },
    });
  }

  /**
   * Cleans up old analytics data for GDPR compliance
   * Keeps data only for specified retention period (default: 90 days)
   */
  static async cleanupOldData(retentionDays: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleted = await prisma.analyticsEvent.deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    return { deletedCount: deleted.count, cutoffDate };
  }
}

export default AnalyticsService;
