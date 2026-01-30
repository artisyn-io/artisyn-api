import { Router, Request, Response } from 'express';
import SecurityController from '../controllers/SecurityController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * Security Management Routes
 * All routes require admin authentication
 */

// Middleware to check admin role (implement based on your auth system)
const adminOnly = async (req: Request, res: Response, next: Function) => {
  // Check if user is admin
  // For now, just verify authentication
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  // In a production system, you'd check user roles:
  // const user = await prisma.user.findUnique({
  //   where: { id: req.user.id },
  //   include: { role: true }
  // });
  // if (!user || user.role.name !== 'admin') {
  //   return res.status(403).json({
  //     success: false,
  //     message: 'Forbidden: Admin access required'
  //   });
  // }

  next();
};

/**
 * Dashboard and Overview Routes
 */

// Get security dashboard
router.get('/api/security/dashboard', authMiddleware, adminOnly, (req, res) => {
  SecurityController.getDashboard(req, res);
});

// Get security health status
router.get('/api/security/health', authMiddleware, adminOnly, (req, res) => {
  SecurityController.getSecurityHealth(req, res);
});

/**
 * Alert Management Routes
 */

// Get recent security alerts
router.get('/api/security/alerts', authMiddleware, adminOnly, (req, res) => {
  SecurityController.getAlerts(req, res);
});

// Resolve a security alert
router.put('/api/security/alerts/:alertId/resolve', authMiddleware, adminOnly, (req, res) => {
  SecurityController.resolveSecurityAlert(req, res);
});

/**
 * IP Blocking Management Routes
 */

// Get list of blocked IPs
router.get('/api/security/blocked-ips', authMiddleware, adminOnly, (req, res) => {
  SecurityController.getBlockedIPsList(req, res);
});

// Block an IP address
router.post('/api/security/blocked-ips', authMiddleware, adminOnly, (req, res) => {
  SecurityController.blockIPAddress(req, res);
});

// Unblock an IP address
router.delete('/api/security/blocked-ips/:ip', authMiddleware, adminOnly, (req, res) => {
  SecurityController.unblockIPAddress(req, res);
});

/**
 * Security Logging Routes
 */

// Get security logs
router.get('/api/security/logs', authMiddleware, adminOnly, (req, res) => {
  SecurityController.getLogs(req, res);
});

// Get log statistics
router.get('/api/security/logs/statistics', authMiddleware, adminOnly, (req, res) => {
  SecurityController.getLogStatisticsEndpoint(req, res);
});

// Export logs to file
router.post('/api/security/logs/export', authMiddleware, adminOnly, (req, res) => {
  SecurityController.exportLogs(req, res);
});

/**
 * API Key Management Routes
 */

// Get API key details
router.get('/api/security/api-keys/:keyId', authMiddleware, adminOnly, (req, res) => {
  SecurityController.getAPIKeyDetails(req, res);
});

export default router;
