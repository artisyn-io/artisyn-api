import { beforeAll, describe, expect, it } from 'vitest';

import AnalyticsController from '../AnalyticsController';
import app from '../../index';
import request from 'supertest';

describe('Analytics Controller', () => {
    let authToken: string;

    beforeAll(async () => {
        // Setup test routes
        const controller = new AnalyticsController();
        app.get('/test/analytics', controller.index);
        app.get('/test/analytics/summary', controller.summary);
        app.get('/test/analytics/aggregations', controller.aggregations);
        app.get('/test/analytics/event-types', controller.eventTypes);
        app.post('/test/analytics/aggregate', controller.create);
        app.delete('/test/analytics/cleanup', controller.delete);
    });

    describe('GET /test/analytics', () => {
        it('should return analytics events with pagination', async () => {
            const response = await request(app).get('/test/analytics');

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe('success');
            expect(response.body.data).toBeDefined();
            expect(Array.isArray(response.body.data)).toBeTruthy();
        });

        it('should support filtering by eventType', async () => {
            const response = await request(app)
                .get('/test/analytics')
                .query({ eventType: 'API_CALL' });

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe('success');
        });

        it('should support date range filtering', async () => {
            const response = await request(app)
                .get('/test/analytics')
                .query({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31'
                });

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe('success');
        });

        it('should support pagination', async () => {
            const response = await request(app)
                .get('/test/analytics')
                .query({ page: 1, limit: 10 });

            expect(response.statusCode).toBe(200);
            expect(response.body.meta).toBeDefined();
            expect(response.body.meta.pagination).toBeDefined();
        });
    });

    describe('GET /test/analytics/summary', () => {
        it('should return analytics summary', async () => {
            const response = await request(app).get('/test/analytics/summary');

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe('success');
            expect(response.body.data).toBeDefined();
        });
    });

    describe('GET /test/analytics/aggregations', () => {
        it('should return aggregations', async () => {
            const response = await request(app).get('/test/analytics/aggregations');

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe('success');
            expect(response.body.data).toBeDefined();
        });

        it('should support periodType filter', async () => {
            const response = await request(app)
                .get('/test/analytics/aggregations')
                .query({ periodType: 'daily' });

            expect(response.statusCode).toBe(200);
        });
    });

    describe('GET /test/analytics/event-types', () => {
        it('should return event types', async () => {
            const response = await request(app).get('/test/analytics/event-types');

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe('success');
            expect(response.body.data).toBeDefined();
            expect(Array.isArray(response.body.data)).toBeTruthy();
            expect(response.body.data).toContain('API_CALL');
            expect(response.body.data).toContain('USER_SIGNUP');
        });
    });

    describe('POST /test/analytics/aggregate', () => {
        it('should generate daily aggregation', async () => {
            const response = await request(app)
                .post('/test/analytics/aggregate')
                .send({ periodType: 'daily' });

            expect(response.statusCode).toBe(201);
            expect(response.body.status).toBe('success');
            expect(response.body.data).toBeDefined();
        });
    });

    describe('DELETE /test/analytics/cleanup', () => {
        it('should clean up old data', async () => {
            const response = await request(app)
                .delete('/test/analytics/cleanup')
                .query({ retentionDays: 90 });

            expect(response.statusCode).toBe(202);
            expect(response.body.status).toBe('success');
            expect(response.body.data.deletedCount).toBeDefined();
        });
    });
});
