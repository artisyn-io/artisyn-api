import AnalyticsController from 'src/controllers/AnalyticsController';
import CategoryController from 'src/controllers/Admin/CategoryController';
import { Router } from 'express';
import { authenticateToken } from 'src/utils/helpers';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'public/media' })

// Category routes
router.get('/categories', authenticateToken, new CategoryController().index);
router.post('/categories', authenticateToken, upload.none(), new CategoryController().create);
router.get('/categories/:id', authenticateToken, new CategoryController().show);
router.put('/categories/:id', authenticateToken, upload.none(), new CategoryController().update);
router.delete('/categories/:id', authenticateToken, upload.none(), new CategoryController().delete);

// Analytics routes
const analyticsController = new AnalyticsController();
router.get('/analytics', authenticateToken, analyticsController.index);
router.get('/analytics/summary', authenticateToken, analyticsController.summary);
router.get('/analytics/aggregations', authenticateToken, analyticsController.aggregations);
router.get('/analytics/event-types', authenticateToken, analyticsController.eventTypes);
router.post('/analytics/aggregate', authenticateToken, analyticsController.create);
router.delete('/analytics/cleanup', authenticateToken, analyticsController.delete);

export default router;
