import { Request, Response } from "express";

import BaseController from "./BaseController";
import { RequestError } from 'src/utils/errors';
import UserPreferencesResource from "src/resources/UserPreferencesResource";
import { logAuditEvent } from 'src/utils/auditLogger';
import { notificationValidationRules, preferencesValidationRules } from 'src/utils/profileValidators';
import { prisma } from 'src/db';

/**
 * UserPreferencesController - Manages user notification and display preferences
 */
export default class extends BaseController {
    /**
     * Get user preferences
     */
    getPreferences = async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        RequestError.assertFound(userId, 'Unauthorized', 401);

        let preferences = await prisma.userPreferences.findFirst({
            where: { userId },
        });

        // Create default preferences if doesn't exist
        if (!preferences) {
            preferences = await prisma.userPreferences.create({
                data: { userId },
            });
        }

        new UserPreferencesResource(req, res, { data: preferences })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'User preferences retrieved',
                code: 200,
            });
    };

    /**
     * Update user preferences
     */
    updatePreferences = async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        RequestError.assertFound(userId, 'Unauthorized', 401);

        // Validate input
        const data = await this.validateAsync(req, preferencesValidationRules);

        // Get existing preferences
        const existingPreferences = await prisma.userPreferences.findFirst({
            where: { userId },
        });

        // Update preferences
        const preferences = await prisma.userPreferences.upsert({
            where: { userId },
            update: data,
            create: {
                userId,
                ...data,
            },
        });

        // Log the update
        await logAuditEvent(userId, 'PROFILE_UPDATE', {
            req,
            entityType: 'UserPreferences',
            entityId: preferences.id,
            oldValues: existingPreferences,
            newValues: preferences,
            statusCode: 202,
        });

        new UserPreferencesResource(req, res, { data: preferences })
            .json()
            .status(202)
            .additional({
                status: 'success',
                message: 'User preferences updated successfully',
                code: 202,
            });
    };

    /**
     * Update notification preferences only
     */
    updateNotifications = async (req: Request, res: Response) => {
        const userId = req.user?.id;
        RequestError.assertFound(userId, 'Unauthorized', 401);

        const data = await this.validateAsync(req, notificationValidationRules);

        const preferences = await prisma.userPreferences.upsert({
            where: { userId },
            update: data,
            create: {
                userId,
                ...data,
            },
        });

        // Log notification preference change
        await logAuditEvent(userId, 'PROFILE_UPDATE', {
            req,
            entityType: 'UserPreferences',
            entityId: preferences.id,
            newValues: preferences,
            statusCode: 202,
            metadata: { type: 'notification_update' },
        });

        new UserPreferencesResource(req, res, { data: preferences })
            .json()
            .status(202)
            .additional({
                status: 'success',
                message: 'Notification preferences updated',
                code: 202,
            });
    };

    /**
     * Toggle two-factor authentication
     *
     * @deprecated A preference flag is not 2FA. Use the TOTP enrollment
     * endpoints under /api/account/2fa; `twoFactorEnabled` now reflects
     * confirmed enrollment only.
     */
    toggleTwoFactor = async (req: Request, res: Response) => {
        RequestError.assertFound(req.user?.id, 'Unauthorized', 401);

        res.status(410).json({
            data: {},
            status: 'error',
            message: 'This endpoint is deprecated. Use POST /api/account/2fa/setup and /api/account/2fa/confirm.',
            code: 410,
        });
    };

    /**
     * Reset preferences to defaults
     */
    resetPreferences = async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        RequestError.assertFound(userId, 'Unauthorized', 401);

        const defaultPreferences = {
            emailNotifications: true,
            pushNotifications: true,
            smsNotifications: false,
            marketingEmails: true,
            activityEmails: true,
            digestFrequency: 'weekly',
            theme: 'light',
            language: 'en',
            currencyPreference: 'USD',
            dataCollectionConsent: false,
            analyticsTracking: true,
        };

        const preferences = await prisma.userPreferences.upsert({
            where: { userId },
            update: defaultPreferences,
            create: {
                userId,
                ...defaultPreferences,
            },
        });

        // Log reset
        await logAuditEvent(userId, 'PROFILE_UPDATE', {
            req,
            entityType: 'UserPreferences',
            entityId: preferences.id,
            statusCode: 202,
            metadata: { action: 'reset' },
        });

        new UserPreferencesResource(req, res, { data: preferences })
            .json()
            .status(202)
            .additional({
                status: 'success',
                message: 'Preferences reset to defaults',
                code: 202,
            });
    };
}
