import ArtisanContactController from 'src/controllers/Curator/ArtisanContactController';
import ArtisanController from 'src/controllers/Curator/ArtisanController';
import ArtisanStateController from 'src/controllers/Curator/ArtisanStateController';
import CuratorVerificationController from 'src/controllers/Curator/CuratorVerificationController';
import { Router } from 'express';
import { authenticateToken } from 'src/utils/helpers';
import { isCurator } from 'src/middleware/role';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'public/artisans' });
const verificationUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 250 * 1024 }
});

router.get('/artisans', authenticateToken, new ArtisanController().index);
router.post('/artisans', authenticateToken, upload.none(), new ArtisanController().create);
router.post('/artisans/bulk', authenticateToken, upload.none(), new ArtisanStateController().bulk);
router.get('/artisans/:id', authenticateToken, new ArtisanController().show);
router.put('/artisans/:id', authenticateToken, upload.none(), new ArtisanController().update);
router.delete('/artisans/:id', authenticateToken, upload.none(), new ArtisanController().delete);
router.put('/artisans/:id/activation', authenticateToken, upload.none(), new ArtisanStateController().activation);

// Contact info endpoint with analytics tracking
router.get('/artisans/:id/contact', authenticateToken, new ArtisanContactController().show);

// Curator verification routes
const verificationController = new CuratorVerificationController();
router.post('/verification/submit', authenticateToken, isCurator, verificationUpload.array('documents', 10), verificationController.submit);
router.get('/verification/status', authenticateToken, isCurator, verificationController.getStatus);

export default router;
