import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from 'src/db';

describe('PrivacySettingsController', () => {
    let testUserId: string;
    let testUserId2: string;

    beforeAll(async () => {
        const user1 = await prisma.user.create({
            data: {
                email: `test-privacy-${Date.now()}@example.com`,
                password: 'hashed_password',
                firstName: 'Test',
                lastName: 'User',
            },
        });
        testUserId = user1.id;

        const user2 = await prisma.user.create({
            data: {
                email: `test-privacy-2-${Date.now()}@example.com`,
                password: 'hashed_password',
                firstName: 'Test2',
                lastName: 'User2',
            },
        });
        testUserId2 = user2.id;
    });

    afterEach(async () => {
        await prisma.privacySettings.deleteMany({
            where: { userId: { in: [testUserId, testUserId2] } },
        });
    });

    it('should create default privacy settings', async () => {
        const settings = await prisma.privacySettings.create({
            data: {
                userId: testUserId,
            },
        });

        expect(settings.profileVisibility).toBe('PUBLIC');
        expect(settings.showEmail).toBe(false);
        expect(settings.showPhone).toBe(false);
        expect(settings.allowDirectMessages).toBe(true);
    });

    it('should support all privacy levels', async () => {
        const levels = ['PUBLIC', 'PRIVATE', 'FRIENDS_ONLY', 'CUSTOM'] as const;

        for (const level of levels) {
            const settings = await prisma.privacySettings.create({
                data: {
                    userId: testUserId,
                    profileVisibility: level,
                },
            });

            expect(settings.profileVisibility).toBe(level);

            await prisma.privacySettings.delete({ where: { id: settings.id } });
        }
    });

    it('should manage block list', async () => {
        const settings = await prisma.privacySettings.create({
            data: {
                userId: testUserId,
                blockList: [],
            },
        });

        // Add user to block list
        const updated = await prisma.privacySettings.update({
            where: { id: settings.id },
            data: {
                blockList: [testUserId2],
            },
        });

        expect(updated.blockList).toContain(testUserId2);

        // Remove from block list
        const unblocked = await prisma.privacySettings.update({
            where: { id: settings.id },
            data: {
                blockList: [],
            },
        });

        expect(unblocked.blockList).not.toContain(testUserId2);
    });

    it('should track last privacy review date', async () => {
        const settings = await prisma.privacySettings.create({
            data: {
                userId: testUserId,
            },
        });

        expect(settings.lastPrivacyReviewDate).toBeNull();

        const now = new Date();
        const updated = await prisma.privacySettings.update({
            where: { id: settings.id },
            data: {
                lastPrivacyReviewDate: now,
            },
        });

        expect(updated.lastPrivacyReviewDate).toBeDefined();
    });

    it('should manage data retention policy', async () => {
        const settings = await prisma.privacySettings.create({
            data: {
                userId: testUserId,
                dataRetentionMonths: 24,
            },
        });

        const updated = await prisma.privacySettings.update({
            where: { id: settings.id },
            data: { dataRetentionMonths: 12 },
        });

        expect(updated.dataRetentionMonths).toBe(12);
    });

    it('should store custom privacy rules', async () => {
        const customRules = {
            allowCommercialMessages: false,
            allowAnalytics: true,
        };

        const settings = await prisma.privacySettings.create({
            data: {
                userId: testUserId,
                customPrivacyRules: customRules,
            },
        });

        expect(settings.customPrivacyRules).toEqual(customRules);
    });
});
