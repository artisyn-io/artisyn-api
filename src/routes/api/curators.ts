import { Router } from 'express';
import CuratorController from '../../controllers/CuratorController';

const router = Router();
const controller = new CuratorController();

// =============================================================================
// Public Routes
// =============================================================================

/**
 * GET /api/curators
 * Fetch all curators with support for filtering, sorting, and pagination.
 */
router.get('/', controller.index);

/**
 * GET /api/curators/:id
 * Fetch a single curator by ID with full profile details.
 */
router.get('/:id', controller.show);

export default router;
