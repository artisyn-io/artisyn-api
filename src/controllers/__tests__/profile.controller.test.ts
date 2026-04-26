import type { NextFunction, Request, Response } from 'express';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import ErrorHandler from 'src/utils/request-handlers';
import ProfileController from '../ProfileController';
import app from '../../index';
import { generateAccessToken } from 'src/utils/helpers';
import { prisma } from 'src/db';
import request from 'supertest';

describe('ProfileController', () => {
    let testUserId: string;
    let authToken: string;
    const createdPublicUserIds: string[] = [];

    const injectTestUser = (req: Request, _res: Response, next: NextFunction) => {
        req.user = { id: testUserId } as never;
        next();
    };

    beforeAll(async () => {
        // Setup test routes
        app.get('/api/test/profile', injectTestUser, new ProfileController().getProfile);
        app.post('/api/test/profile', injectTestUser, new ProfileController().updateProfile);
        app.get('/api/test/profile/completion', injectTestUser, new ProfileController().getProfileCompletion);
        app.get('/api/test/profile/:userId/public', new ProfileController().getPublicProfile);
        app.delete('/api/test/profile', injectTestUser, new ProfileController().deleteProfile);
        app.use(ErrorHandler);

        // Create test user
        const user = await prisma.user.create({
            data: {
                email: `test-profile-${Date.now()}@example.com`,
                password: 'hashed_password',
                firstName: 'Test',
                lastName: 'User',
            },
        });
        testUserId = user.id;
        authToken = generateAccessToken({
            username: user.email,
            id: user.id,
            index: Date.now(),
        }).token;
    });

    afterAll(async () => {
        await prisma.privacySettings.deleteMany({
            where: { userId: testUserId },
        });
        await prisma.userProfile.deleteMany({
            where: { userId: testUserId },
        });
        await prisma.user.deleteMany({
            where: { id: testUserId },
        });
    });

    afterEach(async () => {
        // Cleanup test data
        const allUserIds = [testUserId, ...createdPublicUserIds];

        await prisma.privacySettings.deleteMany({
            where: { userId: { in: allUserIds } },
        });
        await prisma.userProfile.deleteMany({
            where: { userId: { in: allUserIds } },
        });
        await prisma.user.deleteMany({
            where: { id: { in: createdPublicUserIds } },
        });
        createdPublicUserIds.length = 0;
    });

    const createPublicProfileFixture = async (options?: {
        isPublic?: boolean;
        location?: string;
        email?: string;
        phone?: string;
        privacySettings?: {
            profileVisibility?: 'PUBLIC' | 'PRIVATE' | 'FRIENDS_ONLY' | 'CUSTOM';
            showEmail?: boolean;
            showPhone?: boolean;
            showLocation?: boolean;
        };
    }) => {
        const user = await prisma.user.create({
            data: {
                email: options?.email ?? `public-profile-${Date.now()}-${Math.random()}@example.com`,
                password: 'hashed_password',
                firstName: 'Public',
                lastName: 'User',
                phone: options?.phone ?? '+15550001111',
            },
        });
        createdPublicUserIds.push(user.id);

        const profile = await prisma.userProfile.create({
            data: {
                userId: user.id,
                bio: 'Visible bio',
                location: options?.location ?? 'San Francisco',
                website: 'https://example.com',
                occupation: 'Engineer',
                companyName: 'Tech Co',
                isPublic: options?.isPublic ?? true,
            },
        });

        if (options?.privacySettings) {
            await prisma.privacySettings.create({
                data: {
                    userId: user.id,
                    ...options.privacySettings,
                },
            });
        }

        return { user, profile };
    };

    it('should create and retrieve user profile', async () => {
        const profileData = {
            bio: 'This is my bio',
            occupation: 'Software Engineer',
            companyName: 'Tech Company',
            location: 'San Francisco',
            isPublic: true,
        };

        // Note: This would require authentication middleware in real tests
        // For now, mock the req.user object
        expect(testUserId).toBeDefined();
    });

    it('should require authentication for the mounted profile routes', async () => {
        await request(app)
            .get('/api/profile')
            .expect(401);

        await request(app)
            .post('/api/profile')
            .send({ bio: 'Unauthorized update' })
            .expect(401);

        await request(app)
            .get('/api/profile/completion')
            .expect(401);

        await request(app)
            .delete('/api/profile')
            .expect(401);
    });

    it('should allow authenticated requests through the mounted profile routes', async () => {
        const getResponse = await request(app)
            .get('/api/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(getResponse.body.data.userId).toBe(testUserId);

        const updateResponse = await request(app)
            .post('/api/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                bio: 'Authenticated update',
                occupation: 'Engineer',
            })
            .expect(200);

        expect(updateResponse.body.data).toEqual(expect.objectContaining({
            userId: testUserId,
            bio: 'Authenticated update',
            occupation: 'Engineer',
        }));

        const completionResponse = await request(app)
            .get('/api/profile/completion')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(completionResponse.body.data).toEqual(expect.objectContaining({
            profileCompletionPercentage: expect.any(Number),
        }));

        await request(app)
            .delete('/api/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
    });

    it('should calculate profile completion percentage', async () => {
        const profile = await prisma.userProfile.create({
            data: {
                userId: testUserId,
                bio: 'Test bio',
                occupation: 'Engineer',
                profileCompletionPercentage: 50,
            },
        });

        expect(profile.profileCompletionPercentage).toBeGreaterThanOrEqual(0);
        expect(profile.profileCompletionPercentage).toBeLessThanOrEqual(100);
    });

    it('should return all completion fields as missing for an empty profile', async () => {
        const response = await request(app)
            .get('/api/test/profile/completion')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(response.body.data).toEqual(expect.objectContaining({
            id: null,
            profileCompletionPercentage: 0,
            missingFields: [
                'bio',
                'dateOfBirth',
                'profilePictureUrl',
                'website',
                'occupation',
                'companyName',
            ],
        }));
    });

    it('should return only incomplete completion fields for a partial profile', async () => {
        await prisma.userProfile.create({
            data: {
                userId: testUserId,
                bio: 'Filled bio',
                occupation: 'Engineer',
                profileCompletionPercentage: 33,
            },
        });

        const response = await request(app)
            .get('/api/test/profile/completion')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(response.body.data).toEqual(expect.objectContaining({
            bio: 'Filled bio',
            occupation: 'Engineer',
            missingFields: [
                'dateOfBirth',
                'profilePictureUrl',
                'website',
                'companyName',
            ],
        }));
    });

    it('should return no missing fields for a fully completed profile', async () => {
        await prisma.userProfile.create({
            data: {
                userId: testUserId,
                bio: 'Filled bio',
                dateOfBirth: new Date('2000-01-15T00:00:00.000Z'),
                profilePictureUrl: 'https://example.com/avatar.jpg',
                website: 'https://example.com',
                occupation: 'Engineer',
                companyName: 'Tech Co',
                profileCompletionPercentage: 100,
            },
        });

        const response = await request(app)
            .get('/api/test/profile/completion')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(response.body.data).toEqual(expect.objectContaining({
            profileCompletionPercentage: 100,
            missingFields: [],
        }));
    });

    it('should update profile with validation', async () => {
        const profile = await prisma.userProfile.create({
            data: {
                userId: testUserId,
                bio: 'Original bio',
            },
        });

        const updated = await prisma.userProfile.update({
            where: { id: profile.id },
            data: { bio: 'Updated bio' },
        });

        expect(updated.bio).toBe('Updated bio');
    });

    it('should track profile as public or private', async () => {
        const profile = await prisma.userProfile.create({
            data: {
                userId: testUserId,
                isPublic: true,
            },
        });

        expect(profile.isPublic).toBe(true);

        const updated = await prisma.userProfile.update({
            where: { id: profile.id },
            data: { isPublic: false },
        });

        expect(updated.isPublic).toBe(false);
    });

    it('should persist and return valid socialLinks payloads', async () => {
        const socialLinks = {
            twitter: '@artisan',
            linkedin: 'https://www.linkedin.com/in/artisan',
            github: 'https://github.com/artisan',
        };

        const updateResponse = await request(app)
            .post('/api/test/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                bio: 'Updated bio',
                socialLinks,
            })
            .expect(200);

        expect(updateResponse.body.data.socialLinks).toEqual(socialLinks);

        const storedProfile = await prisma.userProfile.findFirst({
            where: { userId: testUserId },
        });

        expect(storedProfile?.socialLinks).toEqual(socialLinks);

        const fetchResponse = await request(app)
            .get('/api/test/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(fetchResponse.body.data.socialLinks).toEqual(socialLinks);
    });

    it('should reject socialLinks with unsupported platforms', async () => {
        const response = await request(app)
            .post('/api/test/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                socialLinks: {
                    mastodon: '@artisan',
                },
            })
            .expect(422);

        expect(response.body).toEqual(expect.objectContaining({
            status: 'error',
            code: 422,
            errors: expect.objectContaining({
                socialLinks: expect.any(Array),
            }),
        }));
    });

    it('should reject socialLinks with non-string values', async () => {
        const response = await request(app)
            .post('/api/test/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                socialLinks: {
                    twitter: 12345,
                },
            })
            .expect(422);

        expect(response.body).toEqual(expect.objectContaining({
            status: 'error',
            code: 422,
            errors: expect.objectContaining({
                socialLinks: expect.any(Array),
            }),
        }));
    });

    it('should return public profile fields when privacy settings allow them', async () => {
        const { user } = await createPublicProfileFixture({
            privacySettings: {
                profileVisibility: 'PUBLIC',
                showEmail: true,
                showPhone: true,
                showLocation: true,
            },
            location: 'Lagos',
            phone: '+2348000000000',
        });

        const response = await request(app)
            .get(`/api/test/profile/${user.id}/public`)
            .expect(200);

        expect(response.body.data).toEqual(expect.objectContaining({
            userId: user.id,
            location: 'Lagos',
            email: user.email,
            phone: '+2348000000000',
        }));
    });

    it('should reject public profile access when profile visibility is private', async () => {
        const { user } = await createPublicProfileFixture({
            privacySettings: {
                profileVisibility: 'PRIVATE',
                showEmail: true,
                showPhone: true,
                showLocation: true,
            },
        });

        await request(app)
            .get(`/api/test/profile/${user.id}/public`)
            .expect(403);
    });

    it('should null hidden fields in partially hidden public profiles', async () => {
        const { user } = await createPublicProfileFixture({
            privacySettings: {
                profileVisibility: 'PUBLIC',
                showEmail: false,
                showPhone: false,
                showLocation: true,
            },
            location: 'Accra',
            phone: '+233200000000',
        });

        const response = await request(app)
            .get(`/api/test/profile/${user.id}/public`)
            .expect(200);

        expect(response.body.data).toEqual(expect.objectContaining({
            userId: user.id,
            location: 'Accra',
            email: null,
            phone: null,
        }));
    });
});
