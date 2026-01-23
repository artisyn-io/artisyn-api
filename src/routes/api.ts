import CategoryController from '../controllers/CategoryController';
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
    res.json({
        data: {
            message: 'Welcome to Artisyn API',
            version: '1.0.0',
        },
        status: 'success',
        message: 'OK',
        code: 200,
    });
});

router.get('/categories', new CategoryController().index);
router.get('/categories/:id', new CategoryController().show);

export default router;
