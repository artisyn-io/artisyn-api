import { Request, Response } from "express";

import BaseController from "./BaseController";
import DataExportRequestResource from "src/resources/DataExportRequestResource";
import { RequestError } from 'src/utils/errors';
import { logAuditEvent } from 'src/utils/auditLogger';
import { sendMail } from 'src/utils/mailer';
import { prisma } from 'src/db';
import argon2 from 'argon2';

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
            const userId = req.user?.id!;

            const { format = 'json' } = await this.validateAsync(req, {
                'format': ['nullable', 'string', 'in:json,csv']
            })

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

            new DataExportRequestResource(req, res, exportRequest)
                .json()
                .status(201)
                .additional({
                    status: 'success',
                    message: 'Data export request submitted. You will receive a download link via email.',
                    code: 201,
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

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.assertFound(requestId, 'Request ID required', 400);

            const exportRequest = await prisma.dataExportRequest.findFirst({
                where: {
                    id: requestId,
                    userId,
                },
            });

            RequestError.assertFound(exportRequest, 'Export request not found', 404);

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
            RequestError.assertFound(userId, 'Unauthorized', 401);

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

            RequestError.assertFound(requestId, 'Request ID required', 400);

            const exportRequest = await prisma.dataExportRequest.findFirst({
                where: {
                    id: requestId,
                    userId,
                },
            });

            RequestError.assertFound(exportRequest, 'Export request not found', 404);
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

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.assertFound(requestId, 'Request ID required', 400);

            const exportRequest = await prisma.dataExportRequest.findFirst({
                where: {
                    id: requestId,
                    userId,
                },
            });

            RequestError.assertFound(exportRequest, 'Export request not found', 404);
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

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.assertFound(password, 'Password required for account deletion', 400);

            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            RequestError.assertFound(user, 'User not found', 404);

            // Verify password
            const passwordValid = await argon2.verify(user.password, password);
            RequestError.abortIf(!passwordValid, 'Invalid password', 403);

            // Block if deletion already pending
            RequestError.abortIf(
                !!user.deletionScheduledAt,
                'Account deletion already scheduled. Check your email or cancel the existing request.',
                409
            );

            // Schedule deletion 30 days from now
            const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            await prisma.user.update({
                where: { id: userId },
                data: {
                    deletionRequestedAt: new Date(),
                    deletionScheduledAt: deletionDate,
                },
            });

            // Send confirmation email
            await sendMail({
                to: user.email,
                subject: 'Account Deletion Scheduled',
                text: `Your account has been scheduled for deletion on ${deletionDate.toDateString()}. If you did not request this or wish to cancel, you can do so within 30 days by visiting your account settings.`,
                caption: 'You have 30 days to cancel this request.',
            });

            // Log deletion request
            await logAuditEvent(userId, 'DATA_DELETE', {
                req,
                entityType: 'User',
                entityId: userId,
                statusCode: 202,
                metadata: { action: 'request_deletion', scheduledAt: deletionDate },
            });

            return res.status(202).json({
                status: 'success',
                message: 'Account deletion scheduled. Check your email to confirm. You have 30 days to cancel.',
                code: 202,
                data: {
                    status: 'pending_deletion',
                    deletionScheduledAt: deletionDate,
                },
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

            RequestError.assertFound(userId, 'Unauthorized', 401);

            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            RequestError.assertFound(user, 'User not found', 404);

            // Check if deletion is actually pending
            RequestError.abortIf(
                !user.deletionScheduledAt,
                'No pending account deletion found.',
                400
            );

            // Ensure still within the 30-day cancellation window
            RequestError.abortIf(
                user.deletionScheduledAt <= new Date(),
                'Deletion window has passed. Account cannot be restored.',
                410
            );

            await prisma.user.update({
                where: { id: userId },
                data: {
                    deletionScheduledAt: null,
                    deletionRequestedAt: null,
                },
            });

            // Send cancellation confirmation email
            await sendMail({
                to: user.email,
                subject: 'Account Deletion Cancelled',
                text: 'Your account deletion request has been successfully cancelled. Your account is now fully restored.',
                caption: 'Your account is safe.',
            });

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
                message: 'Account deletion cancelled. Your account has been restored.',
                code: 200,
                data: { status: 'deletion_cancelled' },
            });
        } catch (error) {
            throw error;
        }
    };
}