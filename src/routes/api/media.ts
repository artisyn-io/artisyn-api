import MediaController from '../../controllers/MediaController';
import { Router } from 'express';
import { authenticateToken } from '../../utils/helpers';
import multer from 'multer';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, WEBP, GIF, PDF, DOC, and TXT are allowed.'));
        }
    }
});
const controller = new MediaController();

router.use(authenticateToken);

router.get('/', controller.index);
router.post('/upload', upload.single('file'), controller.upload);
router.post('/upload/bulk', upload.array('files', 10), controller.uploadBulk);
router.get('/:id', controller.show);
router.put('/:id', controller.update);
router.delete('/:id', controller.destroy);

export default router;
