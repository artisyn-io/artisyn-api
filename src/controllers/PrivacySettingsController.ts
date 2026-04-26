import { Request, Response } from "express";

import BaseController from "./BaseController";
import PrivacySettingsCollection from "src/resources/PrivacySettingsCollection";
import PrivacySettingsResource from "src/resources/PrivacySettingsResource";
import { RequestError } from 'src/utils/errors';
import { logAuditEvent } from 'src/utils/auditLogger';
import { prisma } from 'src/db';
import { privacySettingsValidationRules } from 'src/utils/profileValidators';
import { PrivacyService } from 'src/services/PrivacyService';

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

            if (typeof req.body.customPrivacyRules !== 'undefined') {
                const { CustomPrivacyService } = await import('../services/CustomPrivacyService');
                const validation = CustomPrivacyService.validateCustomRules(req.body.customPrivacyRules);
                if (!validation.valid) {
                    RequestError.abortIf(true, `Invalid custom privacy rules: ${validation.errors?.join(', ')}`, 422);
                }
            }

            // Get existing settings
            const existingSettings = await prisma.privacySettings.findFirst({
                where: { userId },
            });

            const { profileVisibility, ...otherPrivacyData } = req.body;

            if (typeof profileVisibility === 'string') {
                await PrivacyService.updateProfileVisibility(userId, profileVisibility as any);
            }

            // Update with new data
            const privacySettings = await prisma.privacySettings.upsert({
                where: { userId },
                update: {
                    ...otherPrivacyData,
                    lastPrivacyReviewDate: new Date(),
                },
                create: {
                    userId,
                    ...otherPrivacyData,
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

            // Use PrivacyService for unified visibility management
            await PrivacyService.updateProfileVisibility(userId, profileVisibility as any);

            // Get updated privacy settings for response
            const privacySettings = await prisma.privacySettings.findFirst({
                where: { userId },
            });

            // Log visibility change
            await logAuditEvent(userId, 'PRIVACY_CHANGE', {
                req,
                entityType: 'PrivacySettings',
                entityId: privacySettings?.id,
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

    /**
     * Add user to restricted list
     */
    addToRestrictedList = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id!;
            const { restrictedUserId } = req.body;

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.assertFound(restrictedUserId, 'Restricted user ID required', 400);
            RequestError.abortIf(userId === restrictedUserId, 'Cannot restrict yourself', 400);

            // Verify restricted user exists
            const restrictedUser = await prisma.user.findUnique({
                where: { id: restrictedUserId },
            });
            RequestError.assertFound(restrictedUser, 'User not found', 404);

            const privacySettings = await prisma.privacySettings.findFirst({
                where: { userId },
            });

            const restrictedList = privacySettings?.restrictedList || [];
            if (!restrictedList.includes(restrictedUserId)) {
                restrictedList.push(restrictedUserId);
            }

            const updated = await prisma.privacySettings.upsert({
                where: { userId },
                update: { restrictedList },
                create: {
                    userId,
                    restrictedList,
                },
            });

            // Log restriction action
            await logAuditEvent(userId, 'PRIVACY_CHANGE', {
                req,
                entityType: 'PrivacySettings',
                entityId: updated.id,
                statusCode: 200,
                metadata: { action: 'add_restricted_user', restrictedUserId },
            });

            new PrivacySettingsResource(req, res, { data: updated })
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'User added to restricted list',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Remove user from restricted list
     */
    removeFromRestrictedList = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id!;
            const { restrictedUserId } = req.body;

            RequestError.assertFound(userId, 'Unauthorized', 401);
            RequestError.assertFound(restrictedUserId, 'Restricted user ID required', 400);

            const privacySettings = await prisma.privacySettings.findFirst({
                where: { userId },
            });

            const restrictedList = privacySettings?.restrictedList || [];
            const updatedRestrictedList = restrictedList.filter((id: string) => id !== restrictedUserId);

            const updated = await prisma.privacySettings.update({
                where: { userId },
                data: { restrictedList: updatedRestrictedList },
            });

            // Log unrestrict action
            await logAuditEvent(userId, 'PRIVACY_CHANGE', {
                req,
                entityType: 'PrivacySettings',
                entityId: updated.id,
                statusCode: 200,
                metadata: { action: 'remove_restricted_user', restrictedUserId },
            });

            new PrivacySettingsResource(req, res, { data: updated })
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'User removed from restricted list',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Get restricted list
     */
    getRestrictedList = async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        RequestError.assertFound(userId, 'Unauthorized', 401);

        const privacySettings = await prisma.privacySettings.findFirst({
            where: { userId },
        });

        const restrictedList = privacySettings?.restrictedList || [];

        // Fetch restricted users' basic info
        const restrictedUsers = await prisma.user.findMany({
            where: { id: { in: restrictedList } },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
            },
        });

        new PrivacySettingsCollection(req, res, { data: restrictedUsers })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Restricted list retrieved',
                code: 200,
            });
    };

    /**
     * Update custom privacy rules
     */
    updateCustomPrivacyRules = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id!;
            const { customPrivacyRules } = req.body;

            RequestError.assertFound(userId, 'Unauthorized', 401);

            // Validate custom privacy rules
            const { CustomPrivacyService } = await import('../services/CustomPrivacyService');
            const validation = CustomPrivacyService.validateCustomRules(customPrivacyRules);
            
            if (!validation.valid) {
                RequestError.abortIf(true, `Invalid custom privacy rules: ${validation.errors?.join(', ')}`, 422);
            }

            const privacySettings = await prisma.privacySettings.upsert({
                where: { userId },
                update: { 
                    customPrivacyRules,
                    lastPrivacyReviewDate: new Date(),
                },
                create: {
                    userId,
                    customPrivacyRules,
                    lastPrivacyReviewDate: new Date(),
                },
            });

            // Log custom rules update
            await logAuditEvent(userId, 'PRIVACY_CHANGE', {
                req,
                entityType: 'PrivacySettings',
                entityId: privacySettings.id,
                statusCode: 200,
                metadata: { action: 'update_custom_rules', rulesCount: customPrivacyRules?.rules?.length || 0 },
            });

            new PrivacySettingsResource(req, res, { data: privacySettings })
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'Custom privacy rules updated',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Get default custom privacy rules template
     */
    getDefaultCustomRules = async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        RequestError.assertFound(userId, 'Unauthorized', 401);

        const { CustomPrivacyService } = await import('../services/CustomPrivacyService');
        const defaultRules = CustomPrivacyService.getDefaultRules();

        new PrivacySettingsResource(req, res, { data: defaultRules })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Default custom privacy rules retrieved',
                code: 200,
            });
    };
}
