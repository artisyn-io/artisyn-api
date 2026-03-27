import { Router } from 'express';
import JobController from '../../controllers/JobController';
import { authMiddleware } from '../../middleware/auth';
import { handleValidation } from '../../middleware/validate';
import { jobValidation } from '../../models/validation';

const router = Router();
const controller = new JobController();

/**
 * GET /api/jobs
 * Retrieve jobs for the authenticated user (curators see their listings, admins see all).
 */
router.get(
  '/',
  authMiddleware,
  jobValidation.list,
  handleValidation,
  controller.index
);

/**
 * GET /api/jobs/:id
 * Accessible to participants of a job (applicant/curator) or admin.
 */
router.get(
  '/:id',
  authMiddleware,
  jobValidation.getOne,
  handleValidation,
  controller.show
);

/**
 * PUT /api/jobs/:id
 * Update job status.
 */
router.put(
  '/:id',
  authMiddleware,
  jobValidation.update,
  handleValidation,
  controller.update
);

/**
 * DELETE /api/jobs/:id
 * Admin-only job removal.
 */
router.delete(
  '/:id',
  authMiddleware,
  jobValidation.delete,
  handleValidation,
  controller.destroy
);

export default router;
