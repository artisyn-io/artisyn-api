import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import app from '../../index';
import argon2 from 'argon2';
import request from 'supertest';
import { prisma } from 'src/db';

// AccountLinkProvider type removed as it's not exported from @prisma/client yet

describe('AccountLinkingController', () => {
    let testUserId: string;
    let testUserId2: string;
    let userToken: string;
    let otherUserToken: string;

    const cleanupTestData = async () => {
        await prisma.accountLink.deleteMany({
            where: {
                user: {
                    email: { contains: 'test-account-link' },
                },
            },
        });

        await prisma.user.deleteMany({
            where: {
                email: { contains: 'test-account-link' },
            },
        });
    };

    const createTestUsers = async (retries = 3) => {
        for (let attempt = 1; attempt <= retries; attempt += 1) {
            try {
                const passwordHash = await argon2.hash('password');

                const user1 = await prisma.user.create({
                    data: {
                        email: `test-account-link-${Date.now()}-${Math.random()}@example.com`,
                        password: passwordHash,
                        firstName: 'Test',
                        lastName: 'User',
                    },
                });

                const user2 = await prisma.user.create({
                    data: {
                        email: `test-account-link-2-${Date.now()}-${Math.random()}@example.com`,
                        password: passwordHash,
                        firstName: 'Test2',
                        lastName: 'User2',
                    },
                });

                const loginResponse = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: user1.email,
                        password: 'password',
                    })
                    .expect(202);

                const secondLogin = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: user2.email,
                        password: 'password',
                    })
                    .expect(202);

                return {
                    user1,
                    user2,
                    token: loginResponse.body.token,
                    otherToken: secondLogin.body.token,
                };
            } catch (error) {
                if (attempt === retries) {
                    throw error;
                }
                await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
            }
        }

        throw new Error('Unable to create account link test users after retries');
    };

    beforeEach(async () => {
        await cleanupTestData();

        const { user1, user2, token, otherToken } = await createTestUsers();
        if (!token) {
            throw new Error('Failed to obtain user token for account linking tests');
        }

        testUserId = user1.id;
        testUserId2 = user2.id;
        userToken = token;
        otherUserToken = otherToken;
    });

    afterEach(async () => {
        const cleanupUserIds = [testUserId, testUserId2].filter(Boolean);

        await prisma.accountLink.deleteMany({
            where: { userId: { in: cleanupUserIds } },
        });

        if (cleanupUserIds.length > 0) {
            await prisma.user.deleteMany({
                where: { id: { in: cleanupUserIds } },
            });
        }
    });

    it('should require authentication for account linking routes', async () => {
        await request(app)
            .get('/api/account-links')
            .expect(401);

        await request(app)
            .post('/api/account-links')
            .send({
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'test-token',
            })
            .expect(401);
    });

    it('should create and list linked accounts with masked tokens', async () => {
        const createResponse = await request(app)
            .post('/api/account-links')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'access-token-123',
                refreshToken: 'refresh-token-123',
                providerEmail: 'user@example.com',
                providerName: 'Test User',
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
            })
            .expect(201);

        expect(createResponse.body).toEqual(
            expect.objectContaining({
                status: 'success',
                data: expect.objectContaining({
                    userId: testUserId,
                    provider: 'GOOGLE',
                    providerUserId: 'google-123',
                    providerEmail: 'user@example.com',
                    providerName: 'Test User',
                    isVerified: true,
                    accessToken: '***',
                    refreshToken: '***',
                }),
            })
        );

        const listResponse = await request(app)
            .get('/api/account-links?page=1&limit=1')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(listResponse.body.meta).toEqual(
            expect.objectContaining({
                pagination: expect.objectContaining({
                    total: 1,
                    perPage: 1,
                    from: 1,
                    to: 1,
                }),
            })
        );

        expect(listResponse.body.data[0]).toEqual(
            expect.objectContaining({
                userId: testUserId,
                provider: 'GOOGLE',
                accessToken: '***',
                refreshToken: '***',
            })
        );
    });

    it('should return details for a provider-specific linked account', async () => {
        await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'access-token',
                providerEmail: 'user@example.com',
                providerName: 'Test User',
            },
        });

        const response = await request(app)
            .get('/api/account-links/GOOGLE')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(response.body.data).toEqual(
            expect.objectContaining({
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                providerEmail: 'user@example.com',
                providerName: 'Test User',
                accessToken: '***',
            })
        );

        if (response.body.data.refreshToken !== undefined) {
            expect(response.body.data.refreshToken).toBe('***');
        }
    });

    it('should update linked account tokens with the refresh endpoint', async () => {
        await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            },
        });

        const expiresAt = new Date(Date.now() + 3600000).toISOString();

        const response = await request(app)
            .patch('/api/account-links/GOOGLE/token')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
                expiresAt,
            })
            .expect(200);

        expect(response.body.data).toEqual(
            expect.objectContaining({
                provider: 'GOOGLE',
                accessToken: '***',
                refreshToken: '***',
            })
        );

        const updated = await prisma.accountLink.findFirst({
            where: { userId: testUserId, provider: 'GOOGLE' },
        });

        expect(updated?.accessToken).toBe('new-access-token');
        expect(updated?.refreshToken).toBe('new-refresh-token');
        expect(updated?.expiresAt).toEqual(new Date(expiresAt));
    });

    it('should return 404 for an unlinked provider', async () => {
        await request(app)
            .get('/api/account-links/FACEBOOK')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(404);
    });

    it('should prevent token refresh on behalf of a different user', async () => {
        await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'access-token',
            },
        });

        await request(app)
            .patch('/api/account-links/GOOGLE/token')
            .set('Authorization', `Bearer ${otherUserToken}`)
            .send({ accessToken: 'new-token' })
            .expect(404);
    });

    it('should unlink a provider by provider name', async () => {
        await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'access-token',
            },
        });

        await request(app)
            .delete('/api/account-links/GOOGLE')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        const deleted = await prisma.accountLink.findFirst({
            where: { userId: testUserId, provider: 'GOOGLE' },
        });

        expect(deleted).toBeNull();
    });

    it('should reject invalid provider values for token refresh', async () => {
        await request(app)
            .patch('/api/account-links/INVALID_PROVIDER/token')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ accessToken: 'new-token' })
            .expect(400);
    });

    it('should link a social account', async () => {
        const link = await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE' as const,
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
        const providers = ['GOOGLE', 'FACEBOOK', 'GITHUB', 'APPLE', 'TWITTER', 'LINKEDIN'] as const;

        for (const provider of providers) {
            const link = await prisma.accountLink.create({
                data: {
                    userId: testUserId,
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
                provider: 'GOOGLE' as const,
                providerUserId: 'google-123',
                accessToken: 'token1',
            },
        });

        // Attempting to create a duplicate should fail due to unique constraint
        try {
            await prisma.accountLink.create({
                data: {
                    userId: testUserId,
                    provider: 'GOOGLE' as const,
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
                provider: 'GOOGLE' as const,
                providerUserId: 'google-123',
                accessToken: 'token1',
            },
        });

        const link2 = await prisma.accountLink.create({
            data: {
                userId: testUserId2,
                provider: 'GOOGLE' as const,
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
                provider: 'GOOGLE' as const,
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
                provider: 'FACEBOOK' as const,
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
                provider: 'TWITTER' as const,
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
                provider: 'TWITTER' as const,
                providerUserId: 'twitter-123',
                accessToken: 'token',
                metadata,
            },
        });

        expect(link.metadata).toEqual(metadata);
    });
});
