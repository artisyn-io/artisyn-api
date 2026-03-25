import { Router } from 'express';
import JobController from '../../controllers/JobController';
import { authMiddleware } from '../../middleware/auth';
import { handleValidation } from '../../middleware/validate';
import { jobValidation } from '../../models/validation';

const router = Router();
const controller = new JobController();

// ============================================================================
// Job lifecycle management routes
// ============================================================================

/**
 * GET /api/jobs
 * List jobs for the authenticated user
 * - ADMIN: Can see all jobs
 * - CURATOR: Can see jobs where they are the curator
 * - USER: Can see jobs where they are the client
 */
router.get(
    '/jobs',
    authMiddleware,
    jobValidation.getAll,
    handleValidation,
    controller.index
);

/**
 * GET /api/jobs/:id
 * Get job details (involved parties only: client, curator, or admin)
 */
router.get(
    '/jobs/:id',
    authMiddleware,
    jobValidation.getOne,
    handleValidation,
    controller.show
);

/**
 * PUT /api/jobs/:id
 * Update job (involved parties only: client, curator, or admin)
 * 
 * Allowed updates:
 * - status: Update job status (with transition validation)
 * - notes: Add or update notes
 */
router.put(
    '/jobs/:id',
    authMiddleware,
    jobValidation.update,
    handleValidation,
    controller.update
);

/**
 * DELETE /api/jobs/:id
 * Delete job (admin only or system rule)
 * 
 * System rule: Jobs can only be deleted if they are in 'cancelled' or 'disputed' status
 */
router.delete(
    '/jobs/:id',
    authMiddleware,
    jobValidation.delete,
    handleValidation,
    controller.destroy
);

export default router;
