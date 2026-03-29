import AnalyticsService from "src/resources/AnalyticsService";
import { env } from "./helpers";

/**
 * Analytics Scheduler
 * Handles automatic generation of analytics reports at scheduled intervals.
 *
 * Controlled by the ENABLE_ANALYTICS_SCHEDULER environment variable.
 * Set it to "true" to enable background analytics jobs; any other value
 * (or omitting it) keeps the scheduler disabled so local development and
 * CI boots stay fast and quiet.
 *
 * Uses setInterval for simplicity - in production, consider using
 * node-cron or a job queue like Bull for more robust scheduling
 */

const LOG_PREFIX = "[Analytics Scheduler]";

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
 * Check whether the analytics scheduler is enabled via configuration.
 */
const isSchedulerEnabled = (): boolean => {
  return env("ENABLE_ANALYTICS_SCHEDULER") === true;
};

/**
 * Generates hourly analytics aggregation
 */
const generateHourlyReport = async () => {
  try {
    if (env("NODE_ENV") !== "test") {
      console.debug(`${LOG_PREFIX} Generating hourly aggregation...`);
    }
    await AnalyticsService.generateAggregation("hourly");
    if (env("NODE_ENV") !== "test") {
      console.debug(`${LOG_PREFIX} Hourly aggregation completed`);
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Hourly aggregation failed:`, error);
  }
};

/**
 * Generates daily analytics aggregation
 */
const generateDailyReport = async () => {
  try {
    if (env("NODE_ENV") !== "test") {
      console.debug(`${LOG_PREFIX} Generating daily aggregation...`);
    }
    await AnalyticsService.generateAggregation("daily");
    if (env("NODE_ENV") !== "test") {
      console.debug(`${LOG_PREFIX} Daily aggregation completed`);
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Daily aggregation failed:`, error);
  }
};

/**
 * Generates weekly analytics aggregation
 */
const generateWeeklyReport = async () => {
  try {
    if (env("NODE_ENV") !== "test") {
      console.debug(`${LOG_PREFIX} Generating weekly aggregation...`);
    }
    await AnalyticsService.generateAggregation("weekly");
    if (env("NODE_ENV") !== "test") {
      console.debug(`${LOG_PREFIX} Weekly aggregation completed`);
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Weekly aggregation failed:`, error);
  }
};

/**
 * Generates monthly analytics aggregation
 */
const generateMonthlyReport = async () => {
  try {
    if (env("NODE_ENV") !== "test") {
      console.debug(`${LOG_PREFIX} Generating monthly aggregation...`);
    }
    await AnalyticsService.generateAggregation("monthly");
    if (env("NODE_ENV") !== "test") {
      console.debug(`${LOG_PREFIX} Monthly aggregation completed`);
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Monthly aggregation failed:`, error);
  }
};

/**
 * Runs GDPR-compliant data cleanup
 */
const runDataCleanup = async () => {
  try {
    const retentionDays = parseInt(env("ANALYTICS_RETENTION_DAYS", "90"));
    if (env("NODE_ENV") !== "test") {
      console.debug(
        `${LOG_PREFIX} Running data cleanup (retention: ${retentionDays} days)...`,
      );
    }
    const result = await AnalyticsService.cleanupOldData(retentionDays);
    if (env("NODE_ENV") !== "test") {
      console.debug(
        `${LOG_PREFIX} Cleanup completed: ${result.deletedCount} records deleted`,
      );
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Data cleanup failed:`, error);
  }
};

/**
 * Starts all scheduled analytics jobs.
 *
 * Skipped in test environments and when ENABLE_ANALYTICS_SCHEDULER is not
 * set to "true". The initial startup aggregation that previously ran five
 * seconds after boot has been removed; use {@link triggerAggregation} to
 * run a one-off aggregation when needed.
 */
export const startAnalyticsScheduler = () => {
  // Don't run scheduler in test environment
  if (env("NODE_ENV") === "test") {
    return;
  }

  if (!isSchedulerEnabled()) {
    console.debug(
      `${LOG_PREFIX} Scheduler disabled (set ENABLE_ANALYTICS_SCHEDULER=true to enable)`,
    );
    return;
  }

  console.debug(`${LOG_PREFIX} Starting scheduled jobs...`);

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

  console.debug(`${LOG_PREFIX} All jobs scheduled`);
};

/**
 * Stops all scheduled analytics jobs
 * Call this during graceful shutdown
 */
export const stopAnalyticsScheduler = () => {
  if (env("NODE_ENV") !== "test") {
    console.debug(`${LOG_PREFIX} Stopping scheduled jobs...`);
  }

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

  if (env("NODE_ENV") !== "test") {
    console.debug(`${LOG_PREFIX} All jobs stopped`);
  }
};

/**
 * Manually trigger a specific aggregation type
 */
export const triggerAggregation = async (
  periodType: "hourly" | "daily" | "weekly" | "monthly",
) => {
  switch (periodType) {
    case "hourly":
      return generateHourlyReport();
    case "daily":
      return generateDailyReport();
    case "weekly":
      return generateWeeklyReport();
    case "monthly":
      return generateMonthlyReport();
  }
};

export default {
  start: startAnalyticsScheduler,
  stop: stopAnalyticsScheduler,
  trigger: triggerAggregation,
};
