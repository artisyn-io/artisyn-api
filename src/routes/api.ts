import CategoryController from "src/controllers/CategoryController";
import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (req: Request, res: Response) => {
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

// Artisan search and listing endpoints
router.use("/artisans", (await import("./api/artisans")).default);

export default router;