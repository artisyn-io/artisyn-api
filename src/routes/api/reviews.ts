import ReviewController from "src/controllers/ReviewController";
import { Router } from "express";
import { authenticateToken } from "src/utils/helpers";
import multer from "multer";
import rateLimit from "express-rate-limit";

const router = Router();
const upload = multer();
const reviewController = new ReviewController();

// Rate limiter for review submission (prevent spam)
const reviewSubmitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Max 10 reviews per 15 minutes
    message: {
        status: "error",
        message: "Too many reviews submitted. Please try again later.",
        code: 429,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter for report submission
const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Max 5 reports per hour
    message: {
        status: "error",
        message: "Too many reports submitted. Please try again later.",
        code: 429,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// ==================== REVIEW CRUD ====================

// List all reviews (with filters)
router.get("/reviews", authenticateToken, reviewController.index);

// Get rating aggregation for a user/curator
router.get("/reviews/aggregation/:targetId", reviewController.aggregation);

// Get moderation queue (admin only)
router.get("/reviews/moderation-queue", authenticateToken, reviewController.moderationQueue);

// Get pending reports (admin only)
router.get("/reviews/reports", authenticateToken, reviewController.getReports);

// Get specific review
router.get("/reviews/:id", authenticateToken, reviewController.show);

// Create a new review (rate limited)
router.post(
    "/reviews",
    authenticateToken,
    reviewSubmitLimiter,
    upload.none(),
    reviewController.create
);

// Update a review (author only, while pending)
router.put("/reviews/:id", authenticateToken, upload.none(), reviewController.update);

// Delete a review (author or admin only)
router.delete("/reviews/:id", authenticateToken, reviewController.delete);

// ==================== MODERATION ====================

// Moderate a review (admin only)
router.put(
    "/reviews/:id/moderate",
    authenticateToken,
    upload.none(),
    reviewController.moderate
);

// ==================== CURATOR RESPONSES ====================

// Add response to a review (target curator only)
router.post(
    "/reviews/:id/respond",
    authenticateToken,
    upload.none(),
    reviewController.respond
);

// Update response (target curator only)
router.put(
    "/reviews/:id/respond",
    authenticateToken,
    upload.none(),
    reviewController.updateResponse
);

// Delete response (target curator or admin only)
router.delete("/reviews/:id/respond", authenticateToken, reviewController.deleteResponse);

// ==================== ABUSE REPORTING ====================

// Report a review (rate limited)
router.post(
    "/reviews/:id/report",
    authenticateToken,
    reportLimiter,
    upload.none(),
    reviewController.report
);

// Resolve a report (admin only)
router.put(
    "/reviews/reports/:id",
    authenticateToken,
    upload.none(),
    reviewController.resolveReport
);

// ==================== RESOURCE-SPECIFIC REVIEWS ====================

// Get reviews for a specific artisan
router.get("/artisans/:id/reviews", reviewController.artisanReviews);

// Get reviews for a specific curator
router.get("/curators/:id/reviews", reviewController.curatorReviews);

export default router;
