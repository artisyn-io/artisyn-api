import * as fs from 'fs';
import * as path from 'path';

import { Request, Response } from 'express';

/**
 * Security logging utility for auditing and threat detection
 */

export interface SecurityLog {
  timestamp: Date;
  eventType: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  userId?: string;
  ip: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  message: string;
  details: Record<string, any>;
}

// In-memory log store
const logStore: SecurityLog[] = [];
const maxLogsInMemory = 5000;

// Log file paths
const logsDir = process.env.LOGS_DIR || './storage/logs';
const securityLogFile = path.join(logsDir, 'security.log');
const auditLogFile = path.join(logsDir, 'audit.log');

/**
 * Ensure logs directory exists
 */
const ensureLogsDirectory = () => {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
};

/**
 * Format security log entry
 */
const formatLogEntry = (log: SecurityLog): string => {
  return JSON.stringify({
    timestamp: log.timestamp.toISOString(),
    eventType: log.eventType,
    severity: log.severity,
    userId: log.userId || 'anonymous',
    ip: log.ip,
    userAgent: log.userAgent,
    endpoint: log.endpoint,
    method: log.method,
    statusCode: log.statusCode,
    message: log.message,
    details: log.details,
  });
};

/**
 * Log a security event
 */
export const logSecurityEvent = (
  eventType: string,
  severity: SecurityLog['severity'],
  message: string,
  req: Request | null,
  details: Record<string, any> = {}
): SecurityLog => {
  ensureLogsDirectory();

  const log: SecurityLog = {
    timestamp: new Date(),
    eventType,
    severity,
    userId: (req?.user as any)?.id,
    ip: req?.ip || (req?.connection?.remoteAddress as string) || 'unknown',
    userAgent: req?.get('user-agent'),
    endpoint: req?.path || 'unknown',
    method: req?.method || 'unknown',
    statusCode: undefined,
    message,
    details,
  };

  // Add to in-memory store
  logStore.push(log);
  if (logStore.length > maxLogsInMemory) {
    logStore.shift();
  }

  // Write to file
  try {
    fs.appendFileSync(securityLogFile, formatLogEntry(log) + '\n');
  } catch (error) {
    console.error('Error writing to security log file:', error);
  }

  if (process.env.NODE_ENV !== 'test') {
    // Console logging for critical events
    if (severity === 'critical' || severity === 'error') {
      console.error(`[${eventType}] ${message}`, details);
    } else if (severity === 'warning') {
      console.warn(`[${eventType}] ${message}`, details);
    }
  }

  return log;
};

/**
 * Log an audit event (for compliance and accountability)
 */
export const logAuditEvent = (
  action: string,
  userId: string,
  resourceType: string,
  resourceId: string,
  changes: Record<string, any>,
  status: 'success' | 'failure',
  req?: Request
): void => {
  ensureLogsDirectory();

  const auditLog = {
    timestamp: new Date().toISOString(),
    action,
    userId,
    resourceType,
    resourceId,
    changes,
    status,
    ip: req?.ip || 'unknown',
    userAgent: req?.get('user-agent'),
  };

  try {
    fs.appendFileSync(auditLogFile, JSON.stringify(auditLog) + '\n');
  } catch (error) {
    console.error('Error writing to audit log file:', error);
  }
};

/**
 * Log authentication attempt
 */
export const logAuthAttempt = (
  email: string,
  success: boolean,
  req: Request,
  details?: Record<string, any>
): void => {
  logSecurityEvent(
    'AUTH_ATTEMPT',
    success ? 'info' : 'warning',
    `Authentication ${success ? 'successful' : 'failed'} for ${email}`,
    req,
    {
      email,
      success,
      ...details,
    }
  );
};

/**
 * Log rate limit hit
 */
export const logRateLimitHit = (req: Request, limit: number, window: string): void => {
  logSecurityEvent(
    'RATE_LIMIT',
    'warning',
    `Rate limit exceeded: ${limit} requests per ${window}`,
    req,
    {
      limit,
      window,
    }
  );
};

/**
 * Log IP block
 */
export const logIPBlock = (ip: string, reason: string, req?: Request): void => {
  logSecurityEvent(
    'IP_BLOCKED',
    'high' as any,
    `IP address blocked: ${ip}`,
    req || null,
    {
      ip,
      reason,
    }
  );
};

/**
 * Log API key usage
 */
export const logAPIKeyUsage = (keyId: string, endpoint: string, success: boolean, req?: Request): void => {
  logSecurityEvent(
    'API_KEY_USAGE',
    'info',
    `API key ${success ? 'authenticated' : 'failed authentication'}: ${keyId}`,
    req || null,
    {
      keyId,
      endpoint,
      success,
    }
  );
};

/**
 * Log suspicious activity
 */
export const logSuspiciousActivity = (
  activityType: string,
  req: Request,
  details?: Record<string, any>
): void => {
  logSecurityEvent(
    'SUSPICIOUS_ACTIVITY',
    'warning',
    `Suspicious activity detected: ${activityType}`,
    req,
    {
      activityType,
      ...details,
    }
  );
};

/**
 * Log data access
 */
export const logDataAccess = (
  userId: string,
  resourceType: string,
  resourceId: string,
  action: 'read' | 'write' | 'delete',
  req: Request
): void => {
  logAuditEvent(
    action.toUpperCase(),
    userId,
    resourceType,
    resourceId,
    {},
    'success',
    req
  );
};

/**
 * Get recent logs
 */
export const getRecentLogs = (limit: number = 100): SecurityLog[] => {
  return logStore.slice(-limit).reverse();
};

/**
 * Get logs by event type
 */
export const getLogsByEventType = (eventType: string): SecurityLog[] => {
  return logStore.filter(log => log.eventType === eventType);
};

/**
 * Get logs by severity
 */
export const getLogsBySeverity = (severity: SecurityLog['severity']): SecurityLog[] => {
  return logStore.filter(log => log.severity === severity);
};

/**
 * Get logs by IP
 */
export const getLogsByIP = (ip: string): SecurityLog[] => {
  return logStore.filter(log => log.ip === ip);
};

/**
 * Get logs by user
 */
export const getLogsByUser = (userId: string): SecurityLog[] => {
  return logStore.filter(log => log.userId === userId);
};

/**
 * Get logs for a time range
 */
export const getLogsForTimeRange = (startTime: Date, endTime: Date): SecurityLog[] => {
  return logStore.filter(log => log.timestamp >= startTime && log.timestamp <= endTime);
};

/**
 * Export logs to file
 */
export const exportLogsToFile = (fileName: string, logs: SecurityLog[] = logStore): boolean => {
  try {
    ensureLogsDirectory();
    const filePath = path.join(logsDir, fileName);
    const content = logs.map(log => formatLogEntry(log)).join('\n');
    fs.writeFileSync(filePath, content);
    console.log(`[Logging] Exported ${logs.length} logs to ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error exporting logs:', error);
    return false;
  }
};

/**
 * Clear old logs from memory
 */
export const clearOldLogsFromMemory = (hoursToKeep: number = 24): void => {
  const cutoffTime = new Date(Date.now() - hoursToKeep * 60 * 60 * 1000);
  const initialLength = logStore.length;

  for (let i = logStore.length - 1; i >= 0; i--) {
    if (logStore[i].timestamp < cutoffTime) {
      logStore.splice(i, 1);
    }
  }

  const removed = initialLength - logStore.length;
  if (removed > 0) {
    console.log(`[Logging] Cleared ${removed} old logs from memory`);
  }
};

/**
 * Get log statistics
 */
export const getLogStatistics = () => {
  const stats = {
    total: logStore.length,
    byEventType: {} as Record<string, number>,
    bySeverity: {} as Record<string, number>,
    byIP: {} as Record<string, number>,
  };

  for (const log of logStore) {
    stats.byEventType[log.eventType] = (stats.byEventType[log.eventType] || 0) + 1;
    stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
    stats.byIP[log.ip] = (stats.byIP[log.ip] || 0) + 1;
  }

  return stats;
};

/**
 * Middleware to log all requests
 */
export const requestLoggingMiddleware = (req: Request, res: Response, next: Function) => {
  const startTime = Date.now();

  // Override res.send to log response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;

    // Log requests with errors or suspicious status codes
    if (res.statusCode >= 400) {
      logSecurityEvent(
        'HTTP_ERROR',
        res.statusCode >= 500 ? 'error' : 'warning',
        `HTTP ${res.statusCode} on ${req.method} ${req.path}`,
        req,
        {
          duration,
          statusCode: res.statusCode,
        }
      );
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Start log cleanup scheduler
 */
export const startLogCleanupScheduler = () => {
  setInterval(() => {
    clearOldLogsFromMemory(24);
  }, 60 * 60 * 1000); // Run every hour
};
