import { Router, Request, Response } from 'express';
import { prisma } from 'src/db';

const router = Router();

/**
 * Health Check Routes
 * 
 * Lightweight public endpoints for load balancers, orchestrators, and uptime checks.
 * These endpoints should remain simple and fast - no authentication required.
 */

/**
 * Liveness Probe Endpoint
 * 
 * GET /health
 * 
 * Used by orchestrators (like Kubernetes) to check if the application is running.
 * Returns 200 if the server is up and responding.
 * 
 * Response: { status: 'ok', timestamp: ISO8601 }
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness Probe Endpoint
 * 
 * GET /ready
 * 
 * Used by load balancers and orchestrators to check if the application can
 * handle incoming requests. This includes checking critical dependencies
 * like database connectivity.
 * 
 * Response: { status: 'ready', timestamp: ISO8601 } if healthy
 *           { status: 'not_ready', timestamp: ISO8601, error: string } if not
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: 'Database connection unavailable',
    });
  }
});

export default router;