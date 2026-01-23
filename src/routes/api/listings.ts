import { Router } from 'express';
import ListingController from '../../controllers/ListingController';
import { authMiddleware } from '../../middleware/auth';
import { handleValidation } from '../../middleware/validate';
import { isCurator } from '../../middleware/role';
import { artisanValidation } from '../../models/validation';

const router = Router();
const controller = new ListingController();

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

export default router;
