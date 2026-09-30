import { Router } from 'express';
import JobRequestController from '../../controllers/JobRequestController';
import ProposalController from '../../controllers/ProposalController';
import { authMiddleware } from '../../middleware/auth';
import { handleValidation } from '../../middleware/validate';
import { jobRequestValidation } from '../../models/validation';

const router = Router();
const controller = new JobRequestController();
const proposals = new ProposalController();

/**
 * Client job requests (open opportunities) and artisan proposals.
 *
 * Lifecycle:
 * - JobRequest: DRAFT -> OPEN <-> CLOSED; OPEN -> AWARDED (on proposal acceptance, final)
 * - Proposal: PENDING -> ACCEPTED | REJECTED (request owner) | WITHDRAWN (artisan)
 * - Engagement: created exactly once per request when a proposal is accepted
 *
 * The curator-listing application flow (/api/applications, /api/jobs) is unchanged.
 */

// GET /api/job-requests/engagements - caller's active/completed engagements
router.get('/engagements', authMiddleware, controller.engagements);

router.get('/', authMiddleware, jobRequestValidation.list, handleValidation, controller.index);
router.post('/', authMiddleware, jobRequestValidation.create, handleValidation, controller.create);
router.get('/:id', authMiddleware, jobRequestValidation.getOne, handleValidation, controller.show);
router.put('/:id', authMiddleware, jobRequestValidation.update, handleValidation, controller.update);
router.delete('/:id', authMiddleware, jobRequestValidation.getOne, handleValidation, controller.destroy);

router.get('/:id/proposals', authMiddleware, jobRequestValidation.getOne, handleValidation, proposals.index);
router.post('/:id/proposals', authMiddleware, jobRequestValidation.createProposal, handleValidation, proposals.create);
router.post('/:id/proposals/:proposalId/withdraw', authMiddleware, jobRequestValidation.proposal, handleValidation, proposals.withdraw);
router.post('/:id/proposals/:proposalId/accept', authMiddleware, jobRequestValidation.proposal, handleValidation, proposals.accept);
router.post('/:id/proposals/:proposalId/reject', authMiddleware, jobRequestValidation.proposal, handleValidation, proposals.reject);

export default router;
