import { Router } from 'express';
import ApplicationController from '../../controllers/ApplicationController';
import { authMiddleware } from '../../middleware/auth';
import { handleValidation } from '../../middleware/validate';
import { applicationValidation } from '../../models/validation';

const router = Router();
const controller = new ApplicationController();

// ============================================================================
// Application routes
// ============================================================================

/**
 * POST /api/applications
 * Authenticated user applies to a listing
 */
router.post(
  '/applications',
  authMiddleware,
  applicationValidation.create,
  handleValidation,
  controller.create
);

/**
 * GET /api/applications
 * Paginated applications collection scoped to the caller:
 * - scope=mine (default for users): applications the caller submitted
 * - scope=received (default for curators): applications to listings the caller owns
 * - scope=all (admin only): every application
 * Filters: status, listingId. Ordered by createdAt desc, id desc.
 */
router.get(
  '/applications',
  authMiddleware,
  applicationValidation.list,
  handleValidation,
  controller.list
);

/**
 * GET /api/applications/:id
 * Applicant or listing owner views a specific application
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
 * Applicant deletes their own pending application
 */
router.delete(
  '/applications/:id',
  authMiddleware,
  applicationValidation.delete,
  handleValidation,
  controller.delete
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
 * Canonical status mutation (status is case-insensitive).
 * Allowed transitions: PENDING -> ACCEPTED | REJECTED (listing owner),
 * PENDING -> WITHDRAWN (applicant). All other statuses are final.
 */
router.put(
  '/applications/:id/status',
  authMiddleware,
  applicationValidation.updateStatus,
  handleValidation,
  controller.updateStatus
);

export default router;
