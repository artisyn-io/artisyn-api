import { Request, Response } from "express";
import BaseController from "../BaseController";
import { CuratorVerificationService } from "../../services/CuratorVerificationService";
import Resource from '../../resources/index';
import { validate } from "../../utils/validator";
import { RequestError } from "../../utils/errors";

/**
 * CuratorVerificationController
 *
 * Handles curator operations for verification including:
 * - Submitting verification applications with documents
 * - Checking application status and history
 */
export default class CuratorVerificationController extends BaseController {
    /**
     * Submit a new verification application
     * Requires at least one document upload with metadata
     * Prevents duplicate pending applications
     *
     * POST /api/curator/verification/submit
     */
    submit = async (req: Request, res: Response) => {
        const curator = await this.getCurator(req);

        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            throw new RequestError('At least one document is required', 400);
        }

        const { documents: documentsJson } = validate(req.body, {
            documents: 'required|json'
        });

        const documentsMeta = JSON.parse(documentsJson);

        if (!Array.isArray(documentsMeta) || documentsMeta.length !== req.files.length) {
            throw new RequestError('Document metadata must match uploaded files', 400);
        }

        const documents = req.files.map((file, index) => {
            const meta = documentsMeta[index];
            
            const { document_type, document_name } = validate(meta, {
                document_type: 'required|string|in:government_id,professional_certificate,other',
                document_name: 'required|string|min:3|max:100'
            });

            return {
                file,
                documentType: document_type,
                documentName: document_name
            };
        });

        const application = await CuratorVerificationService.submitApplication({
            curatorId: curator.id,
            documents,
            metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined
        });

        Resource(req, res, { data: application })
            .json()
            .status(201)
            .additional({
                status: 'success',
                message: 'Verification application submitted successfully',
                code: 201
            });
    }

    /**
     * Get verification application status and history for the current curator
     * Returns all applications and their history for the authenticated curator
     *
     * GET /api/curator/verification/status
     */
    getStatus = async (req: Request, res: Response) => {
        const curator = await this.getCurator(req);

        const data = await CuratorVerificationService.getApplicationStatus(curator.id);

        Resource(req, res, { data })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'OK',
                code: 200
            });
    }

    /**
     * Helper method to get the curator profile for the authenticated user
     * Throws error if curator profile not found
     */
    private getCurator = async (req: Request) => {
        const { prisma } = await import('../../db');
        
        const curator = await prisma.curator.findUnique({
            where: { userId: req.user?.id }
        });

        if (!curator) {
            throw new RequestError('Curator profile not found', 404);
        }

        return curator;
    }
}
