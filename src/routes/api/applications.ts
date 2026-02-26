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
  applicationValidation.statusUpdate,
  handleValidation,
  controller.updateStatus
);

export default router;
