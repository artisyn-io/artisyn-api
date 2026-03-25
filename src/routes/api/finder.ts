import { Router } from "express";
import FinderListingController from "../../controllers/FinderListingController";
import { authMiddleware } from "../../middleware/auth";
import { handleValidation } from "../../middleware/validate";
import { isFinder } from "../../middleware/role";
import { finderListingValidation } from "../../models/validation";

const router = Router();
const controller = new FinderListingController();

// =============================================================================
// Finder Listings Routes (Protected - Finder Only)
// =============================================================================

/**
 * GET /api/finder/listings
 * Fetch all listings created by the authenticated finder.
 * Requires: Authentication + Finder/Admin Role
 */
router.get(
  "/listings",
  authMiddleware,
  isFinder,
  finderListingValidation.getAll,
  handleValidation,
  controller.index
);

/**
 * GET /api/finder/listings/:id
 * Fetch a single listing by ID (owner only).
 * Requires: Authentication + Finder/Admin Role + Ownership Check
 */
router.get(
  "/listings/:id",
  authMiddleware,
  isFinder,
  finderListingValidation.getOne,
  handleValidation,
  controller.show
);

/**
 * POST /api/finder/listings
 * Create a new listing as a finder.
 * Requires: Authentication + Finder/Admin Role + Validation
 */
router.post(
  "/listings",
  authMiddleware,
  isFinder,
  finderListingValidation.create,
  handleValidation,
  controller.create
);

/**
 * PUT /api/finder/listings/:id
 * Update an existing listing (owner only).
 * Requires: Authentication + Finder/Admin Role + Validation + Ownership Check
 */
router.put(
  "/listings/:id",
  authMiddleware,
  isFinder,
  finderListingValidation.update,
  handleValidation,
  controller.update
);

/**
 * DELETE /api/finder/listings/:id
 * Delete a listing (owner only).
 * Requires: Authentication + Finder/Admin Role + Ownership Check
 */
router.delete(
  "/listings/:id",
  authMiddleware,
  isFinder,
  finderListingValidation.delete,
  handleValidation,
  controller.delete
);

export default router;
