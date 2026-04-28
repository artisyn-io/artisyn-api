import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import app from '../../index';
import argon2 from 'argon2';
import { prisma } from 'src/db';
import request from 'supertest';

let userToken: string;
let userToken2: string;
let testUserId: string;
let testUserId2: string;

beforeAll(async () => {
    const user1 = await prisma.user.create({
        data: {
            email: `test-account-link-${Date.now()}@example.com`,
            password: await argon2.hash('password'),
            firstName: 'Test',
            lastName: 'User',
        },
    });
    testUserId = user1.id;

    const res1 = await request(app).post('/api/auth/login').send({
        email: user1.email,
        password: 'password',
    });
    userToken = res1.body.token;

    const user2 = await prisma.user.create({
        data: {
            email: `test-account-link-2-${Date.now()}@example.com`,
            password: await argon2.hash('password'),
            firstName: 'Test2',
            lastName: 'User2',
        },
    });
    testUserId2 = user2.id;

    const res2 = await request(app).post('/api/auth/login').send({
        email: user2.email,
        password: 'password',
    });
    userToken2 = res2.body.token;
});

afterAll(async () => {
    await prisma.accountLink.deleteMany({
        where: { userId: { in: [testUserId, testUserId2] } },
    });
    await prisma.user.deleteMany({
        where: { id: { in: [testUserId, testUserId2] } },
    });
});

afterEach(async () => {
    await prisma.accountLink.deleteMany({
        where: { userId: { in: [testUserId, testUserId2] } },
    });
});

// ─── Issue #137: Persist Full OAuth Provider Metadata ────────────────────────
describe('POST /api/account-links (issue #137)', () => {
    it('should link account with full OAuth metadata', async () => {
        const res = await request(app)
            .post('/api/account-links')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                providerEmail: 'user@gmail.com',
                providerName: 'Test User',
            });

        expect(res.status).toBe(202);
        expect(res.body.data.provider).toBe('GOOGLE');
        expect(res.body.data.providerEmail).toBe('user@gmail.com');
        expect(res.body.data.providerName).toBe('Test User');

        // Verify persisted in DB
        const link = await prisma.accountLink.findFirst({ where: { userId: testUserId } });
        expect(link?.refreshToken).toBe('refresh-token');
        expect(link?.providerEmail).toBe('user@gmail.com');
        expect(link?.providerName).toBe('Test User');
        expect(link?.expiresAt).toBeDefined();
    });

    it('should link account with only required fields', async () => {
        const res = await request(app)
            .post('/api/account-links')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                provider: 'GITHUB',
                providerUserId: 'github-456',
                accessToken: 'access-token',
            });

        expect(res.status).toBe(202);
        expect(res.body.data.provider).toBe('GITHUB');
    });

    it('should not expose accessToken or refreshToken in response', async () => {
        const res = await request(app)
            .post('/api/account-links')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                provider: 'FACEBOOK',
                providerUserId: 'fb-789',
                accessToken: 'secret-access-token',
                refreshToken: 'secret-refresh-token',
            });

        expect(res.status).toBe(202);
        expect(res.body.data.accessToken).toBeUndefined();
        expect(res.body.data.refreshToken).toBeUndefined();
    });

    it('should return 409 Conflict when trying to link already-linked provider', async () => {
        // Link first time
        await request(app)
            .post('/api/account-links')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'access-token',
            })
            .expect(202);

        // Try to link same provider again
        const res = await request(app)
            .post('/api/account-links')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                provider: 'GOOGLE',
                providerUserId: 'google-456',
                accessToken: 'different-token',
            });

        expect(res.status).toBe(409);
        expect(res.body.message).toContain('already linked');
    });

    it('should return 422 for validation errors (distinct from 409 conflict)', async () => {
        const res = await request(app)
            .post('/api/account-links')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                provider: 'INVALID_PROVIDER',
                providerUserId: 'google-123',
                accessToken: 'access-token',
            });

        expect(res.status).toBe(422);
        expect(res.body.errors).toBeDefined();
    });
});

// ─── Issue #136: Unlink by provider name ─────────────────────────────────────
describe('DELETE /api/account-links/:provider (issue #136)', () => {
    it('should unlink an existing linked provider', async () => {
        await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'token',
            },
        });

        const res = await request(app)
            .delete('/api/account-links/GOOGLE')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(202);
        expect(res.body.data.provider).toBe('GOOGLE');
        expect(res.body.data.unlinkedAt).toBeDefined();

        const link = await prisma.accountLink.findFirst({
            where: { userId: testUserId, provider: 'GOOGLE' },
        });
        expect(link?.unlinkedAt).toBeDefined();
        expect(link?.unlinkedAt).not.toBeNull();
    });

    it('should return 400 when account is already unlinked', async () => {
        const link = await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'token',
            },
        });

        // Unlink first time
        await request(app)
            .delete('/api/account-links/GOOGLE')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(202);

        // Try to unlink again
        const res = await request(app)
            .delete('/api/account-links/GOOGLE')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Account is already unlinked');
    });

    it('should return 404 when provider is not linked', async () => {
        const res = await request(app)
            .delete('/api/account-links/GITHUB')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(404);
    });

    it('should return 400 for invalid provider', async () => {
        const res = await request(app)
            .delete('/api/account-links/INVALID_PROVIDER')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(400);
    });
});

// ─── Issue #134: Check availability endpoint ─────────────────────────────────
describe('POST /api/account-links/check-availability (issue #134)', () => {
    it('should return available when providerUserId is not linked', async () => {
        const res = await request(app)
            .post('/api/account-links/check-availability')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ provider: 'GOOGLE', providerUserId: 'google-new-user' });

        expect(res.status).toBe(200);
        expect(res.body.data.available).toBe(true);
    });

    it('should return already_linked_to_you when providerUserId belongs to current user', async () => {
        await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-mine',
                accessToken: 'token',
            },
        });

        const res = await request(app)
            .post('/api/account-links/check-availability')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ provider: 'GOOGLE', providerUserId: 'google-mine' });

        expect(res.status).toBe(200);
        expect(res.body.data.available).toBe(false);
        expect(res.body.data.reason).toBe('already_linked_to_you');
    });

    it('should return available when providerUserId was previously unlinked by current user', async () => {
        const link = await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-mine',
                accessToken: 'token',
            },
        });

        // Unlink it
        await prisma.accountLink.update({
            where: { id: link.id },
            data: { unlinkedAt: new Date() },
        });

        const res = await request(app)
            .post('/api/account-links/check-availability')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ provider: 'GOOGLE', providerUserId: 'google-mine' });

        expect(res.status).toBe(200);
        expect(res.body.data.available).toBe(true);
        expect(res.body.message).toBe('Provider account is available for relinking');
    });

    it('should return linked_by_another_user when providerUserId belongs to another user', async () => {
        await prisma.accountLink.create({
            data: {
                userId: testUserId2,
                provider: 'GOOGLE',
                providerUserId: 'google-other',
                accessToken: 'token',
            },
        });

        const res = await request(app)
            .post('/api/account-links/check-availability')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ provider: 'GOOGLE', providerUserId: 'google-other' });

        expect(res.status).toBe(200);
        expect(res.body.data.available).toBe(false);
        expect(res.body.data.reason).toBe('linked_by_another_user');
    });
});

// ─── Issue #135: Verify account link endpoint ────────────────────────────────
describe('POST /api/account-links/verify (issue #135)', () => {
    it('should verify an unverified account link', async () => {
        await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'token',
                isVerified: false,
            },
        });

        const res = await request(app)
            .post('/api/account-links/verify')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ provider: 'GOOGLE' });

        expect(res.status).toBe(200);
        expect(res.body.data.isVerified).toBe(true);

        const link = await prisma.accountLink.findFirst({
            where: { userId: testUserId, provider: 'GOOGLE' },
        });
        expect(link?.isVerified).toBe(true);
    });

    it('should return 400 when account link is already verified', async () => {
        await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'token',
                isVerified: true,
            },
        });

        const res = await request(app)
            .post('/api/account-links/verify')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ provider: 'GOOGLE' });

        expect(res.status).toBe(400);
    });

    it('should return 404 when account link does not exist', async () => {
        const res = await request(app)
            .post('/api/account-links/verify')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ provider: 'GITHUB' });

        expect(res.status).toBe(404);
    });
});

// ─── Issue #149: Preserve Account Unlink History ────────────────────────────
describe('Account Unlink History (issue #149)', () => {
    it('should allow relinking a previously unlinked account', async () => {
        // Create and link account
        await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'old-token',
            },
        });

        // Unlink it
        await request(app)
            .delete('/api/account-links/GOOGLE')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(202);

        // Verify it's unlinked
        let link = await prisma.accountLink.findFirst({
            where: { userId: testUserId, provider: 'GOOGLE' },
        });
        expect(link?.unlinkedAt).toBeDefined();

        // Relink with new data
        const res = await request(app)
            .post('/api/account-links')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'new-token',
                providerEmail: 'updated@gmail.com',
            });

        expect(res.status).toBe(202);
        expect(res.body.data.provider).toBe('GOOGLE');

        // Verify relinked
        link = await prisma.accountLink.findFirst({
            where: { userId: testUserId, provider: 'GOOGLE' },
        });
        expect(link?.unlinkedAt).toBeNull();
        expect(link?.accessToken).toBe('new-token');
        expect(link?.providerEmail).toBe('updated@gmail.com');
        expect(link?.isVerified).toBe(false); // Reset on relink
    });

    it('should not return unlinked accounts in getLinkedAccounts', async () => {
        // Create and link account
        await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'token',
            },
        });

        // Get linked accounts - should include it
        let res = await request(app)
            .get('/api/account-links')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].provider).toBe('GOOGLE');

        // Unlink it
        await request(app)
            .delete('/api/account-links/GOOGLE')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(202);

        // Get linked accounts - should not include it
        res = await request(app)
            .get('/api/account-links')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.data).toHaveLength(0);
    });

    it('should preserve unlink history in database', async () => {
        // Create and link account
        const created = await prisma.accountLink.create({
            data: {
                userId: testUserId,
                provider: 'GOOGLE',
                providerUserId: 'google-123',
                accessToken: 'token',
            },
        });

        // Unlink it
        await request(app)
            .delete('/api/account-links/GOOGLE')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(202);

        // Verify record still exists with history
        const link = await prisma.accountLink.findFirst({
            where: { userId: testUserId, provider: 'GOOGLE' },
        });
        expect(link?.id).toBe(created.id);
        expect(link?.unlinkedAt).toBeDefined();
        expect(link?.linkedAt).toBeDefined();
        expect(link?.accessToken).toBe('token'); // Tokens preserved for history
    });
});
