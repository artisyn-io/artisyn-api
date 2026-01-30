import { Request, Response } from 'express';
import { getBlockedIPs, blockIP, unblockIP } from '../middleware/ipBlocking';
import { getMonitoringDashboard, getRecentAlerts, resolveAlert } from '../services/monitoringService';
import { getRecentLogs, getLogStatistics, exportLogsToFile } from '../utils/securityLogging';
import { getAPIKeyInfo } from '../services/apiKeyService';

/**
 * Security Management Controller
 * Provides endpoints for security administration and monitoring
 */

export class SecurityController {
  /**
   * Get security dashboard
   * GET /api/security/dashboard
   */
  static async getDashboard(req: Request, res: Response) {
    try {
      const dashboard = getMonitoringDashboard();
      const blockedIPs = getBlockedIPs();
      const logStats = getLogStatistics();

      return res.json({
        success: true,
        data: {
          monitoring: dashboard,
          blockedIPs,
          logStatistics: logStats,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error getting security dashboard:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving security dashboard',
      });
    }
  }

  /**
   * Get recent security alerts
   * GET /api/security/alerts
   */
  static async getAlerts(req: Request, res: Response) {
    try {
      const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
      const limit = parseInt(limitParam as string) || 50;
      const alerts = getRecentAlerts(limit);

      return res.json({
        success: true,
        data: alerts,
        count: alerts.length,
      });
    } catch (error) {
      console.error('Error getting alerts:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving alerts',
      });
    }
  }

  /**
   * Resolve a security alert
   * PUT /api/security/alerts/:alertId/resolve
   */
  static async resolveSecurityAlert(req: Request, res: Response) {
    try {
      const alertId = Array.isArray(req.params.alertId) ? req.params.alertId[0] : req.params.alertId;
      const resolved = resolveAlert(alertId);

      if (!resolved) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found',
        });
      }

      return res.json({
        success: true,
        message: 'Alert resolved',
      });
    } catch (error) {
      console.error('Error resolving alert:', error);
      return res.status(500).json({
        success: false,
        message: 'Error resolving alert',
      });
    }
  }

  /**
   * Get blocked IPs
   * GET /api/security/blocked-ips
   */
  static async getBlockedIPsList(req: Request, res: Response) {
    try {
      const blocked = getBlockedIPs();

      return res.json({
        success: true,
        data: blocked,
        count: blocked.length,
      });
    } catch (error) {
      console.error('Error getting blocked IPs:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving blocked IPs',
      });
    }
  }

  /**
   * Block an IP address
   * POST /api/security/blocked-ips
   */
  static async blockIPAddress(req: Request, res: Response) {
    try {
      const { ip, reason, durationMs } = req.body;

      if (!ip) {
        return res.status(400).json({
          success: false,
          message: 'IP address is required',
        });
      }

      blockIP(ip, reason || 'Manual block', durationMs || 60 * 60 * 1000);

      return res.json({
        success: true,
        message: `IP ${ip} blocked successfully`,
        data: {
          ip,
          blockedUntil: new Date(Date.now() + (durationMs || 60 * 60 * 1000)),
        },
      });
    } catch (error) {
      console.error('Error blocking IP:', error);
      return res.status(500).json({
        success: false,
        message: 'Error blocking IP address',
      });
    }
  }

  /**
   * Unblock an IP address
   * DELETE /api/security/blocked-ips/:ip
   */
  static async unblockIPAddress(req: Request, res: Response) {
    try {
      const ip = Array.isArray(req.params.ip) ? req.params.ip[0] : req.params.ip;

      if (!ip) {
        return res.status(400).json({
          success: false,
          message: 'IP address is required',
        });
      }

      unblockIP(ip);

      return res.json({
        success: true,
        message: `IP ${ip} unblocked successfully`,
      });
    } catch (error) {
      console.error('Error unblocking IP:', error);
      return res.status(500).json({
        success: false,
        message: 'Error unblocking IP address',
      });
    }
  }

  /**
   * Get security logs
   * GET /api/security/logs
   */
  static async getLogs(req: Request, res: Response) {
    try {
      const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
      const limit = parseInt(limitParam as string) || 100;
      const type = Array.isArray(req.query.type) ? req.query.type[0] : (req.query.type as string);
      const severity = Array.isArray(req.query.severity) ? req.query.severity[0] : (req.query.severity as string);

      let logs = getRecentLogs(limit);

      if (type && typeof type === 'string') {
        logs = logs.filter(log => log.eventType.toLowerCase().includes(type.toLowerCase()));
      }

      if (severity && typeof severity === 'string') {
        logs = logs.filter(log => log.severity === severity);
      }

      return res.json({
        success: true,
        data: logs,
        count: logs.length,
      });
    } catch (error) {
      console.error('Error getting logs:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving logs',
      });
    }
  }

  /**
   * Export logs to file
   * POST /api/security/logs/export
   */
  static async exportLogs(req: Request, res: Response) {
    try {
      const { fileName } = req.body;
      const limitParam = Array.isArray(req.body.limit) ? req.body.limit[0] : req.body.limit;
      const limit = parseInt(limitParam as string) || 1000;
      const logs = getRecentLogs(limit);

      const success = exportLogsToFile(fileName || `security_logs_${Date.now()}.log`, logs);

      if (!success) {
        return res.status(500).json({
          success: false,
          message: 'Error exporting logs',
        });
      }

      return res.json({
        success: true,
        message: 'Logs exported successfully',
        data: {
          fileName: fileName || `security_logs_${Date.now()}.log`,
          exportedCount: logs.length,
        },
      });
    } catch (error) {
      console.error('Error exporting logs:', error);
      return res.status(500).json({
        success: false,
        message: 'Error exporting logs',
      });
    }
  }

  /**
   * Get log statistics
   * GET /api/security/logs/statistics
   */
  static async getLogStatisticsEndpoint(req: Request, res: Response) {
    try {
      const stats = getLogStatistics();

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error getting log statistics:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving log statistics',
      });
    }
  }

  /**
   * Get API key info
   * GET /api/security/api-keys/:keyId
   */
  static async getAPIKeyDetails(req: Request, res: Response) {
    try {
      const keyId = Array.isArray(req.params.keyId) ? req.params.keyId[0] : req.params.keyId;
      const apiKey = await getAPIKeyInfo(keyId);

      if (!apiKey) {
        return res.status(404).json({
          success: false,
          message: 'API key not found',
        });
      }

      return res.json({
        success: true,
        data: {
          id: apiKey.id,
          name: apiKey.name,
          description: apiKey.description,
          status: apiKey.status,
          rateLimit: apiKey.rateLimit,
          createdAt: apiKey.createdAt,
          expiresAt: apiKey.expiresAt,
          lastUsedAt: apiKey.lastUsedAt,
          ipWhitelist: apiKey.ipWhitelist,
          allowedEndpoints: apiKey.allowedEndpoints,
        },
      });
    } catch (error) {
      console.error('Error getting API key info:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving API key info',
      });
    }
  }

  /**
   * Get security health status
   * GET /api/security/health
   */
  static async getSecurityHealth(req: Request, res: Response) {
    try {
      const blockedIPs = getBlockedIPs();
      const alerts = getRecentAlerts(5);
      const logs = getRecentLogs(5);

      const health = {
        status: 'healthy' as 'healthy' | 'warning' | 'critical',
        blockedIPCount: blockedIPs.length,
        unhandledAlerts: alerts.filter(a => !a.resolved).length,
        recentErrors: logs.filter(l => l.severity === 'error').length,
        timestamp: new Date(),
      };

      // Set status based on metrics
      if (health.blockedIPCount > 100 || health.unhandledAlerts > 50) {
        health.status = 'critical';
      } else if (health.blockedIPCount > 10 || health.unhandledAlerts > 10) {
        health.status = 'warning';
      }

      return res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      console.error('Error getting security health:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving security health',
      });
    }
  }
}

export default SecurityController;
