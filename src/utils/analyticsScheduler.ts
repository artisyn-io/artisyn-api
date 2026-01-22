import AnalyticsService from 'src/resources/AnalyticsService';
import { env } from './helpers';

/**
 * Analytics Scheduler
 * Handles automatic generation of analytics reports at scheduled intervals
 * 
 * Uses setInterval for simplicity - in production, consider using
 * node-cron or a job queue like Bull for more robust scheduling
 */

// Interval constants (in milliseconds)
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

// Store interval IDs for cleanup
let hourlyInterval: NodeJS.Timeout | null = null;
let dailyInterval: NodeJS.Timeout | null = null;
let weeklyInterval: NodeJS.Timeout | null = null;
let monthlyInterval: NodeJS.Timeout | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Generates hourly analytics aggregation
 */
const generateHourlyReport = async () => {
    try {
        console.log('[Analytics Scheduler] Generating hourly aggregation...');
        await AnalyticsService.generateAggregation('hourly');
        console.log('[Analytics Scheduler] Hourly aggregation completed');
    } catch (error) {
        console.error('[Analytics Scheduler] Hourly aggregation failed:', error);
    }
};

/**
 * Generates daily analytics aggregation
 */
const generateDailyReport = async () => {
    try {
        console.log('[Analytics Scheduler] Generating daily aggregation...');
        await AnalyticsService.generateAggregation('daily');
        console.log('[Analytics Scheduler] Daily aggregation completed');
    } catch (error) {
        console.error('[Analytics Scheduler] Daily aggregation failed:', error);
    }
};

/**
 * Generates weekly analytics aggregation
 */
const generateWeeklyReport = async () => {
    try {
        console.log('[Analytics Scheduler] Generating weekly aggregation...');
        await AnalyticsService.generateAggregation('weekly');
        console.log('[Analytics Scheduler] Weekly aggregation completed');
    } catch (error) {
        console.error('[Analytics Scheduler] Weekly aggregation failed:', error);
    }
};

/**
 * Generates monthly analytics aggregation
 */
const generateMonthlyReport = async () => {
    try {
        console.log('[Analytics Scheduler] Generating monthly aggregation...');
        await AnalyticsService.generateAggregation('monthly');
        console.log('[Analytics Scheduler] Monthly aggregation completed');
    } catch (error) {
        console.error('[Analytics Scheduler] Monthly aggregation failed:', error);
    }
};

/**
 * Runs GDPR-compliant data cleanup
 */
const runDataCleanup = async () => {
    try {
        const retentionDays = parseInt(env('ANALYTICS_RETENTION_DAYS', '90'));
        console.log(`[Analytics Scheduler] Running data cleanup (retention: ${retentionDays} days)...`);
        const result = await AnalyticsService.cleanupOldData(retentionDays);
        console.log(`[Analytics Scheduler] Cleanup completed: ${result.deletedCount} records deleted`);
    } catch (error) {
        console.error('[Analytics Scheduler] Data cleanup failed:', error);
    }
};

/**
 * Starts all scheduled analytics jobs
 * Call this function during app initialization
 */
export const startAnalyticsScheduler = () => {
    // Don't run scheduler in test environment
    if (env('NODE_ENV') === 'test') {
        return;
    }

    console.log('[Analytics Scheduler] Starting scheduled jobs...');

    // Hourly aggregation - runs every hour
    hourlyInterval = setInterval(generateHourlyReport, HOUR);

    // Daily aggregation - runs every 24 hours
    dailyInterval = setInterval(generateDailyReport, DAY);

    // Weekly aggregation - runs every 7 days
    weeklyInterval = setInterval(generateWeeklyReport, WEEK);

    // Monthly aggregation - runs every 30 days (approximate)
    monthlyInterval = setInterval(generateMonthlyReport, 30 * DAY);

    // Data cleanup - runs daily
    cleanupInterval = setInterval(runDataCleanup, DAY);

    // Generate initial reports on startup (after a short delay)
    setTimeout(async () => {
        await generateHourlyReport();
        await generateDailyReport();
    }, 5000);

    console.log('[Analytics Scheduler] All jobs scheduled');
};

/**
 * Stops all scheduled analytics jobs
 * Call this during graceful shutdown
 */
export const stopAnalyticsScheduler = () => {
    console.log('[Analytics Scheduler] Stopping scheduled jobs...');

    if (hourlyInterval) clearInterval(hourlyInterval);
    if (dailyInterval) clearInterval(dailyInterval);
    if (weeklyInterval) clearInterval(weeklyInterval);
    if (monthlyInterval) clearInterval(monthlyInterval);
    if (cleanupInterval) clearInterval(cleanupInterval);

    hourlyInterval = null;
    dailyInterval = null;
    weeklyInterval = null;
    monthlyInterval = null;
    cleanupInterval = null;

    console.log('[Analytics Scheduler] All jobs stopped');
};

/**
 * Manually trigger a specific aggregation type
 */
export const triggerAggregation = async (periodType: 'hourly' | 'daily' | 'weekly' | 'monthly') => {
    switch (periodType) {
        case 'hourly':
            return generateHourlyReport();
        case 'daily':
            return generateDailyReport();
        case 'weekly':
            return generateWeeklyReport();
        case 'monthly':
            return generateMonthlyReport();
    }
};

export default {
    start: startAnalyticsScheduler,
    stop: stopAnalyticsScheduler,
    trigger: triggerAggregation,
};
