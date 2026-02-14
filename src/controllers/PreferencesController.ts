import { Request, Response } from "express";

import BaseController from "./BaseController";
import { RequestError } from 'src/utils/errors';
import UserPreferencesResource from "src/resources/UserPreferencesResource";
import { logAuditEvent } from 'src/utils/auditLogger';
import { preferencesValidationRules } from 'src/utils/profileValidators';
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

        const notificationPrefs: any = {
            emailNotifications: req.body.emailNotifications,
            pushNotifications: req.body.pushNotifications,
            smsNotifications: req.body.smsNotifications,
            marketingEmails: req.body.marketingEmails,
            activityEmails: req.body.activityEmails,
            digestFrequency: req.body.digestFrequency,
        };

        // Filter out undefined values
        Object.keys(notificationPrefs).forEach((key: string) =>
            notificationPrefs[key] === undefined && delete notificationPrefs[key]
        );

        const preferences = await prisma.userPreferences.upsert({
            where: { userId },
            update: notificationPrefs,
            create: {
                userId,
                ...notificationPrefs,
            },
        });

        // Log notification preference change
        await logAuditEvent(userId, 'PROFILE_UPDATE', {
            req,
            entityType: 'UserPreferences',
            entityId: preferences.id,
            newValues: notificationPrefs,
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
     */
    toggleTwoFactor = async (req: Request, res: Response) => {
        const userId = req.user?.id!;
        RequestError.assertFound(userId, 'Unauthorized', 401);

        let preferences = await prisma.userPreferences.findFirst({
            where: { userId },
        });

        if (!preferences) {
            preferences = await prisma.userPreferences.create({
                data: { userId },
            });
        }

        const newStatus = !preferences.twoFactorEnabled;

        const updated = await prisma.userPreferences.update({
            where: { id: preferences.id },
            data: { twoFactorEnabled: newStatus },
        });

        // Log 2FA toggle
        await logAuditEvent(userId, 'PROFILE_UPDATE', {
            req,
            entityType: 'UserPreferences',
            entityId: updated.id,
            newValues: { twoFactorEnabled: newStatus },
            statusCode: 202,
            metadata: { action: 'toggle_2fa', status: newStatus },
        });

        new UserPreferencesResource(req, res, { data: updated })
            .json()
            .status(202)
            .additional({
                status: 'success',
                message: `Two-factor authentication ${newStatus ? 'enabled' : 'disabled'}`,
                code: 202,
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
            twoFactorEnabled: false,
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
