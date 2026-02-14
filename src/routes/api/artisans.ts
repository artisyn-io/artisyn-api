import ArtisanSearchController from "src/controllers/ArtisanSearchController";
import { Router } from "express";

const router = Router();
const artisanSearchController = new ArtisanSearchController();

// Public artisan search and listing endpoints
router.get("/", artisanSearchController.index);
router.get("/suggestions", artisanSearchController.suggestions);
router.get("/popular", artisanSearchController.popular);

export default router;
