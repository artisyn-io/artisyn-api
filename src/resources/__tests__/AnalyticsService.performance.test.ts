import { describe, it, expect, beforeAll } from 'vitest';
import AnalyticsService from '../AnalyticsService';
import { EventType } from '@prisma/client';

/**
 * Performance tests for Analytics Aggregation
 * Validates that aggregation processes complete within acceptable time limits
 */
describe('Analytics Performance Tests', () => {
    // Skip in CI if no database connection
    const itWithDb = process.env.DATABASE_URL ? it : it.skip;

    describe('Aggregation Performance', () => {
        itWithDb('should complete hourly aggregation within 1000ms', async () => {
            const startTime = Date.now();

            await AnalyticsService.generateAggregation('hourly');

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(1000);
        });

        itWithDb('should complete daily aggregation within 1000ms', async () => {
            const startTime = Date.now();

            await AnalyticsService.generateAggregation('daily');

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(1000);
        });

        itWithDb('should complete weekly aggregation within 2000ms', async () => {
            const startTime = Date.now();

            await AnalyticsService.generateAggregation('weekly');

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(2000);
        });
    });

    describe('Query Performance', () => {
        itWithDb('should retrieve events within 100ms', async () => {
            const startTime = Date.now();

            await AnalyticsService.getEvents({
                take: 100,
                skip: 0,
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(100);
        });

        itWithDb('should retrieve summary within 200ms', async () => {
            const startTime = Date.now();

            await AnalyticsService.getSummary({});

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(200);
        });

        itWithDb('should filter events by date range within 150ms', async () => {
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

        itWithDb('should filter events by eventType within 100ms', async () => {
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
        itWithDb('should track event within 50ms', async () => {
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

        itWithDb('should track multiple events concurrently', async () => {
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
        itWithDb('should cleanup old data within 500ms', async () => {
            const startTime = Date.now();

            await AnalyticsService.cleanupOldData(365); // Use long retention to avoid deleting test data

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(500);
        });
    });
});
