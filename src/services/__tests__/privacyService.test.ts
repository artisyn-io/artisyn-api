import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from 'src/db';
import { FriendshipService } from 'src/services/FriendshipService';
import { PrivacyService } from 'src/services/PrivacyService';

describe('PrivacyService visibility behavior', () => {
    let users: {
        owner: string;
        friend: string;
        stranger: string;
        blocked: string;
        restricted: string;
    };

    beforeEach(async () => {
        const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        users = {
            owner: `privacy-owner-${runId}`,
            friend: `privacy-friend-${runId}`,
            stranger: `privacy-stranger-${runId}`,
            blocked: `privacy-blocked-${runId}`,
            restricted: `privacy-restricted-${runId}`,
        };

        for (const [key, userId] of Object.entries(users)) {
            await prisma.user.create({
                data: {
                    id: userId,
                    email: `${key}-${runId}@example.com`,
                    password: 'password',
                    firstName: key,
                    lastName: 'User',
                    phone: '+15555555555',
                },
            });
        }

        await prisma.userProfile.create({
            data: {
                userId: users.owner,
                bio: 'Owner bio',
                profilePictureUrl: 'https://example.com/avatar.jpg',
                website: 'https://example.com',
                occupation: 'Engineer',
                companyName: 'Example Corp',
                location: 'Lagos',
                isPublic: true,
            },
        });
    });

    afterEach(async () => {
        const allIds = Object.values(users);
        await prisma.friendship.deleteMany({
            where: {
                OR: [
                    { userId: { in: allIds } },
                    { friendId: { in: allIds } },
                ],
            },
        });
        await prisma.privacySettings.deleteMany({
            where: { userId: { in: allIds } },
        });
        await prisma.userProfile.deleteMany({
            where: { userId: { in: allIds } },
        });
        await prisma.user.deleteMany({
            where: { id: { in: allIds } },
        });
    });

    it('enforces PUBLIC and PRIVATE visibility modes', async () => {
        await PrivacyService.updateProfileVisibility(users.owner, 'PUBLIC');
        expect((await PrivacyService.canViewProfile(users.stranger, users.owner)).allowed).toBe(true);
        expect(await PrivacyService.getFilteredProfileData(users.stranger, users.owner)).toBeTruthy();

        await PrivacyService.updateProfileVisibility(users.owner, 'PRIVATE');
        expect((await PrivacyService.canViewProfile(users.owner, users.owner)).allowed).toBe(true);
        expect((await PrivacyService.canViewProfile(users.stranger, users.owner)).allowed).toBe(false);
    });

    it('enforces FRIENDS_ONLY and blocked users behavior', async () => {
        await PrivacyService.updateProfileVisibility(users.owner, 'FRIENDS_ONLY');
        const beforeFriendship = await PrivacyService.canViewProfile(users.friend, users.owner);
        expect(beforeFriendship.allowed).toBe(false);
        expect(beforeFriendship.reason).toBe('friends_only');

        const request = await FriendshipService.sendFriendRequest(users.friend, users.owner);
        await FriendshipService.acceptFriendRequest(users.owner, request.id);

        expect((await PrivacyService.canViewProfile(users.friend, users.owner)).allowed).toBe(true);

        await FriendshipService.blockUser(users.owner, users.friend);
        const blocked = await PrivacyService.canViewProfile(users.friend, users.owner);
        expect(blocked.allowed).toBe(false);
        expect(blocked.reason).toBe('blocked');
    });

    it('enforces CUSTOM rules and restricted users behavior', async () => {
        await PrivacyService.updateProfileVisibility(users.owner, 'CUSTOM');
        await prisma.privacySettings.upsert({
            where: { userId: users.owner },
            update: {
                customPrivacyRules: {
                    rules: [
                        { field: 'bio', visibility: 'public' },
                        { field: 'website', visibility: 'friends' },
                        { field: 'occupation', visibility: 'private' },
                    ],
                    defaultVisibility: 'public',
                },
                restrictedList: [users.restricted],
            },
            create: {
                userId: users.owner,
                profileVisibility: 'CUSTOM',
                customPrivacyRules: {
                    rules: [
                        { field: 'bio', visibility: 'public' },
                        { field: 'website', visibility: 'friends' },
                        { field: 'occupation', visibility: 'private' },
                    ],
                    defaultVisibility: 'public',
                },
                restrictedList: [users.restricted],
            },
        });

        const strangerProfile = await PrivacyService.getFilteredProfileData(users.stranger, users.owner);
        expect(strangerProfile?.bio).toBe('Owner bio');
        expect(strangerProfile?.website).toBeUndefined();
        expect(strangerProfile?.occupation).toBeUndefined();

        const restricted = await PrivacyService.canViewProfile(users.restricted, users.owner);
        expect(restricted.allowed).toBe(false);
        expect(restricted.reason).toBe('restricted');
    });
});
