import { Request, Response } from "express";

import { AuditAction } from "@prisma/client";
import BaseController from "./BaseController";
import { RequestError } from 'src/utils/errors';
import UserProfileCollection from "src/resources/UserProfileCollection";
import UserProfileResource from "src/resources/UserProfileResource";
import { logAuditEvent } from 'src/utils/auditLogger';
import { prisma } from 'src/db';
import { normalizeSocialLinks, profileValidationRules } from 'src/utils/profileValidators';
import { PrivacyService } from 'src/services/PrivacyService';
import { PrivacyGuard } from 'src/services/PrivacyGuard';

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

// Calculate completion percentage from merged profile state
            const completionFields = [
                'bio',
                'dateOfBirth',
                'profilePictureUrl',
                'website',
                'occupation',
                'companyName',
            ];
            
            // Merge existing profile with request body
            const mergedProfile = {
                ...existingProfile,
                ...req.body,
            };
            
            const filledFields = completionFields.filter(
                field => mergedProfile[field] !== undefined && mergedProfile[field] !== null && mergedProfile[field] !== ''
            ).length;
            const completionPercentage = Math.round((filledFields / completionFields.length) * 100);

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

            const completionFields = [
                'bio',
                'dateOfBirth',
                'profilePictureUrl',
                'website',
                'occupation',
                'companyName',
            ];
            
            const missingFields = completionFields.filter((field: string) => {
                const value = profile?.[field as keyof typeof profile];
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
                missingFields: [...completionFields],
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

            // Fetch user, profile, and privacy settings
            const [user, profile, privacySettings] = await Promise.all([
                prisma.user.findUnique({
                    where: { id: String(targetUserId) },
                }),
                prisma.userProfile.findUnique({
                    where: { userId: String(targetUserId) },
                }),
                prisma.privacySettings.findUnique({
                    where: { userId: String(targetUserId) },
                }),
            ]);

            RequestError.assertFound(profile, 'Profile not found', 404);
            RequestError.assertFound(user, 'User not found', 404);

            // Return 403 if profile is private
            if (privacySettings?.profileVisibility === 'PRIVATE') {
                return res.status(403).json({
                    status: 'error',
                    code: 403,
                    message: 'This profile is private'
                });
            }

            // Build response with conditional field inclusion
            const publicProfile = {
                userId: profile.userId,
                bio: profile.bio,
                companyName: profile.companyName,
                createdAt: profile.createdAt,
                dateOfBirth: profile.dateOfBirth,
                location: privacySettings?.showLocation ? profile.location : null,
                email: privacySettings?.showEmail ? user.email : null,
                phone: privacySettings?.showPhone ? user.phone : null,
            };

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

            // Enforce searchEngineIndexing: tell crawlers whether to index this profile
            const robotsDirective = await PrivacyGuard.getRobotsDirective(String(targetUserId));
            res.setHeader('X-Robots-Tag', robotsDirective);

            res.status(200).json({
                status: 'success',
                code: 200,
                message: 'Public profile retrieved',
                data: publicProfile,
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