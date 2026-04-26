import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import app from '../../index';
import argon2 from 'argon2';
import request from 'supertest';
import { prisma } from 'src/db';

describe('PrivacySettingsController', () => {
    let testUserId: string;
    let testUserId2: string;
    let userToken: string;

    const cleanupTestData = async () => {
        await prisma.privacySettings.deleteMany({
            where: {
                user: {
                    email: { contains: 'test-privacy' },
                },
            },
        });

        await prisma.user.deleteMany({
            where: {
                email: { contains: 'test-privacy' },
            },
        });
    };

    const createTestUsers = async (retries = 3) => {
        for (let attempt = 1; attempt <= retries; attempt += 1) {
            try {
                const passwordHash = await argon2.hash('password');

                const user1 = await prisma.user.create({
                    data: {
                        email: `test-privacy-${Date.now()}-${Math.random()}@example.com`,
                        password: passwordHash,
                        firstName: 'Test',
                        lastName: 'User',
                    },
                });

                const user2 = await prisma.user.create({
                    data: {
                        email: `test-privacy-2-${Date.now()}-${Math.random()}@example.com`,
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

                return {
                    user1,
                    user2,
                    token: loginResponse.body.token,
                };
            } catch (error) {
                if (attempt === retries) {
                    throw error;
                }
                await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
            }
        }

        throw new Error('Unable to create test users after retries');
    };

    beforeEach(async () => {
        await cleanupTestData();

        const { user1, user2, token } = await createTestUsers();
        if (!token) {
            throw new Error('Failed to obtain user token for privacy tests');
        }

        testUserId = user1.id;
        testUserId2 = user2.id;
        userToken = token;
    });

    afterEach(async () => {
        const cleanupUserIds = [testUserId, testUserId2].filter(Boolean);

        await prisma.privacySettings.deleteMany({
            where: { userId: { in: cleanupUserIds } },
        });

        if (cleanupUserIds.length > 0) {
            await prisma.user.deleteMany({
                where: { id: { in: cleanupUserIds } },
            });
        }

        await cleanupTestData();
    });

    it('should require authentication for privacy endpoints', async () => {
        await request(app)
            .get('/api/privacy')
            .expect(401);

        await request(app)
            .post('/api/privacy')
            .send({ showEmail: true })
            .expect(401);
    });

    it('should return default privacy settings for an authenticated user', async () => {
        const response = await request(app)
            .get('/api/privacy')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(response.body).toEqual(
            expect.objectContaining({
                status: 'success',
                data: expect.objectContaining({
                    userId: testUserId,
                    profileVisibility: 'PUBLIC',
                }),
            })
        );
    });

    it('should update privacy settings through the API', async () => {
        const response = await request(app)
            .post('/api/privacy')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                profileVisibility: 'PRIVATE',
                showEmail: true,
                showPhone: true,
            })
            .expect(200);

        expect(response.body).toEqual(
            expect.objectContaining({
                status: 'success',
                data: expect.objectContaining({
                    userId: testUserId,
                    profileVisibility: 'PRIVATE',
                    showEmail: true,
                    showPhone: true,
                }),
            })
        );
    });

    it('should preserve privacy settings between requests', async () => {
        await request(app)
            .post('/api/privacy')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                profileVisibility: 'FRIENDS_ONLY',
                showLocation: false,
            })
            .expect(200);

        const response = await request(app)
            .get('/api/privacy')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(response.body.data).toEqual(
            expect.objectContaining({
                profileVisibility: 'FRIENDS_ONLY',
                showLocation: false,
            })
        );
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
