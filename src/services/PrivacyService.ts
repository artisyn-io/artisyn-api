import { prisma } from '../db';
import { FriendshipService } from './FriendshipService';
import { CustomPrivacyService } from './CustomPrivacyService';

// Privacy levels as string literals
const PRIVACY_LEVELS = {
  PUBLIC: 'PUBLIC' as const,
  PRIVATE: 'PRIVATE' as const,
  FRIENDS_ONLY: 'FRIENDS_ONLY' as const,
  CUSTOM: 'CUSTOM' as const,
} as const;

type PrivacyLevel = typeof PRIVACY_LEVELS[keyof typeof PRIVACY_LEVELS];

/**
 * PrivacyService - Centralized privacy logic and visibility management
 * Ensures consistency between UserProfile.isPublic and PrivacySettings.profileVisibility
 */
export class PrivacyService {
  /**
   * Get the effective visibility for a user's profile
   * Uses PrivacySettings.profileVisibility as the source of truth
   */
  static async getProfileVisibility(userId: string): Promise<PrivacyLevel> {
    const privacySettings = await prisma.privacySettings.findFirst({
      where: { userId },
    });

    return privacySettings?.profileVisibility || PRIVACY_LEVELS.PUBLIC;
  }

  /**
   * Update profile visibility and synchronize UserProfile.isPublic
   */
  static async updateProfileVisibility(
    userId: string, 
    visibility: PrivacyLevel
  ): Promise<void> {
    // Update privacy settings
    await prisma.privacySettings.upsert({
      where: { userId },
      update: { 
        profileVisibility: visibility,
        lastPrivacyReviewDate: new Date(),
      },
      create: {
        userId,
        profileVisibility: visibility,
        lastPrivacyReviewDate: new Date(),
      },
    });

    // Synchronize UserProfile.isPublic
    const isPublic = visibility === PRIVACY_LEVELS.PUBLIC;
    await prisma.userProfile.upsert({
      where: { userId },
      update: { isPublic },
      create: {
        userId,
        isPublic,
      },
    });
  }

  /**
   * Check if a user can view another user's profile
   * Takes into account visibility settings, blocks, and restrictions
   */
  static async canViewProfile(
    viewerId: string | null,
    targetUserId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const targetPrivacy = await prisma.privacySettings.findFirst({
      where: { userId: targetUserId },
      include: {
        user: {
          select: {
            profile: true,
          },
        },
      },
    });

    if (!targetPrivacy) {
      return { allowed: true }; // Default to public if no settings exist
    }

    // Check if viewer is blocked (check both blockList and Friendship.BLOCKED status)
    if (viewerId) {
      // Check blockList in privacy settings
      if (targetPrivacy.blockList.includes(viewerId)) {
        return { allowed: false, reason: 'blocked' };
      }

      // Check if viewer is blocked via Friendship model
      const isBlocked = await FriendshipService.isBlockedBy(viewerId, targetUserId);
      if (isBlocked) {
        return { allowed: false, reason: 'blocked' };
      }

      // Restricted users cannot access profile data.
      if (targetPrivacy.restrictedList.includes(viewerId)) {
        return { allowed: false, reason: 'restricted' };
      }
    }

    // Check visibility based on level
    switch (targetPrivacy.profileVisibility) {
      case PRIVACY_LEVELS.PUBLIC:
        return { allowed: true };

      case PRIVACY_LEVELS.PRIVATE:
        // Only the profile owner can view
        return { allowed: viewerId === targetUserId };

      case PRIVACY_LEVELS.FRIENDS_ONLY:
        // Check if viewer is friends with target user
        if (!viewerId) return { allowed: false, reason: 'friends_only' };
        const areFriends = await FriendshipService.areFriends(targetUserId, viewerId);
        return { allowed: areFriends, reason: areFriends ? undefined : 'friends_only' };

      case PRIVACY_LEVELS.CUSTOM:
        // Evaluate custom privacy rules
        const customEvaluation = await CustomPrivacyService.evaluateCustomRules(
          targetUserId,
          viewerId,
          targetPrivacy.customPrivacyRules
        );
        return customEvaluation;

      default:
        return { allowed: true };
    }
  }

  /**
   * Synchronize isPublic field with profileVisibility
   * Call this after any direct privacy settings updates
   */
  static async synchronizeVisibility(userId: string): Promise<void> {
    const privacySettings = await prisma.privacySettings.findFirst({
      where: { userId },
    });

    if (privacySettings) {
      const isPublic = privacySettings.profileVisibility === PRIVACY_LEVELS.PUBLIC;
      await prisma.userProfile.updateMany({
        where: { userId },
        data: { isPublic },
      });
    }
  }

  /**
   * Get filtered profile data based on visibility settings
   */
  static async getFilteredProfileData(
    viewerId: string | null,
    targetUserId: string
  ): Promise<any> {
    const targetPrivacy = await prisma.privacySettings.findFirst({
      where: { userId: targetUserId },
    });

    const canView = await this.canViewProfile(viewerId, targetUserId);
    
    if (!canView.allowed) {
      return null;
    }

    const profile = await prisma.userProfile.findFirst({
      where: { userId: targetUserId },
      select: {
        id: true,
        userId: true,
        bio: true,
        dateOfBirth: true,
        profilePictureUrl: true,
        website: true,
        occupation: true,
        companyName: true,
        location: true,
        verifiedBadge: true,
        isProfessional: true,
        isPublic: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!profile) {
      return null;
    }

    let resultProfile: any = profile;

    // Apply custom privacy rules if visibility is CUSTOM
    if (targetPrivacy?.profileVisibility === PRIVACY_LEVELS.CUSTOM) {
      resultProfile = await CustomPrivacyService.filterProfileData(
        profile,
        targetUserId,
        viewerId,
        targetPrivacy.customPrivacyRules
      );

      if (!resultProfile) {
        return null;
      }
    }

    const showLocation = targetPrivacy?.showLocation ?? false;
    const showEmail = targetPrivacy?.showEmail ?? false;
    const showPhone = targetPrivacy?.showPhone ?? false;
    const isOwner = viewerId === targetUserId;

    if (!isOwner && !showLocation) {
      resultProfile.location = null;
    }

    resultProfile.email = isOwner || showEmail ? resultProfile.user?.email ?? null : null;
    resultProfile.phone = isOwner || showPhone ? resultProfile.user?.phone ?? null : null;
    delete resultProfile.user;

    return resultProfile;
  }
}
