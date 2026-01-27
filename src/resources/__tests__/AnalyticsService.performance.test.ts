import { describe, it, expect, beforeEach, vi } from 'vitest';
import AnalyticsService from '../AnalyticsService';
import { EventType } from '@prisma/client';
import { prisma } from '../../db';

// Mock Prisma client
vi.mock('../../db', () => ({
  prisma: {
    analyticsEvent: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    analyticsAggregation: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      upsert: vi.fn(), // Add this line
    },
  },
}));

/**
 * Performance tests for Analytics Aggregation
 * Validates that aggregation processes complete within acceptable time limits
 */
describe('Analytics Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    (prisma.analyticsEvent.findMany as any).mockResolvedValue([]);
    (prisma.analyticsEvent.count as any).mockResolvedValue(0);
    (prisma.analyticsEvent.deleteMany as any).mockResolvedValue({ count: 0 });
    (prisma.analyticsEvent.create as any).mockResolvedValue({
      id: 'test-id',
      eventType: EventType.API_CALL,
      createdAt: new Date(),
    });
    (prisma.analyticsEvent.aggregate as any).mockResolvedValue({
      _count: { id: 0 },
      _avg: { responseTime: 0 },
      _max: { responseTime: 0 },
      _min: { responseTime: 0 },
    });
    (prisma.analyticsEvent.groupBy as any).mockResolvedValue([]);
    (prisma.analyticsAggregation.createMany as any).mockResolvedValue({ count: 0 });
    (prisma.analyticsAggregation.findMany as any).mockResolvedValue([]);
    (prisma.analyticsAggregation.upsert as any).mockResolvedValue({ // Add this line
      id: 'test-agg-id',
      periodType: 'hourly',
      periodStart: new Date(),
      eventType: EventType.API_CALL,
      eventCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('Aggregation Performance', () => {
    it('should complete hourly aggregation within 1000ms', async () => {
      const startTime = Date.now();

      await AnalyticsService.generateAggregation('hourly');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
    });

    it('should complete daily aggregation within 1000ms', async () => {
      const startTime = Date.now();

      await AnalyticsService.generateAggregation('daily');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
    });

    it('should complete weekly aggregation within 2000ms', async () => {
      const startTime = Date.now();

      await AnalyticsService.generateAggregation('weekly');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Query Performance', () => {
    it('should retrieve events within 100ms', async () => {
      const startTime = Date.now();

      await AnalyticsService.getEvents({
        take: 100,
        skip: 0,
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should retrieve summary within 200ms', async () => {
      // Update the mock for this specific test
      (prisma.analyticsEvent.aggregate as any).mockResolvedValue({
        _count: { id: 100 },
        _avg: { responseTime: 50 },
        _max: { responseTime: 100 },
        _min: { responseTime: 10 },
      });

      const startTime = Date.now();

      await AnalyticsService.getSummary({});

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200);
    });

    it('should filter events by date range within 150ms', async () => {
      const startTime = Date.now();
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      await AnalyticsService.getEvents({
        startDate: weekAgo,
        endDate: now,
        take: 100,
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(150);
    });

    it('should filter events by eventType within 100ms', async () => {
      const startTime = Date.now();

      await AnalyticsService.getEvents({
        eventType: EventType.API_CALL,
        take: 100,
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Anonymization Performance', () => {
    it('should anonymize user ID within 1ms', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        AnalyticsService.anonymizeUserId(`user-${i}`);
      }

      const duration = Date.now() - startTime;
      // 1000 hashes should complete in under 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should anonymize IP within 1ms', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        AnalyticsService.anonymizeIp(`192.168.1.${i % 255}`);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Event Tracking Performance', () => {
    it('should track event within 50ms', async () => {
      const startTime = Date.now();

      await AnalyticsService.trackEvent({
        eventType: EventType.API_CALL,
        endpoint: '/api/test',
        method: 'GET',
        statusCode: 200,
        responseTime: 25,
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
    });

    it('should track multiple events concurrently', async () => {
      const startTime = Date.now();

      const promises = Array.from({ length: 10 }, (_, i) =>
        AnalyticsService.trackEvent({
          eventType: EventType.API_CALL,
          endpoint: `/api/test/${i}`,
          method: 'GET',
          statusCode: 200,
          responseTime: 25 + i,
        })
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      // 10 concurrent events should complete in under 200ms
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Cleanup Performance', () => {
    it('should cleanup old data within 500ms', async () => {
      (prisma.analyticsEvent.deleteMany as any).mockResolvedValue({ count: 50 });

      const startTime = Date.now();
    describe('Export and anomaly detection performance', () => {
        itWithDb('should export events within 200ms', async () => {
            const startTime = Date.now();

            await AnalyticsService.exportEvents({
                limit: 500,
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(200);
        });

        itWithDb('should detect anomalies within 200ms', async () => {
            const startTime = Date.now();

            await AnalyticsService.detectAnomalies({ windowMinutes: 60 });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(200);
        });
    });

    describe('Cleanup Performance', () => {
        itWithDb('should cleanup old data within 500ms', async () => {
            const startTime = Date.now();

      await AnalyticsService.cleanupOldData(365);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
      
      // Verify deleteMany was called
      expect(prisma.analyticsEvent.deleteMany).toHaveBeenCalled();
    });
  });
});