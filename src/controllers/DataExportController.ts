import { Request, Response } from "express";
import BaseController from "./BaseController";
import { ApiResource } from 'src/resources/index';
import { prisma } from 'src/db';
import { RequestError } from 'src/utils/errors';
import { logAuditEvent } from 'src/utils/auditLogger';
// Removed unused import from '@prisma/client';

/**
 * DataExportController - Handles GDPR data export requests
 * Allows users to download all their personal data
 */
export default class extends BaseController {
    /**
     * Request data export
     */
    requestDataExport = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.abortIf(!userId, 'Unauthorized', 401);

            const { format = 'json' } = req.body;
            RequestError.abortIf(
                !['json', 'csv'].includes(format),
                'Invalid format. Must be json or csv',
                400
            );

            // Check if user has an active export request within last 24 hours
            const recentRequest = await prisma.dataExportRequest.findFirst({
                where: {
                    userId,
                    createdAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                    status: { not: 'expired' },
                },
            });

            RequestError.abortIf(
                recentRequest,
                'You already have an active export request. Please wait 24 hours before requesting another.',
                429
            );

            // Create export request
            const exportRequest = await prisma.dataExportRequest.create({
                data: {
                    userId,
                    format,
                    status: 'pending',
                },
            });

            // Log data export request
            await logAuditEvent(userId, 'DATA_EXPORT', {
                req,
                entityType: 'DataExportRequest',
                entityId: exportRequest.id,
                statusCode: 201,
                metadata: { format },
            });

            // TODO: Trigger async job to generate export file
            // This would typically use a job queue like Bull or Resque

            return res.json({
                status: 'success',
                message: 'Data export request submitted. You will receive a download link via email.',
                code: 201,
                data: exportRequest,
            });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Get export request status
     */
    getExportStatus = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const requestId = req.params.requestId as string;

            RequestError.abortIf(!userId, 'Unauthorized', 401);
            RequestError.abortIf(!requestId, 'Request ID required', 400);

            const exportRequest = await prisma.dataExportRequest.findFirst({
                where: {
                    id: requestId,
                    userId,
                },
            });

            RequestError.abortIf(!exportRequest, 'Export request not found', 404);

            return res.json({
                status: 'success',
                message: 'Export status retrieved',
                code: 200,
                data: exportRequest,
            });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Get all export requests for user
     */
    getExportRequests = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.abortIf(!userId, 'Unauthorized', 401);

            const { take, skip, meta } = this.pagination(req);

            const [requests, total] = await Promise.all([
                prisma.dataExportRequest.findMany({
                    where: { userId },
                    orderBy: { createdAt: 'desc' },
                    take,
                    skip,
                }),
                prisma.dataExportRequest.count({ where: { userId } }),
            ]);

            return res.json({
                status: 'success',
                message: 'Export requests retrieved',
                code: 200,
                data: requests,
                pagination: meta(total, requests.length),
            });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Download exported data
     * Typically called from a pre-signed URL
     */
    downloadExport = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const requestId = req.params.requestId as string;

            RequestError.abortIf(!userId, 'Unauthorized', 401);
            RequestError.abortIf(!requestId, 'Request ID required', 400);

            const exportRequest = await prisma.dataExportRequest.findFirst({
                where: {
                    id: requestId,
                    userId,
                },
            });

            RequestError.abortIf(!exportRequest, 'Export request not found', 404);
            RequestError.abortIf(
                exportRequest.status !== 'ready',
                'Export is not ready for download',
                400
            );

            RequestError.abortIf(
                exportRequest.expiresAt && new Date() > exportRequest.expiresAt,
                'Download link has expired',
                410
            );

            // Log download
            await logAuditEvent(userId, 'DATA_EXPORT', {
                req,
                entityType: 'DataExportRequest',
                entityId: requestId,
                statusCode: 200,
                metadata: { action: 'download' },
            });

            // Redirect to download URL (typically S3 or similar)
            if (exportRequest.downloadUrl) {
                res.redirect(exportRequest.downloadUrl);
            } else {
                RequestError.abortIf(true, 'Download URL not available', 500);
            }
        } catch (error) {
            throw error;
        }
    };

    /**
     * Cancel export request
     */
    cancelExport = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const requestId = req.params.requestId as string;

            RequestError.abortIf(!userId, 'Unauthorized', 401);
            RequestError.abortIf(!requestId, 'Request ID required', 400);

            const exportRequest = await prisma.dataExportRequest.findFirst({
                where: {
                    id: requestId,
                    userId,
                },
            });

            RequestError.abortIf(!exportRequest, 'Export request not found', 404);
            RequestError.abortIf(
                exportRequest.status === 'ready' || exportRequest.status === 'expired',
                'Cannot cancel this export request',
                400
            );

            const updated = await prisma.dataExportRequest.update({
                where: { id: requestId },
                data: { status: 'expired' },
            });

            // Log cancellation
            await logAuditEvent(userId, 'DATA_EXPORT', {
                req,
                entityType: 'DataExportRequest',
                entityId: requestId,
                statusCode: 200,
                metadata: { action: 'cancel' },
            });

            return res.json({
                status: 'success',
                message: 'Export request cancelled',
                code: 200,
                data: updated,
            });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Request account deletion with data purge
     * GDPR right to be forgotten
     */
    requestAccountDeletion = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { password } = req.body;

            RequestError.abortIf(!userId, 'Unauthorized', 401);
            RequestError.abortIf(!password, 'Password required for account deletion', 400);

            // Verify password before proceeding
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            RequestError.abortIf(!user, 'User not found', 404);

            // TODO: Verify password using argon2 or similar

            // Log deletion request
            await logAuditEvent(userId, 'DATA_DELETE', {
                req,
                entityType: 'User',
                entityId: userId,
                statusCode: 202,
                metadata: { action: 'request_deletion' },
            });

            // TODO: Create background job to:
            // 1. Schedule user data deletion
            // 2. Send confirmation email with 30-day cancellation window
            // 3. Actually delete data after 30 days

            return res.status(202).json({
                status: 'success',
                message: 'Account deletion requested. Check your email to confirm. Account will be deleted in 30 days.',
                code: 202,
                data: { status: 'pending_deletion' },
            });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Cancel pending account deletion
     */
    cancelAccountDeletion = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;

            RequestError.abortIf(!userId, 'Unauthorized', 401);

            // TODO: Check if user has pending deletion
            // Cancel the scheduled deletion

            // Log cancellation
            await logAuditEvent(userId, 'DATA_DELETE', {
                req,
                entityType: 'User',
                entityId: userId,
                statusCode: 200,
                metadata: { action: 'cancel_deletion' },
            });

            return res.json({
                status: 'success',
                message: 'Account deletion cancelled',
                code: 200,
                data: { status: 'deletion_cancelled' },
            });
        } catch (error) {
            throw error;
        }
    };
}
