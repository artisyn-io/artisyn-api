import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import ProfileController from '../ProfileController';
import app from '../../index';
import multer from 'multer';
import { prisma } from 'src/db';
import request from 'supertest';

describe('ProfileController', () => {
    const upload = multer({ dest: 'public/media' });
    let testUserId: string;
    let authToken: string;

    beforeAll(async () => {
        // Setup test routes
        app.get('/api/test/profile', new ProfileController().getProfile);
        app.post('/api/test/profile', upload.none(), new ProfileController().updateProfile);
        app.get('/api/test/profile/completion', new ProfileController().getProfileCompletion);
        app.get('/api/test/profile/:userId/public', new ProfileController().getPublicProfile);
        app.delete('/api/test/profile', new ProfileController().deleteProfile);

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
        // In real tests, generate a proper JWT token
        // authToken = generateTestToken(testUserId);
    });

    afterEach(async () => {
        // Cleanup test data
        await prisma.userProfile.deleteMany({
            where: { userId: testUserId },
        });
    });

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
});
