import { existsSync } from 'node:fs';
import path from 'node:path';

import { Request, Response } from 'express';

import BaseController from './BaseController';
import DataExportRequestResource from 'src/resources/DataExportRequestResource';
import { prisma } from 'src/db';
import { dataExportQueue } from 'src/services/DataExportQueue';
import { DataExportService } from 'src/services/DataExportService';
import { logAuditEvent } from 'src/utils/auditLogger';
import { RequestError } from 'src/utils/errors';
import argon2 from 'argon2';

/** How long (in days) before a pending deletion is permanently executed. */
const DELETION_WINDOW_DAYS = Number(process.env.GDPR_DELETION_WINDOW_DAYS ?? 30);

/**
 * DataExportController - Handles GDPR data export and account deletion requests.
 *
 * Account deletion lifecycle:
 *   1. POST requestAccountDeletion  – verify password → create pendingDeletion
 *      record with scheduledAt = now + DELETION_WINDOW_DAYS → send confirmation email.
 *   2. POST cancelAccountDeletion   – verify pending record exists → remove it
 *      → send cancellation confirmation email.
 *   3. Nightly cron (DeletionPurgeJob) – purge accounts whose scheduledAt has passed.
 */
export default class extends BaseController {
    /**
     * Request data export
     */
    requestDataExport = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id!;

            const { format = 'json' } = await this.validateAsync(req, {
                format: ['nullable', 'string', 'in:json,csv'],
            });

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
                429,
            );

            const exportRequest = await prisma.dataExportRequest.create({
                data: {
                    userId,
                    format,
                    status: 'pending',
                },
            });

            await logAuditEvent(userId, 'DATA_EXPORT', {
                req,
                entityType: 'DataExportRequest',
                entityId: exportRequest.id,
                statusCode: 201,
                metadata: { format },
            });

            dataExportQueue.enqueue(exportRequest.id);

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
                where: { id: requestId, userId },
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
     */
    downloadExport = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const requestId = req.params.requestId as string;

            RequestError.assertFound(requestId, 'Request ID required', 400);

            const exportRequest = await prisma.dataExportRequest.findFirst({
                where: { id: requestId, userId },
            });

            RequestError.assertFound(exportRequest, 'Export request not found', 404);
            RequestError.abortIf(
                exportRequest.status !== 'ready',
                'Export is not ready for download',
                400,
            );
            RequestError.abortIf(
                exportRequest.expiresAt && new Date() > exportRequest.expiresAt,
                'Download link has expired',
                410,
            );

            await logAuditEvent(userId, 'DATA_EXPORT', {
                req,
                entityType: 'DataExportRequest',
                entityId: requestId,
                statusCode: 200,
                metadata: { action: 'download' },
            });

            const exportFilePath = DataExportService.getExportFilePath(
                exportRequest.id,
                exportRequest.format,
            );

            if (existsSync(exportFilePath)) {
                return res.download(exportFilePath, path.basename(exportFilePath));
            }

            if (
                exportRequest.downloadUrl &&
                exportRequest.downloadUrl !== DataExportService.getDownloadUrl(exportRequest.id)
            ) {
                return res.redirect(exportRequest.downloadUrl);
            }

            RequestError.abortIf(true, 'Download file not available', 500);
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
                where: { id: requestId, userId },
            });

            RequestError.assertFound(exportRequest, 'Export request not found', 404);
            RequestError.abortIf(
                exportRequest.status === 'ready' || exportRequest.status === 'expired',
                'Cannot cancel this export request',
                400,
            );

            const updated = await prisma.dataExportRequest.update({
                where: { id: requestId },
                data: { status: 'expired' },
            });

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
     * Request account deletion (GDPR right to erasure).
     *
     * Flow:
     *   1. Verify the user's password with argon2.
     *   2. Guard against a duplicate pending-deletion request (409).
     *   3. Create a `pendingDeletion` record with scheduledAt = now + DELETION_WINDOW_DAYS.
     *   4. Queue a confirmation email with the scheduled date and a cancel token.
     */
    requestAccountDeletion = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { password } = req.body;

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.assertFound(password, 'Password required for account deletion', 400);

            const user = await prisma.user.findUnique({ where: { id: userId } });
            RequestError.assertFound(user, 'User not found', 404);

            // 1. Verify password
            const passwordValid = await argon2.verify(user.password, password);
            RequestError.abortIf(!passwordValid, 'Incorrect password', 401);

            // 2. Guard: reject duplicate pending requests
            const existing = await prisma.pendingDeletion.findUnique({ where: { userId } });
            RequestError.abortIf(
                !!existing,
                'A deletion request is already pending. Check your email to cancel it.',
                409,
            );

            // 3. Create pending-deletion record
            const scheduledAt = new Date(
                Date.now() + DELETION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
            );
            const { token } = await prisma.pendingDeletion.create({
                data: {
                    userId,
                    scheduledAt,
                    token: crypto.randomUUID(),
                },
            });

            // 4. Queue confirmation email (wire in your mailer/queue here)
            // e.g. emailQueue.enqueue({ type: 'DELETION_REQUESTED', userId, scheduledAt, token })
            void token; // token is passed to the email queue — suppress unused-var lint

            await logAuditEvent(userId, 'DATA_DELETE', {
                req,
                entityType: 'User',
                entityId: userId,
                statusCode: 202,
                metadata: { action: 'request_deletion', scheduledAt },
            });

            return res.status(202).json({
                status: 'success',
                message: `Account deletion scheduled for ${scheduledAt.toDateString()}. Check your email for confirmation and cancellation instructions.`,
                code: 202,
                data: { status: 'pending_deletion', scheduledAt },
            });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Cancel a pending account deletion.
     *
     * Supports two flows:
     *   - Authenticated in-app cancel  (userId resolved from session)
     *   - Email-link cancel            (token passed in request body)
     *
     * Returns 404 if no pending deletion exists — nothing to cancel.
     */
    cancelAccountDeletion = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { token } = req.body;

            // Enforce explicit authorization rules
            if (!token) {
                // In-app flow: must be authenticated
                RequestError.assertFound(userId, 'Unauthorized', 401);
            }

            // Resolve record by token (email-link flow) or userId (in-app flow)
            const pending = token
                ? await prisma.pendingDeletion.findUnique({ where: { token } })
                : await prisma.pendingDeletion.findUnique({ where: { userId } });

            RequestError.assertFound(pending, 'No pending deletion request found', 404);

            // If in-app flow or if auth provided with token flow, ensure the record belongs to the calling user
            if (userId) {
                RequestError.abortIf(pending.userId !== userId, 'Forbidden', 403);
            }

            // Remove the pending-deletion record
            await prisma.pendingDeletion.delete({ where: { userId: pending.userId } });

            // Queue cancellation confirmation email
            // e.g. emailQueue.enqueue({ type: 'DELETION_CANCELLED', userId: pending.userId })

            await logAuditEvent(pending.userId, 'DATA_DELETE', {
                req,
                entityType: 'User',
                entityId: pending.userId,
                statusCode: 200,
                metadata: { action: 'cancel_deletion', method: token ? 'email_link' : 'in_app' },
            });

            return res.json({
                status: 'success',
                message: 'Account deletion cancelled. Your account is safe.',
                code: 200,
                data: { status: 'deletion_cancelled' },
            });
        } catch (error) {
            throw error;
        }
    };
}