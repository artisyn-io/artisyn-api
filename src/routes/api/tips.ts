import TipController from "src/controllers/TipController";
import ArtisanTipController from "src/controllers/ArtisanTipController";
import CuratorTipController from "src/controllers/CuratorTipController";
import { Router } from "express";
import { authenticateToken } from "src/utils/helpers";
import multer from "multer";

const router = Router();
const upload = multer();

const tipController = new TipController();
const artisanTipController = new ArtisanTipController();
const curatorTipController = new CuratorTipController();

// List all tips for authenticated user (self only, admin sees all)
router.get("/tips", authenticateToken, tipController.index);

// Get specific tip (sender, recipient, or admin only)
router.get("/tips/:id", authenticateToken, tipController.show);

// Create a new peer-to-peer tip
router.post("/tips", authenticateToken, upload.none(), tipController.create);

// Update tip status (sender or admin only, PENDING tips only)
router.put("/tips/:id", authenticateToken, upload.none(), tipController.update);

// Create tip for specific artisan (tip goes to artisan's curator)
router.post(
    "/artisans/:id/tips",
    authenticateToken,
    upload.none(),
    artisanTipController.create
);

// Create tip for specific curator
router.post(
    "/curator/:id/tips",
    authenticateToken,
    upload.none(),
    curatorTipController.create
);

export default router;
