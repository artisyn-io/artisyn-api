import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { EventType } from '@prisma/client';

// Mock AnalyticsService
vi.mock('src/resources/AnalyticsService', () => ({
    default: {
        trackEvent: vi.fn().mockResolvedValue({}),
    },
}));

import AnalyticsService from 'src/resources/AnalyticsService';
import { analyticsMiddleware, trackBusinessEvent } from '../analyticsMiddleware';

describe('Analytics Middleware', () => {
    let mockReq: Request;
    let mockRes: Response;
    let mockNext: NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();
        
        mockReq = {
            path: '/api/test',
            method: 'GET',
            headers: {
                'user-agent': 'Mozilla/5.0 Test Browser',
            },
            user: { id: 'user-123' },
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' },
            query: {},
        } as unknown as Request;
        
        // Create a proper mock that allows the middleware to wrap it
        const jsonMock = vi.fn().mockReturnThis();
        mockRes = {
            json: jsonMock,
            statusCode: 200,
        } as unknown as Response;
        
        mockNext = vi.fn() as unknown as NextFunction;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('analyticsMiddleware', () => {
        it('should call next() immediately', async () => {
            await analyticsMiddleware(mockReq, mockRes, mockNext);
            
            expect(mockNext).toHaveBeenCalled();
        });

        it('should skip tracking for analytics endpoints', async () => {
            const reqWithAnalyticsPath = {
                ...mockReq,
                path: '/api/analytics/summary',
            } as unknown as Request;
            
            await analyticsMiddleware(reqWithAnalyticsPath, mockRes, mockNext);
            
            expect(mockNext).toHaveBeenCalled();
            // Should not have modified res.json for tracking
        });

        it('should track API call when response is sent', async () => {
            await analyticsMiddleware(mockReq, mockRes, mockNext);
            
            // Call the wrapped json method (middleware has wrapped it)
            mockRes.json({ data: 'test' });
            
            // Wait for async tracking
            await new Promise(resolve => setTimeout(resolve, 20));
            
            expect(AnalyticsService.trackEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: EventType.API_CALL,
                    endpoint: '/api/test',
                    method: 'GET',
                    statusCode: 200,
                })
            );
        });

        it('should include response time in tracked event', async () => {
            await analyticsMiddleware(mockReq, mockRes, mockNext);
            
            // Simulate delay then send response
            await new Promise(resolve => setTimeout(resolve, 20));
            mockRes.json({ data: 'test' });
            
            // Wait for async tracking
            await new Promise(resolve => setTimeout(resolve, 20));
            
            expect(AnalyticsService.trackEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    responseTime: expect.any(Number),
                })
            );
            
            const call = (AnalyticsService.trackEvent as Mock).mock.calls[0][0];
            expect(call.responseTime).toBeGreaterThanOrEqual(15);
        });
    });

    describe('trackBusinessEvent', () => {
        it('should track business event with correct parameters', async () => {
            await trackBusinessEvent(EventType.ARTISAN_VIEWED, 'user-123', {
                artisanId: 'artisan-456',
            });
            
            expect(AnalyticsService.trackEvent).toHaveBeenCalledWith({
                eventType: EventType.ARTISAN_VIEWED,
                userId: 'user-123',
                metadata: {
                    artisanId: 'artisan-456',
                },
            });
        });

        it('should handle undefined userId', async () => {
            await trackBusinessEvent(EventType.CATEGORY_VIEWED, undefined, {
                categoryId: 'cat-123',
            });
            
            expect(AnalyticsService.trackEvent).toHaveBeenCalledWith({
                eventType: EventType.CATEGORY_VIEWED,
                userId: undefined,
                metadata: {
                    categoryId: 'cat-123',
                },
            });
        });

        it('should handle empty metadata', async () => {
            await trackBusinessEvent(EventType.USER_LOGIN, 'user-123');
            
            expect(AnalyticsService.trackEvent).toHaveBeenCalledWith({
                eventType: EventType.USER_LOGIN,
                userId: 'user-123',
                metadata: undefined,
            });
        });
    });
});
