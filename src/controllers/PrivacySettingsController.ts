import { Request, Response } from "express";

import BaseController from "./BaseController";
import PrivacySettingsCollection from "src/resources/PrivacySettingsCollection";
import PrivacySettingsResource from "src/resources/PrivacySettingsResource";
import { RequestError } from 'src/utils/errors';
import { logAuditEvent } from 'src/utils/auditLogger';
import { prisma } from 'src/db';
import { privacySettingsValidationRules } from 'src/utils/profileValidators';

/**
 * PrivacySettingsController - Manages user privacy controls and GDPR compliance
 */
export default class extends BaseController {
    /**
     * Get user privacy settings
     */
    getPrivacySettings = async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        RequestError.assertFound(userId, 'Unauthorized', 401);

        let privacySettings = await prisma.privacySettings.findFirst({
            where: { userId },
        });

        // Create default privacy settings if doesn't exist
        if (!privacySettings) {
            privacySettings = await prisma.privacySettings.create({
                data: { userId },
            });
        }

        new PrivacySettingsResource(req, res, { data: privacySettings })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Privacy settings retrieved',
                code: 200,
            });
    };

    /**
     * Update user privacy settings
     */
    updatePrivacySettings = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.assertFound(userId, 'Unauthorized', 401);

            // Validate input
            const errors = await this.validateAsync(req, privacySettingsValidationRules);
            if (Object.keys(errors).length > 0) {
                RequestError.abortIf(true, 'Validation failed', 422);
            }

            // Get existing settings
            const existingSettings = await prisma.privacySettings.findFirst({
                where: { userId },
            });

            // Update with new data
            const privacySettings = await prisma.privacySettings.upsert({
                where: { userId },
                update: {
                    ...req.body,
                    lastPrivacyReviewDate: new Date(),
                },
                create: {
                    userId,
                    ...req.body,
                    lastPrivacyReviewDate: new Date(),
                },
            });

            // Log privacy setting change
            await logAuditEvent(userId, 'PRIVACY_CHANGE', {
                req,
                entityType: 'PrivacySettings',
                entityId: privacySettings.id,
                oldValues: existingSettings,
                newValues: privacySettings,
                statusCode: 200,
            });

            new PrivacySettingsResource(req, res, { data: privacySettings })
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'Privacy settings updated successfully',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Update profile visibility
     */
    updateProfileVisibility = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id!;
            const { profileVisibility } = req.body;

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.abortIf(
                !['PUBLIC', 'PRIVATE', 'FRIENDS_ONLY', 'CUSTOM'].includes(profileVisibility),
                'Invalid visibility level',
                400
            );

            const privacySettings = await prisma.privacySettings.upsert({
                where: { userId },
                update: {
                    profileVisibility,
                    lastPrivacyReviewDate: new Date(),
                },
                create: {
                    userId,
                    profileVisibility,
                    lastPrivacyReviewDate: new Date(),
                },
            });

            // Log visibility change
            await logAuditEvent(userId, 'PRIVACY_CHANGE', {
                req,
                entityType: 'PrivacySettings',
                entityId: privacySettings.id,
                newValues: { profileVisibility },
                statusCode: 200,
                metadata: { changeType: 'profile_visibility' },
            });

            new PrivacySettingsResource(req, res, { data: privacySettings })
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'Profile visibility updated',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Block a user
     */
    blockUser = async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        const { blockedUserId } = req.body;

        RequestError.assertFound(userId, 'Unauthorized', 401);
        RequestError.assertFound(blockedUserId, 'Blocked user ID required', 400);
        RequestError.abortIf(userId === blockedUserId, 'Cannot block yourself', 400);

        // Verify blocked user exists
        const blockedUser = await prisma.user.findUnique({
            where: { id: blockedUserId },
        });
        RequestError.assertFound(blockedUser, 'User not found', 404);

        const privacySettings = await prisma.privacySettings.findFirst({
            where: { userId },
        });

        const blockList = privacySettings?.blockList || [];
        if (!blockList.includes(blockedUserId)) {
            blockList.push(blockedUserId);
        }

        const updated = await prisma.privacySettings.upsert({
            where: { userId },
            update: { blockList },
            create: {
                userId,
                blockList,
            },
        });

        // Log block action
        await logAuditEvent(userId, 'PRIVACY_CHANGE', {
            req,
            entityType: 'PrivacySettings',
            entityId: updated.id,
            statusCode: 200,
            metadata: { action: 'block_user', blockedUserId },
        });

        new PrivacySettingsResource(req, res, { data: updated })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'User blocked successfully',
                code: 200,
            });
    };

    /**
     * Unblock a user
     */
    unblockUser = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { blockedUserId } = req.body;

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.assertFound(blockedUserId, 'Blocked user ID required', 400);

            const privacySettings = await prisma.privacySettings.findFirst({
                where: { userId },
            });

            const blockList = privacySettings?.blockList || [];
            const updatedBlockList = blockList.filter((id: string) => id !== blockedUserId);

            const updated = await prisma.privacySettings.update({
                where: { userId },
                data: { blockList: updatedBlockList },
            });

            // Log unblock action
            await logAuditEvent(userId, 'PRIVACY_CHANGE', {
                req,
                entityType: 'PrivacySettings',
                entityId: updated.id,
                statusCode: 200,
                metadata: { action: 'unblock_user', blockedUserId },
            });

            new PrivacySettingsResource(req, res, { data: updated })
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'User unblocked successfully',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Get block list
     */
    getBlockList = async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        RequestError.assertFound(userId, 'Unauthorized', 401);

        const privacySettings = await prisma.privacySettings.findFirst({
            where: { userId },
        });

        const blockList = privacySettings?.blockList || [];

        // Fetch blocked users' basic info
        const blockedUsers = await prisma.user.findMany({
            where: { id: { in: blockList } },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
            },
        });

        new PrivacySettingsCollection(req, res, { data: blockedUsers })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Block list retrieved',
                code: 200,
            });
    };

    /**
     * Update data retention policy
     */
    updateDataRetention = async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        const { dataRetentionMonths } = req.body;

        RequestError.assertFound(userId, 'Unauthorized', 401);
        RequestError.assertFound(dataRetentionMonths, 'Data retention months required', 400);
        RequestError.abortIf(
            dataRetentionMonths < 1 || dataRetentionMonths > 240,
            'Data retention months must be between 1 and 240',
            400
        );

        const privacySettings = await prisma.privacySettings.upsert({
            where: { userId },
            update: { dataRetentionMonths },
            create: {
                userId,
                dataRetentionMonths,
            },
        });

        // Log retention policy change
        await logAuditEvent(userId, 'PRIVACY_CHANGE', {
            req,
            entityType: 'PrivacySettings',
            entityId: privacySettings.id,
            statusCode: 200,
            metadata: { action: 'update_retention_policy', dataRetentionMonths },
        });

        new PrivacySettingsResource(req, res, { data: privacySettings })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Data retention policy updated',
                code: 200,
            });
    };
}
