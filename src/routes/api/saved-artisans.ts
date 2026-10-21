import { Router } from "express";
import SavedArtisanController from "../../controllers/SavedArtisanController";
import { authMiddleware } from "../../middleware/auth";
import { handleValidation } from "../../middleware/validate";
import { savedArtisanValidation } from "../../models/validation";

const router: Router = Router();
const controller = new SavedArtisanController();

/**
 * Saved Artisans (Shortlist) API Routes
 * 
 * All endpoints require authentication and operate in the context
 * of the currently authenticated user.
 */

// GET /api/saved-artisans/ids - Batch IDs endpoint to prevent N+1 queries
router.get("/ids", authMiddleware, savedArtisanValidation.ids, handleValidation, controller.ids);

// GET /api/saved-artisans/count - Direct count endpoint for dashboard widgets
router.get("/count", authMiddleware, controller.count);

// GET /api/saved-artisans - Paginated saved artisans with full card data
router.get("/", authMiddleware, savedArtisanValidation.list, handleValidation, controller.index);

// GET /api/saved-artisans/:artisanId - Specific saved artisan lookup
router.get("/:artisanId", authMiddleware, savedArtisanValidation.getOne, handleValidation, controller.show);

// PUT /api/saved-artisans/:artisanId - Idempotent save/shortlist
router.put("/:artisanId", authMiddleware, savedArtisanValidation.save, handleValidation, controller.save);

// POST /api/saved-artisans/:artisanId - Alias for save/shortlist
router.post("/:artisanId", authMiddleware, savedArtisanValidation.save, handleValidation, controller.save);

// DELETE /api/saved-artisans/:artisanId - Idempotent remove from shortlist
router.delete("/:artisanId", authMiddleware, savedArtisanValidation.remove, handleValidation, controller.remove);

export default router;
