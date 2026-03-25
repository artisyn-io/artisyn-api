import { Router } from 'express';
import ApplicationController from '../../controllers/ApplicationController';
import { authMiddleware } from '../../middleware/auth';
import { handleValidation } from '../../middleware/validate';
import { applicationValidation } from '../../models/validation';

const router = Router();
const controller = new ApplicationController();

// ============================================================================
// Application management routes
// ============================================================================

/**
 * POST /api/applications
 * Authenticated user may submit an application for an existing listing
 */
router.post(
  '/applications',
  authMiddleware,
  applicationValidation.create,
  handleValidation,
  controller.create
);

/**
 * GET /api/applications/:id
 * Listing owner or applicant may fetch application details
 */
router.get(
  '/applications/:id',
  authMiddleware,
  applicationValidation.getOne,
  handleValidation,
  controller.show
);

/**
 * DELETE /api/applications/:id
 * Applicant may withdraw a pending application
 */
router.delete(
  '/applications/:id',
  authMiddleware,
  applicationValidation.delete,
  handleValidation,
  controller.destroy
);

/**
 * GET /api/listings/:listingId/applications
 * Listing owner may view applications for their listing
 */
router.get(
  '/listings/:listingId/applications',
  authMiddleware,
  applicationValidation.listByListing,
  handleValidation,
  controller.index
);

/**
 * PUT /api/applications/:id/status
 * Listing owner may accept/reject; applicant may withdraw
 */
router.put(
  '/applications/:id/status',
  authMiddleware,
  applicationValidation.updateStatus,
  handleValidation,
  controller.updateStatus
);

export default router;
