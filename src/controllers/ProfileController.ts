import { Request, Response } from "express";
import BaseController from "./BaseController";
import { ApiResource } from 'src/resources/index';
import UserProfileResource from "src/resources/UserProfileResource";
import UserProfileCollection from "src/resources/UserProfileCollection";
import { prisma } from 'src/db';
import { RequestError } from 'src/utils/errors';
import { logAuditEvent } from 'src/utils/auditLogger';
import { profileValidationRules } from 'src/utils/profileValidators';

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
            RequestError.abortIf(!userId, 'Unauthorized', 401);

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

                ApiResource(new UserProfileResource(req, res, newProfile))
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

            ApiResource(new UserProfileResource(req, res, profile))
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
            RequestError.abortIf(!userId, 'Unauthorized', 401);

            // Validate input
            const errors = await this.validateAsync(req, profileValidationRules);
            RequestError.abortIf(Object.keys(errors).length > 0, 'Validation failed', 422, errors);

            // Get existing profile
            const existingProfile = await prisma.userProfile.findFirst({
                where: { userId },
            });

            // Calculate completion percentage
            const completionFields = [
                'bio',
                'dateOfBirth',
                'profilePictureUrl',
                'website',
                'occupation',
                'companyName',
            ];
            const filledFields = completionFields.filter(
                field => req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== ''
            ).length;
            const completionPercentage = Math.round((filledFields / completionFields.length) * 100);

            // Prepare update data
            const updateData: any = {
                ...req.body,
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

            ApiResource(new UserProfileResource(req, res, profile))
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
            RequestError.abortIf(!userId, 'Unauthorized', 401);

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

            const data = profile || {
                id: null,
                profileCompletionPercentage: 0,
            };

            ApiResource(new UserProfileResource(req, res, data))
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
            RequestError.abortIf(!targetUserId, 'User ID required', 400);

            const profile = await prisma.userProfile.findFirst({
                where: { userId: targetUserId },
                select: {
                    id: true,
                    userId: true,
                    bio: true,
                    profilePictureUrl: true,
                    website: true,
                    occupation: true,
                    companyName: true,
                    location: true,
                    verifiedBadge: true,
                    isProfessional: true,
                    isPublic: true,
                    createdAt: true,
                },
            });

            RequestError.abortIf(!profile, 'Profile not found', 404);
            RequestError.abortIf(!profile.isPublic, 'Profile is private', 403);

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

            ApiResource(new UserProfileResource(req, res, profile))
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
        try {
            const userId = req.user?.id;
            RequestError.abortIf(!userId, 'Unauthorized', 401);

            const profile = await prisma.userProfile.findFirst({
                where: { userId },
            });

            RequestError.abortIf(!profile, 'Profile not found', 404);

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

            ApiResource(new UserProfileResource(req, res, {}))
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'User profile deleted successfully',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };
}
