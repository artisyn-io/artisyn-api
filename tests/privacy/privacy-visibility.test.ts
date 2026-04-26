import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import PrivacySettingsController from '../../../src/controllers/PrivacySettingsController';
import ProfileController from '../../../src/controllers/ProfileController';
import { PrivacyService } from '../../../src/services/PrivacyService';
import { CustomPrivacyService } from '../../../src/services/CustomPrivacyService';
import { FriendshipService } from '../../../src/services/FriendshipService';

const prisma = new PrismaClient();

describe('Privacy Visibility Tests', () => {
  let privacyController: PrivacySettingsController;
  let profileController: ProfileController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  const testUsers = {
    owner: 'owner-user-id',
    friend: 'friend-user-id',
    stranger: 'stranger-user-id',
    blocked: 'blocked-user-id',
    restricted: 'restricted-user-id',
  };

  beforeEach(async () => {
    privacyController = new PrivacySettingsController();
    profileController = new ProfileController();
    mockReq = { user: { id: testUsers.owner } };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Create test users
    for (const [type, userId] of Object.entries(testUsers)) {
      await prisma.user.create({
        data: {
          id: userId,
          email: `${type}@test.com`,
          password: 'password',
          firstName: type.charAt(0).toUpperCase() + type.slice(1),
          lastName: 'User',
        },
      });
    }

    // Create owner's profile
    await prisma.userProfile.create({
      data: {
        userId: testUsers.owner,
        bio: 'Test bio',
        profilePictureUrl: 'https://example.com/avatar.jpg',
        website: 'https://example.com',
        occupation: 'Developer',
        companyName: 'Tech Corp',
        location: 'San Francisco',
        isPublic: true,
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: { in: Object.values(testUsers) } },
          { friendId: { in: Object.values(testUsers) } },
        ],
      },
    });
    await prisma.userProfile.deleteMany({
      where: { userId: { in: Object.values(testUsers) } },
    });
    await prisma.privacySettings.deleteMany({
      where: { userId: { in: Object.values(testUsers) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(testUsers) } },
    });
  });

  describe('PUBLIC visibility', () => {
    it('should allow anyone to view public profile', async () => {
      // Set profile to PUBLIC
      mockReq.body = { profileVisibility: 'PUBLIC' };
      await privacyController.updateProfileVisibility(mockReq as Request, mockRes as Response);

      // Test stranger access
      const canView = await PrivacyService.canViewProfile(testUsers.stranger, testUsers.owner);
      expect(canView.allowed).toBe(true);
      expect(canView.reason).toBeUndefined();

      // Test via API
      const viewReq = { params: { userId: testUsers.owner } };
      const profile = await PrivacyService.getFilteredProfileData(testUsers.stranger, testUsers.owner);
      expect(profile).toBeTruthy();
      expect(profile?.bio).toBe('Test bio');
    });
  });

  describe('PRIVATE visibility', () => {
    it('should only allow owner to view private profile', async () => {
      // Set profile to PRIVATE
      mockReq.body = { profileVisibility: 'PRIVATE' };
      await privacyController.updateProfileVisibility(mockReq as Request, mockRes as Response);

      // Test owner access
      const ownerCanView = await PrivacyService.canViewProfile(testUsers.owner, testUsers.owner);
      expect(ownerCanView.allowed).toBe(true);

      // Test stranger access
      const strangerCanView = await PrivacyService.canViewProfile(testUsers.stranger, testUsers.owner);
      expect(strangerCanView.allowed).toBe(false);

      // Test friend access
      const friendCanView = await PrivacyService.canViewProfile(testUsers.friend, testUsers.owner);
      expect(friendCanView.allowed).toBe(false);

      // Test via API
      const profile = await PrivacyService.getFilteredProfileData(testUsers.stranger, testUsers.owner);
      expect(profile).toBeNull();
    });
  });

  describe('FRIENDS_ONLY visibility', () => {
    it('should only allow friends to view profile', async () => {
      // Set profile to FRIENDS_ONLY
      mockReq.body = { profileVisibility: 'FRIENDS_ONLY' };
      await privacyController.updateProfileVisibility(mockReq as Request, mockRes as Response);

      // Test owner access
      const ownerCanView = await PrivacyService.canViewProfile(testUsers.owner, testUsers.owner);
      expect(ownerCanView.allowed).toBe(true);

      // Test stranger access (no friendship)
      const strangerCanView = await PrivacyService.canViewProfile(testUsers.stranger, testUsers.owner);
      expect(strangerCanView.allowed).toBe(false);
      expect(strangerCanView.reason).toBe('friends_only');

      // Create friend relationship with friend user
      const friendshipRequest = await FriendshipService.sendFriendRequest(testUsers.friend, testUsers.owner);
      await FriendshipService.acceptFriendRequest(testUsers.owner, friendshipRequest.id);

      // Test friend access (after accepting friendship)
      const friendCanView = await PrivacyService.canViewProfile(testUsers.friend, testUsers.owner);
      expect(friendCanView.allowed).toBe(true);

      // Friend should see the full profile
      const profile = await PrivacyService.getFilteredProfileData(testUsers.friend, testUsers.owner);
      expect(profile).toBeTruthy();
      expect(profile?.bio).toBe('Test bio');
      expect(profile?.website).toBe('https://example.com');
    });

    it('should deny access to blocked users even with friendship', async () => {
      // Create friend relationship
      const friendshipRequest = await FriendshipService.sendFriendRequest(testUsers.friend, testUsers.owner);
      await FriendshipService.acceptFriendRequest(testUsers.owner, friendshipRequest.id);

      // Set profile to FRIENDS_ONLY
      mockReq.body = { profileVisibility: 'FRIENDS_ONLY' };
      await privacyController.updateProfileVisibility(mockReq as Request, mockRes as Response);

      // Verify friend can access before blocking
      let friendCanView = await PrivacyService.canViewProfile(testUsers.friend, testUsers.owner);
      expect(friendCanView.allowed).toBe(true);

      // Block the friend
      await FriendshipService.blockUser(testUsers.owner, testUsers.friend);

      // Friend should no longer be able to access
      friendCanView = await PrivacyService.canViewProfile(testUsers.friend, testUsers.owner);
      expect(friendCanView.allowed).toBe(false);
      expect(friendCanView.reason).toBe('blocked');
    });
  });

  describe('CUSTOM visibility', () => {
    it('should apply custom privacy rules', async () => {
      const customRules = {
        rules: [
          { field: 'bio', visibility: 'public' },
          { field: 'profilePictureUrl', visibility: 'public' },
          { field: 'website', visibility: 'friends' },
          { field: 'occupation', visibility: 'private' },
          { field: 'companyName', visibility: 'friends' },
          { field: 'location', visibility: 'private' },
        ],
        defaultVisibility: 'public',
      };

      // Set profile to CUSTOM with rules
      mockReq.body = { profileVisibility: 'CUSTOM' };
      await privacyController.updateProfileVisibility(mockReq as Request, mockRes as Response);

      mockReq.body = { customPrivacyRules: customRules };
      await privacyController.updateCustomPrivacyRules(mockReq as Request, mockRes as Response);

      // Test stranger access (should see only public fields)
      const strangerProfile = await PrivacyService.getFilteredProfileData(
        testUsers.stranger,
        testUsers.owner
      );
      expect(strangerProfile).toBeTruthy();
      expect(strangerProfile?.bio).toBe('Test bio'); // public
      expect(strangerProfile?.profilePictureUrl).toBe('https://example.com/avatar.jpg'); // public
      expect(strangerProfile?.website).toBeUndefined(); // friends only
      expect(strangerProfile?.occupation).toBeUndefined(); // private
      expect(strangerProfile?.companyName).toBeUndefined(); // friends only
      expect(strangerProfile?.location).toBeUndefined(); // private

      // Test owner access (should see all fields)
      const ownerProfile = await PrivacyService.getFilteredProfileData(
        testUsers.owner,
        testUsers.owner
      );
      expect(ownerProfile?.bio).toBe('Test bio');
      expect(ownerProfile?.website).toBe('https://example.com');
      expect(ownerProfile?.occupation).toBe('Developer');
      expect(ownerProfile?.companyName).toBe('Tech Corp');
      expect(ownerProfile?.location).toBe('San Francisco');
    });
  });

  describe('Blocked users', () => {
    it('should prevent blocked users from viewing profile', async () => {
      // Block a user
      mockReq.body = { blockedUserId: testUsers.blocked };
      await privacyController.blockUser(mockReq as Request, mockRes as Response);

      // Test blocked user access
      const blockedCanView = await PrivacyService.canViewProfile(testUsers.blocked, testUsers.owner);
      expect(blockedCanView.allowed).toBe(false);
      expect(blockedCanView.reason).toBe('blocked');

      // Test via API
      const profile = await PrivacyService.getFilteredProfileData(testUsers.blocked, testUsers.owner);
      expect(profile).toBeNull();
    });
  });

  describe('Restricted users', () => {
    it('should manage restricted list properly', async () => {
      // Add user to restricted list
      mockReq.body = { restrictedUserId: testUsers.restricted };
      await privacyController.addToRestrictedList(mockReq as Request, mockRes as Response);

      // Get restricted list
      await privacyController.getRestrictedList(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              id: testUsers.restricted,
            }),
          ]),
        })
      );

      // Remove from restricted list
      await privacyController.removeFromRestrictedList(mockReq as Request, mockRes as Response);
    });

    it('should deny restricted users regardless of signed-in status', async () => {
      // Keep profile publicly visible to isolate restricted-list behavior
      mockReq.body = { profileVisibility: 'PUBLIC' };
      await privacyController.updateProfileVisibility(mockReq as Request, mockRes as Response);

      // Add user to restricted list
      mockReq.body = { restrictedUserId: testUsers.restricted };
      await privacyController.addToRestrictedList(mockReq as Request, mockRes as Response);

      // Signed-in restricted user should be blocked
      const restrictedCanView = await PrivacyService.canViewProfile(testUsers.restricted, testUsers.owner);
      expect(restrictedCanView.allowed).toBe(false);
      expect(restrictedCanView.reason).toBe('restricted');

      const restrictedProfile = await PrivacyService.getFilteredProfileData(testUsers.restricted, testUsers.owner);
      expect(restrictedProfile).toBeNull();

      // Anonymous access should still follow PUBLIC rules
      const anonymousCanView = await PrivacyService.canViewProfile(null, testUsers.owner);
      expect(anonymousCanView.allowed).toBe(true);
    });
  });

  describe('Custom privacy rules validation', () => {
    it('should validate custom privacy rules', () => {
      const validRules = {
        rules: [
          { field: 'bio', visibility: 'public' },
          { field: 'website', visibility: 'friends' },
        ],
        defaultVisibility: 'public',
      };

      const validation = CustomPrivacyService.validateCustomRules(validRules);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toBeUndefined();
    });

    it('should reject invalid custom privacy rules', () => {
      const invalidRules = {
        rules: [
          { field: 'bio', visibility: 'invalid' }, // invalid visibility
          { field: '', visibility: 'public' }, // empty field
        ],
        defaultVisibility: 'invalid', // invalid default
      };

      const validation = CustomPrivacyService.validateCustomRules(invalidRules);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(3);
    });
  });

  describe('Visibility synchronization', () => {
    it('should synchronize isPublic with profileVisibility', async () => {
      // Set to PRIVATE
      mockReq.body = { profileVisibility: 'PRIVATE' };
      await privacyController.updateProfileVisibility(mockReq as Request, mockRes as Response);

      const profile = await prisma.userProfile.findFirst({
        where: { userId: testUsers.owner },
      });
      expect(profile?.isPublic).toBe(false);

      // Set to PUBLIC
      mockReq.body = { profileVisibility: 'PUBLIC' };
      await privacyController.updateProfileVisibility(mockReq as Request, mockRes as Response);

      const updatedProfile = await prisma.userProfile.findFirst({
        where: { userId: testUsers.owner },
      });
      expect(updatedProfile?.isPublic).toBe(true);
    });
  });
});
