import { Router } from 'express';
import SupportTicketController from '../../controllers/SupportTicketController';
import { authMiddleware } from '../../middleware/auth';
import { handleValidation } from '../../middleware/validate';
import { supportValidation } from '../../models/validation';

const router = Router();
const controller = new SupportTicketController();

/**
 * Authenticated support tickets (mounted at /api/support).
 * The anonymous contact form lives at POST /api/contact.
 */
router.get('/tickets', authMiddleware, supportValidation.list, handleValidation, controller.index);
router.post('/tickets', authMiddleware, supportValidation.create, handleValidation, controller.create);
router.get('/tickets/:id', authMiddleware, supportValidation.getOne, handleValidation, controller.show);
router.patch('/tickets/:id', authMiddleware, supportValidation.triage, handleValidation, controller.triage);
router.post('/tickets/:id/messages', authMiddleware, supportValidation.reply, handleValidation, controller.reply);

export default router;
