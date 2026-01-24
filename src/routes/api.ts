import CategoryController from "src/controllers/CategoryController";
import ReviewController from "src/controllers/ReviewController";
import { Router } from "express";

const router = Router();
const reviewController = new ReviewController();

router.get("/", (req, res) => {
  res.json({
    data: {
      message: "Welcome to Artisyn API",
      version: "1.0.0",
    },
    status: "success",
    message: "OK",
    code: 200,
  });
});

router.get("/categories", new CategoryController().index);
router.get("/categories/:id", new CategoryController().show);

// Get reviews for a specific artisan
router.get("/artisans/:id/reviews", reviewController.artisanReviews);

// Get reviews for a specific curator
router.get("/curators/:id/reviews", reviewController.curatorReviews);

export default router;
