import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from 'src/db';
import { PrivacyGuard } from 'src/services/PrivacyGuard';
import app from 'src/index';
import request from 'supertest';
import { generateAccessToken } from 'src/utils/helpers';
import { faker } from '@faker-js/faker';

describe('PrivacyGuard', () => {
    let userId: string;
    let otherUserId: string;

    beforeAll(async () => {
        const runId = faker.string.alphanumeric(8).toLowerCase();

        const user = await prisma.user.create({
            data: {
                email: `guard-${runId}@example.com`,
                password: 'hashed',
                firstName: 'Guard',
                lastName: 'Test',
            },
        });
        userId = user.id;

        const other = await prisma.user.create({
            data: {
                email: `guard-other-${runId}@example.com`,
                password: 'hashed',
                firstName: 'Other',
                lastName: 'Guard',
            },
        });
        otherUserId = other.id;
    });

    afterEach(async () => {
        await prisma.privacySettings.deleteMany({
            where: { userId: { in: [userId, otherUserId] } },
        });
    });

    afterAll(async () => {
        await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    });

    // -----------------------------------------------------------------------
    // searchEngineIndexing
    // -----------------------------------------------------------------------

    describe('getRobotsDirective (searchEngineIndexing)', () => {
        it('returns "index, follow" when searchEngineIndexing is true (default)', async () => {
            await prisma.privacySettings.create({
                data: { userId, searchEngineIndexing: true },
            });

            const directive = await PrivacyGuard.getRobotsDirective(userId);
            expect(directive).toBe('index, follow');
        });

        it('returns "noindex, nofollow" when searchEngineIndexing is false', async () => {
            await prisma.privacySettings.create({
                data: { userId, searchEngineIndexing: false },
            });

            const directive = await PrivacyGuard.getRobotsDirective(userId);
            expect(directive).toBe('noindex, nofollow');
        });

        it('defaults to "index, follow" when no privacy settings row exists', async () => {
            const directive = await PrivacyGuard.getRobotsDirective(userId);
            expect(directive).toBe('index, follow');
        });
    });

    // -----------------------------------------------------------------------
    // allowDirectMessages
    // -----------------------------------------------------------------------

    describe('canSendDirectMessage (allowDirectMessages)', () => {
        it('allows direct messages when the flag is true (default)', async () => {
            await prisma.privacySettings.create({
                data: { userId, allowDirectMessages: true },
            });

            const result = await PrivacyGuard.canSendDirectMessage(otherUserId, userId);
            expect(result.allowed).toBe(true);
        });

        it('blocks direct messages when the flag is false', async () => {
            await prisma.privacySettings.create({
                data: { userId, allowDirectMessages: false },
            });

            const result = await PrivacyGuard.canSendDirectMessage(otherUserId, userId);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBeTruthy();
        });

        it('always allows a user to message themselves', async () => {
            await prisma.privacySettings.create({
                data: { userId, allowDirectMessages: false },
            });

            const result = await PrivacyGuard.canSendDirectMessage(userId, userId);
            expect(result.allowed).toBe(true);
        });

        it('defaults to allowed when no privacy settings row exists', async () => {
            const result = await PrivacyGuard.canSendDirectMessage(otherUserId, userId);
            expect(result.allowed).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // allowProfileComments
    // -----------------------------------------------------------------------

    describe('canPostProfileComment (allowProfileComments)', () => {
        it('allows comments when the flag is true (default)', async () => {
            await prisma.privacySettings.create({
                data: { userId, allowProfileComments: true },
            });

            const result = await PrivacyGuard.canPostProfileComment(otherUserId, userId);
            expect(result.allowed).toBe(true);
        });

        it('blocks comments when the flag is false', async () => {
            await prisma.privacySettings.create({
                data: { userId, allowProfileComments: false },
            });

            const result = await PrivacyGuard.canPostProfileComment(otherUserId, userId);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBeTruthy();
        });

        it('always allows the profile owner to comment on their own profile', async () => {
            await prisma.privacySettings.create({
                data: { userId, allowProfileComments: false },
            });

            const result = await PrivacyGuard.canPostProfileComment(userId, userId);
            expect(result.allowed).toBe(true);
        });

        it('defaults to allowed when no privacy settings row exists', async () => {
            const result = await PrivacyGuard.canPostProfileComment(otherUserId, userId);
            expect(result.allowed).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // HTTP integration: X-Robots-Tag header on public profile endpoint
    // -----------------------------------------------------------------------

    describe('GET /api/profile/:userId/public — X-Robots-Tag enforcement', () => {
        let profileUserId: string;
        let token: string;

        beforeAll(async () => {
            const runId = faker.string.alphanumeric(8).toLowerCase();
            const user = await prisma.user.create({
                data: {
                    email: `robots-${runId}@example.com`,
                    password: 'hashed',
                    firstName: 'Robots',
                    lastName: 'Test',
                },
            });
            profileUserId = user.id;

            // Create a profile so the endpoint returns 200
            await prisma.userProfile.create({ data: { userId: profileUserId } });

            token = generateAccessToken({
                username: user.email,
                id: user.id,
                index: faker.number.int({ min: 1, max: 999999 }),
            }).token;
        });

        afterAll(async () => {
            await prisma.userProfile.deleteMany({ where: { userId: profileUserId } });
            await prisma.privacySettings.deleteMany({ where: { userId: profileUserId } });
            await prisma.user.delete({ where: { id: profileUserId } });
        });

        it('includes X-Robots-Tag: index, follow when searchEngineIndexing is true', async () => {
            await prisma.privacySettings.create({
                data: { userId: profileUserId, searchEngineIndexing: true },
            });

            const res = await request(app)
                .get(`/api/profile/${profileUserId}/public`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.headers['x-robots-tag']).toBe('index, follow');
        });

        it('includes X-Robots-Tag: noindex, nofollow when searchEngineIndexing is false', async () => {
            await prisma.privacySettings.upsert({
                where: { userId: profileUserId },
                update: { searchEngineIndexing: false },
                create: { userId: profileUserId, searchEngineIndexing: false },
            });

            const res = await request(app)
                .get(`/api/profile/${profileUserId}/public`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
        });
    });
});