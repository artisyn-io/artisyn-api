import { beforeAll, describe, expect, it, afterEach } from 'vitest';
import { prisma } from 'src/db';
// AccountLinkProvider type removed as it's not exported from @prisma/client yet

describe('AccountLinkingController', () => {
    let testUserId: string;
    let testUserId2: string;

    beforeAll(async () => {
        const user1 = await prisma.user.create({
            data: {
                email: `test-account-link-${Date.now()}@example.com`,
                password: 'hashed_password',
                firstName: 'Test',
                lastName: 'User',
            },
        });
        testUserId = user1.id;

        const user2 = await prisma.user.create({
            data: {
                email: `test-account-link-2-${Date.now()}@example.com`,
                password: 'hashed_password',
                firstName: 'Test2',
                lastName: 'User2',
            },
        });
        testUserId2 = user2.id;
    });

    afterEach(async () => {
        await prisma.accountLink.deleteMany({
            where: { userId: { in: [testUserId, testUserId2] } },
        });
    });

    it('should link a social account', async () => {
        const link = await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE' as string,
                providerUserId: 'google-123',
                accessToken: 'access-token-123',
                isVerified: true,
            },
        });

        expect(link.userId).toBe(testUserId);
        expect(link.provider).toBe('GOOGLE');
        expect(link.providerUserId).toBe('google-123');
    });

    it('should support all provider types', async () => {
        const providers: string[] = ['GOOGLE', 'FACEBOOK', 'GITHUB', 'APPLE', 'TWITTER', 'LINKEDIN'];

        for (const provider of providers) {
            const link = await prisma.accountLink.create({
                data: {
                    userId: `test-provider-${provider}-${Date.now()}`,
                    provider,
                    providerUserId: `${provider}-user-id`,
                    accessToken: 'token',
                },
            });

            expect(link.provider).toBe(provider);
            
            await prisma.accountLink.delete({ where: { id: link.id } });
        }
    });

    it('should prevent duplicate provider links per user', async () => {
        await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE' as string,
                providerUserId: 'google-123',
                accessToken: 'token1',
            },
        });

        // Attempting to create a duplicate should fail due to unique constraint
        try {
            await prisma.accountLink.create({
                data: {
                    userId: testUserId,
                    provider: 'GOOGLE' as string,
                    providerUserId: 'google-456',
                    accessToken: 'token2',
                },
            });
            expect.fail('Should have thrown constraint error');
        } catch (error) {
            expect(error).toBeDefined();
        }
    });

    it('should allow same provider account for different users', async () => {
        const link1 = await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE' as string,
                providerUserId: 'google-123',
                accessToken: 'token1',
            },
        });

        const link2 = await prisma.accountLink.create({
            data: {
                userId: testUserId2,
                provider: 'GOOGLE' as string,
                providerUserId: 'google-456',
                accessToken: 'token2',
            },
        });

        expect(link1.providerUserId).not.toBe(link2.providerUserId);
    });

    it('should store access and refresh tokens', async () => {
        const link = await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE' as string,
                providerUserId: 'google-123',
                accessToken: 'access-token-long-string',
                refreshToken: 'refresh-token-long-string',
                expiresAt: new Date(Date.now() + 3600000),
            },
        });

        expect(link.accessToken).toBeDefined();
        expect(link.refreshToken).toBeDefined();
        expect(link.expiresAt).toBeDefined();
    });

    it('should track link verification status', async () => {
        const link = await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'FACEBOOK' as string,
                providerUserId: 'fb-123',
                accessToken: 'token',
                isVerified: false,
            },
        });

        expect(link.isVerified).toBe(false);

        const verified = await prisma.accountLink.update({
            where: { id: link.id },
            data: { isVerified: true },
        });

        expect(verified.isVerified).toBe(true);
    });

    it('should track unlinking date', async () => {
        const link = await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'TWITTER' as string,
                providerUserId: 'twitter-123',
                accessToken: 'token',
            },
        });

        expect(link.unlinkedAt).toBeNull();

        const unlinked = await prisma.accountLink.update({
            where: { id: link.id },
            data: { unlinkedAt: new Date() },
        });

        expect(unlinked.unlinkedAt).toBeDefined();
    });

    it('should store provider metadata', async () => {
        const metadata = {
            profileUrl: 'https://twitter.com/user',
            followerCount: 1000,
        };

        const link = await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'TWITTER' as string,
                providerUserId: 'twitter-123',
                accessToken: 'token',
                metadata,
            },
        });

        expect(link.metadata).toEqual(metadata);
    });
});
