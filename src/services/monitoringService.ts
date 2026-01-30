/**
 * Monitoring and Alerting System
 * Tracks API metrics and alerts on suspicious activities
 */

export interface SecurityAlert {
  id: string;
  type: 'rate-limit' | 'blocked-ip' | 'failed-auth' | 'api-error' | 'suspicious-activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
}

export interface APIMetrics {
  totalRequests: number;
  totalErrors: number;
  totalRateLimitHits: number;
  totalBlockedIPs: number;
  totalFailedAuths: number;
  averageResponseTime: number;
  errorRate: number;
  timestamp: Date;
}

/**
 * In-memory alert store
 */
const alertStore: SecurityAlert[] = [];
const maxAlertsInMemory = 10000;

/**
 * Metrics tracker
 */
const metricsStore: APIMetrics[] = [];
const maxMetricsInMemory = 1000;

/**
 * Create a security alert
 */
export const createAlert = (
  type: SecurityAlert['type'],
  severity: SecurityAlert['severity'],
  message: string,
  data: Record<string, any> = {}
): SecurityAlert => {
  const alert: SecurityAlert = {
    id: generateAlertId(),
    type,
    severity,
    message,
    data: {
      ...data,
      ip: data.ip || 'unknown',
      userId: data.userId || 'anonymous',
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date(),
    resolved: false,
  };

  // Add to store
  alertStore.push(alert);

  // Keep store size manageable
  if (alertStore.length > maxAlertsInMemory) {
    alertStore.shift();
  }

  // Log alert based on severity
  logAlert(alert);

  // Trigger notifications for high severity alerts
  if (severity === 'high' || severity === 'critical') {
    notifyAdmins(alert);
  }

  return alert;
};

/**
 * Get recent alerts
 */
export const getRecentAlerts = (limit: number = 100, type?: SecurityAlert['type']): SecurityAlert[] => {
  let alerts = alertStore.slice(-limit);

  if (type) {
    alerts = alerts.filter(alert => alert.type === type);
  }

  return alerts.reverse();
};

/**
 * Get alerts by severity
 */
export const getAlertsBySeverity = (severity: SecurityAlert['severity']): SecurityAlert[] => {
  return alertStore.filter(alert => alert.severity === severity && !alert.resolved);
};

/**
 * Resolve an alert
 */
export const resolveAlert = (alertId: string): boolean => {
  const alert = alertStore.find(a => a.id === alertId);
  if (alert) {
    alert.resolved = true;
    return true;
  }
  return false;
};

/**
 * Clear old alerts
 */
export const clearOldAlerts = (hoursToKeep: number = 24) => {
  const cutoffTime = new Date(Date.now() - hoursToKeep * 60 * 60 * 1000);
  const initialLength = alertStore.length;

  for (let i = alertStore.length - 1; i >= 0; i--) {
    if (alertStore[i].timestamp < cutoffTime) {
      alertStore.splice(i, 1);
    }
  }

  const removed = initialLength - alertStore.length;
  if (removed > 0) {
    console.log(`[Monitoring] Cleared ${removed} old alerts`);
  }
};

/**
 * Record API metrics
 */
export const recordMetrics = (
  totalRequests: number,
  totalErrors: number,
  totalRateLimitHits: number,
  totalBlockedIPs: number,
  totalFailedAuths: number,
  averageResponseTime: number
): APIMetrics => {
  const metrics: APIMetrics = {
    totalRequests,
    totalErrors,
    totalRateLimitHits,
    totalBlockedIPs,
    totalFailedAuths,
    averageResponseTime,
    errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
    timestamp: new Date(),
  };

  metricsStore.push(metrics);

  // Keep store size manageable
  if (metricsStore.length > maxMetricsInMemory) {
    metricsStore.shift();
  }

  return metrics;
};

/**
 * Get current metrics
 */
export const getCurrentMetrics = (): APIMetrics | null => {
  return metricsStore.length > 0 ? metricsStore[metricsStore.length - 1] : null;
};

/**
 * Get metrics for a time range
 */
export const getMetricsForRange = (startTime: Date, endTime: Date): APIMetrics[] => {
  return metricsStore.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
};

/**
 * Check if error rate is too high
 */
export const checkErrorRateThreshold = (threshold: number = 5): boolean => {
  const metrics = getCurrentMetrics();
  if (!metrics) return false;
  return metrics.errorRate > threshold;
};

/**
 * Log an alert
 */
const logAlert = (alert: SecurityAlert) => {
  const timestamp = alert.timestamp.toISOString();
  const prefix = `[${alert.type.toUpperCase()}] [${alert.severity.toUpperCase()}]`;

  console.log(`${prefix} ${timestamp} - ${alert.message}`, alert.data);
};

/**
 * Notify admins about security alerts
 */
const notifyAdmins = (alert: SecurityAlert) => {
  // This would integrate with your notification system
  // For now, we'll just log it
  console.warn(`[ADMIN ALERT] High severity security event: ${alert.message}`, alert.data);

  // You could implement:
  // - Email notifications
  // - SMS alerts
  // - Slack/Discord webhooks
  // - PagerDuty integration
};

/**
 * Generate unique alert ID
 */
const generateAlertId = (): string => {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get alert statistics
 */
export const getAlertStatistics = () => {
  const stats = {
    total: alertStore.length,
    byType: {} as Record<SecurityAlert['type'], number>,
    bySeverity: {} as Record<SecurityAlert['severity'], number>,
    unresolved: 0,
  };

  for (const alert of alertStore) {
    stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
    stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
    if (!alert.resolved) stats.unresolved++;
  }

  return stats;
};

/**
 * Get monitoring dashboard data
 */
export const getMonitoringDashboard = () => {
  return {
    metrics: getCurrentMetrics(),
    alerts: getAlertStatistics(),
    recentAlerts: getRecentAlerts(10),
    highSeverityAlerts: getAlertsBySeverity('critical').concat(getAlertsBySeverity('high')),
  };
};

/**
 * Start periodic monitoring tasks
 */
export const startMonitoringScheduler = () => {
  // Clear old alerts every hour
  setInterval(() => {
    clearOldAlerts(24);
  }, 60 * 60 * 1000);

  // Check error rate every 5 minutes
  setInterval(() => {
    const tooHighErrorRate = checkErrorRateThreshold(5);
    if (tooHighErrorRate) {
      const metrics = getCurrentMetrics();
      createAlert(
        'api-error',
        'high',
        `High error rate detected: ${metrics?.errorRate.toFixed(2)}%`,
        { errorRate: metrics?.errorRate }
      );
    }
  }, 5 * 60 * 1000);
};
