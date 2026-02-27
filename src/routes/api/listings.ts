import { Router } from 'express';
import ListingController from '../../controllers/ListingController';
import ApplicationController from '../../controllers/ApplicationController';
import { authMiddleware } from '../../middleware/auth';
import { handleValidation } from '../../middleware/validate';
import { isCurator } from '../../middleware/role';
import { artisanValidation, applicationValidation } from '../../models/validation';

const router = Router();
const controller = new ListingController();
const applicationController = new ApplicationController();

// =============================================================================
// Public Routes
// =============================================================================

/**
 * GET /api/listings
 * Fetch all active listings with support for filtering, sorting, and pagination.
 */
router.get('/', controller.index);

/**
 * GET /api/listings/:id
 * Fetch a single listing by ID with relation details.
 */
router.get('/:id', controller.show);

// =============================================================================
// Protected Routes (Curator & Admin Only)
// =============================================================================

/**
 * POST /api/listings
 * Create a new listing.
 * Requires: Authentication + Curator/Admin Role + Validation
 */
router.post(
    '/',
    authMiddleware,
    isCurator,
    artisanValidation.create,
    handleValidation,
    controller.create
);

/**
 * PUT /api/listings/:id
 * Update an existing listing.
 * Requires: Authentication + Curator/Admin Role + Validation + Ownership Check
 */
router.put(
    '/:id',
    authMiddleware,
    isCurator,
    artisanValidation.update,
    handleValidation,
    controller.update
);

/**
 * DELETE /api/listings/:id
 * Remove a listing.
 * Requires: Authentication + Curator/Admin Role + Ownership Check
 */
router.delete(
    '/:id',
    authMiddleware,
    isCurator,
    controller.delete
);

// =============================================================================
// Application Routes (Owner Only)
// =============================================================================

/**
 * GET /api/listings/:listingId/applications
 * List all applications for a specific listing.
 * Requires: Authentication + Listing ownership
 */
router.get(
    '/:listingId/applications',
    authMiddleware,
    applicationController.index
);

/**
 * GET /api/applications/:id
 * Get a specific application.
 * Requires: Authentication + Owner or Applicant
 */
router.get(
    '/applications/:id',
    authMiddleware,
    applicationController.show
);

/**
 * PUT /api/applications/:id/status
 * Update application status.
 * Requires: Authentication + Owner (to accept/reject) or Applicant (to withdraw)
 */
router.put(
    '/applications/:id/status',
    authMiddleware,
    applicationValidation.updateStatus,
    handleValidation,
    applicationController.updateStatus
);

export default router;
