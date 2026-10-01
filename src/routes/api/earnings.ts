import { Router } from 'express';

import ArtisanEarningsController from 'src/controllers/ArtisanEarningsController';
import { authenticateToken } from 'src/utils/helpers';

const router = Router();
const controller = new ArtisanEarningsController();

router.get('/summary', authenticateToken, controller.summary.bind(controller));
router.get('/transactions', authenticateToken, controller.transactions.bind(controller));

export default router;
