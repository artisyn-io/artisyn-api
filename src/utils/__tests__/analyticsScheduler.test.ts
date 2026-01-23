import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock AnalyticsService
vi.mock('src/resources/AnalyticsService', () => ({
    default: {
        generateAggregation: vi.fn().mockResolvedValue({}),
        cleanupOldData: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    },
}));

// Mock helpers
vi.mock('../helpers', () => ({
    env: vi.fn((key: string, defaultValue?: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'ANALYTICS_RETENTION_DAYS') return '90';
        return defaultValue;
    }),
}));

import AnalyticsService from '../../resources/AnalyticsService';
import {
    startAnalyticsScheduler,
    stopAnalyticsScheduler,
    triggerAggregation,
} from '../analyticsScheduler';

describe('Analytics Scheduler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        stopAnalyticsScheduler();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('startAnalyticsScheduler', () => {
        it('should not start scheduler in test environment', () => {
            startAnalyticsScheduler();
            
            // Fast-forward 1 hour
            vi.advanceTimersByTime(60 * 60 * 1000);
            
            // Should not have called generateAggregation since we're in test env
            expect(AnalyticsService.generateAggregation).not.toHaveBeenCalled();
        });
    });

    describe('stopAnalyticsScheduler', () => {
        it('should not throw when stopping scheduler that was never started', () => {
            expect(() => stopAnalyticsScheduler()).not.toThrow();
        });

        it('should clear all intervals when called', () => {
            startAnalyticsScheduler();
            stopAnalyticsScheduler();
            
            // Fast-forward well past any interval
            vi.advanceTimersByTime(48 * 60 * 60 * 1000);
            
            // Nothing should be called
            expect(AnalyticsService.generateAggregation).not.toHaveBeenCalled();
        });
    });

    describe('triggerAggregation', () => {
        it('should trigger hourly aggregation', async () => {
            await triggerAggregation('hourly');
            
            expect(AnalyticsService.generateAggregation).toHaveBeenCalledWith('hourly');
        });

        it('should trigger daily aggregation', async () => {
            await triggerAggregation('daily');
            
            expect(AnalyticsService.generateAggregation).toHaveBeenCalledWith('daily');
        });

        it('should trigger weekly aggregation', async () => {
            await triggerAggregation('weekly');
            
            expect(AnalyticsService.generateAggregation).toHaveBeenCalledWith('weekly');
        });

        it('should trigger monthly aggregation', async () => {
            await triggerAggregation('monthly');
            
            expect(AnalyticsService.generateAggregation).toHaveBeenCalledWith('monthly');
        });

        it('should handle errors gracefully', async () => {
            (AnalyticsService.generateAggregation as ReturnType<typeof vi.fn>)
                .mockRejectedValueOnce(new Error('Database error'));
            
            // Should not throw
            await expect(triggerAggregation('daily')).resolves.not.toThrow();
        });
    });
});
