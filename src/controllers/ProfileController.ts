import { Request, Response } from "express";

import { AuditAction } from "@prisma/client";
import BaseController from "./BaseController";
import { RequestError } from 'src/utils/errors';
import UserProfileCollection from "src/resources/UserProfileCollection";
import UserProfileResource from "src/resources/UserProfileResource";
import { logAuditEvent } from 'src/utils/auditLogger';
import { prisma } from 'src/db';
import { PrivacyService } from 'src/services/PrivacyService';
import { normalizeSocialLinks, profileValidationRules } from 'src/utils/profileValidators';

const profileCompletionFields = [
    'bio',
    'dateOfBirth',
    'profilePictureUrl',
    'website',
    'occupation',
    'companyName',
] as const;

const isPubliclyVisible = (
    isPublic: boolean,
    profileVisibility?: 'PUBLIC' | 'PRIVATE' | 'FRIENDS_ONLY' | 'CUSTOM'
) => isPublic && (profileVisibility ?? 'PUBLIC') === 'PUBLIC';


/**
 * UserProfileController - Manages user profile CRUD operations
 * Includes profile completion tracking and authorization
 */
export default class extends BaseController {
    /**
     * Get current user's profile
     */
    getProfile = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.assertFound(userId, 'Unauthorized', 401);

            const profile = await prisma.userProfile.findFirst({
                where: { userId },
            });

            // Create default profile if doesn't exist
            if (!profile) {
                const newProfile = await prisma.userProfile.create({
                    data: {
                        userId,
                        profileCompletionPercentage: 0,
                    },
                });

                new UserProfileResource(req, res, newProfile)
                    .json()
                    .status(200)
                    .additional({
                        status: 'success',
                        message: 'User profile retrieved',
                        code: 200,
                    });
                return;
            }

            // Log profile view for audit trail
            await logAuditEvent(userId, 'PROFILE_VIEW', {
                req,
                entityType: 'UserProfile',
                entityId: profile.id,
            });

            new UserProfileResource(req, res, profile)
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'User profile retrieved',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Update user profile
     */
    updateProfile = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.assertFound(userId, 'Unauthorized', 401);

            // Validate input
            const data = await this.validateAsync(req, profileValidationRules);
            const socialLinks = normalizeSocialLinks(data.socialLinks);

            // Get existing profile
            const existingProfile = await prisma.userProfile.findFirst({
                where: { userId },
            });

            // Calculate completion percentage
            const filledFields = profileCompletionFields.filter(
                field => data[field] !== undefined && data[field] !== null && data[field] !== ''
            ).length;
            const completionPercentage = Math.round((filledFields / profileCompletionFields.length) * 100);

            // Prepare update data
            const updateData: any = {
                ...data,
                socialLinks,
                profileCompletionPercentage: completionPercentage,
            };

            // Update profile
            const profile = await prisma.userProfile.upsert({
                where: {
                    userId,
                },
                update: updateData,
                create: {
                    userId,
                    ...updateData,
                },
            });

            // Log the update
            await logAuditEvent(userId, AuditAction.PROFILE_UPDATE, {
                req,
                entityType: 'UserProfile',
                entityId: profile.id,
                oldValues: existingProfile,
                newValues: profile,
                statusCode: 200,
            });

            new UserProfileResource(req, res, profile)
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'User profile updated successfully',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Get profile completion percentage
     */
    getProfileCompletion = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.assertFound(userId, 'Unauthorized', 401);

            const profile = await prisma.userProfile.findFirst({
                where: { userId },
                select: {
                    id: true,
                    profileCompletionPercentage: true,
                    bio: true,
                    dateOfBirth: true,
                    profilePictureUrl: true,
                    website: true,
                    occupation: true,
                    companyName: true,
                },
            });

            const missingFields = profileCompletionFields.filter(field => {
                const value = profile?.[field];
                return value === undefined || value === null || value === '';
            });

            const data = profile ? {
                ...profile,
                missingFields,
            } : {
                id: null,
                profileCompletionPercentage: 0,
                bio: null,
                dateOfBirth: null,
                profilePictureUrl: null,
                website: null,
                occupation: null,
                companyName: null,
                missingFields: [...profileCompletionFields],
            };

            new UserProfileResource(req, res, data)
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'Profile completion retrieved',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Get public profile by user ID (anyone can view if public)
     */
    getPublicProfile = async (req: Request, res: Response) => {
        try {
            const targetUserId = req.params.userId;
            const viewerId = req.user?.id || null;
            RequestError.assertFound(targetUserId, 'User ID required', 400);

            // Use PrivacyService for unified visibility checking
            const profile = await PrivacyService.getFilteredProfileData(viewerId, String(targetUserId));

            RequestError.assertFound(profile, 'Profile not found', 404);

            // Log public profile view
            await logAuditEvent(req.user?.id, 'PROFILE_VIEW', {
                req,
                entityType: 'UserProfile',
                entityId: profile.id,
                metadata: {
                    viewedUserId: targetUserId,
                    isPublicView: true,
                },
            });

            new UserProfileResource(req, res, publicProfile)
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'Public profile retrieved',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Delete user profile
     */
    deleteProfile = async (req: Request, res: Response) => {
        const userId = req.user?.id;
        RequestError.assertFound(userId, 'Unauthorized', 401);

        const profile = await prisma.userProfile.findFirst({
            where: { userId },
        });

        RequestError.assertFound(profile, 'Profile not found', 404);

        await prisma.userProfile.delete({
            where: { id: profile.id },
        });

        // Log deletion
        await logAuditEvent(userId, AuditAction.PROFILE_UPDATE, {
            req,
            entityType: 'UserProfile',
            entityId: profile.id,
            statusCode: 200,
            metadata: { action: 'DELETE' },
        });

        new UserProfileResource(req, res, {})
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'User profile deleted successfully',
                code: 200,
            });
    };
}
