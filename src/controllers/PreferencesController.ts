import { Request, Response } from "express";
import BaseController from "./BaseController";
import { ApiResource } from 'src/resources/index';
import UserPreferencesResource from "src/resources/UserPreferencesResource";
import { prisma } from 'src/db';
import { RequestError } from 'src/utils/errors';
import { logAuditEvent } from 'src/utils/auditLogger';
import { preferencesValidationRules } from 'src/utils/profileValidators';

/**
 * UserPreferencesController - Manages user notification and display preferences
 */
export default class extends BaseController {
    /**
     * Get user preferences
     */
    getPreferences = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.abortIf(!userId, 'Unauthorized', 401);

            let preferences = await prisma.userPreferences.findFirst({
                where: { userId },
            });

            // Create default preferences if doesn't exist
            if (!preferences) {
                preferences = await prisma.userPreferences.create({
                    data: { userId },
                });
            }

            ApiResource(new UserPreferencesResource(req, res, { data: preferences }))
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'User preferences retrieved',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Update user preferences
     */
    updatePreferences = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.abortIf(!userId, 'Unauthorized', 401);

            // Validate input
            const errors = await this.validateAsync(req, preferencesValidationRules);
            if (Object.keys(errors).length > 0) {
                RequestError.abortIf(true, 'Validation failed', 422);
            }

            // Get existing preferences
            const existingPreferences = await prisma.userPreferences.findFirst({
                where: { userId },
            });

            // Update preferences
            const preferences = await prisma.userPreferences.upsert({
                where: { userId },
                update: req.body,
                create: {
                    userId,
                    ...req.body,
                },
            });

            // Log the update
            await logAuditEvent(userId, 'PROFILE_UPDATE', {
                req,
                entityType: 'UserPreferences',
                entityId: preferences.id,
                oldValues: existingPreferences,
                newValues: preferences,
                statusCode: 200,
            });

            ApiResource(new UserPreferencesResource(req, res, { data: preferences }))
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'User preferences updated successfully',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Update notification preferences only
     */
    updateNotifications = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.abortIf(!userId, 'Unauthorized', 401);

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
                statusCode: 200,
                metadata: { type: 'notification_update' },
            });

            ApiResource(new UserPreferencesResource(req, res, { data: preferences }))
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'Notification preferences updated',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Toggle two-factor authentication
     */
    toggleTwoFactor = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.abortIf(!userId, 'Unauthorized', 401);

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
                statusCode: 200,
                metadata: { action: 'toggle_2fa', status: newStatus },
            });

            ApiResource(new UserPreferencesResource(req, res, { data: updated }))
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: `Two-factor authentication ${newStatus ? 'enabled' : 'disabled'}`,
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Reset preferences to defaults
     */
    resetPreferences = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.abortIf(!userId, 'Unauthorized', 401);

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
                statusCode: 200,
                metadata: { action: 'reset' },
            });

            ApiResource(new UserPreferencesResource(req, res, { data: preferences }))
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'Preferences reset to defaults',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };
}
