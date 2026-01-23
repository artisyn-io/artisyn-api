import ArtisanContactController from '../../controllers/Curator/ArtisanContactController';
import ArtisanController from '../../controllers/Curator/ArtisanController';
import ArtisanStateController from '../../controllers/Curator/ArtisanStateController';
import { Router } from 'express';
import { authenticateToken } from '../../utils/helpers';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'public/artisans' })

router.get('/artisans', authenticateToken, new ArtisanController().index);
router.post('/artisans', authenticateToken, upload.none(), new ArtisanController().create);
router.post('/artisans/bulk', authenticateToken, upload.none(), new ArtisanStateController().bulk);
router.get('/artisans/:id', authenticateToken, new ArtisanController().show);
router.put('/artisans/:id', authenticateToken, upload.none(), new ArtisanController().update);
router.delete('/artisans/:id', authenticateToken, upload.none(), new ArtisanController().delete);
router.put('/artisans/:id/activation', authenticateToken, upload.none(), new ArtisanStateController().activation);

// Contact info endpoint with analytics tracking
router.get('/artisans/:id/contact', authenticateToken, new ArtisanContactController().show);

export default router;
