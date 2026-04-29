import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import app from '../../index';
import argon2 from 'argon2';
import { prisma } from 'src/db';
import { rateLimitStore } from 'src/middleware/rateLimiter';
import request from 'supertest';

let userToken: string;
let testUserId: string;

beforeAll(async () => {
    const user = await prisma.user.create({
        data: {
            email: `test-ratelimit-${Date.now()}@example.com`,
            password: await argon2.hash('password'),
            firstName: 'Test',
            lastName: 'User',
        },
    });

    const res = await request(app).post('/api/auth/login').send({
        email: user.email,
        password: 'password',
    });

    userToken = res.body.token;
    testUserId = res.body.data.id;
});

afterAll(async () => {
    await prisma.userPreferences.deleteMany({ where: { userId: testUserId } });
    await prisma.privacySettings.deleteMany({ where: { userId: testUserId } });
    await prisma.accountLink.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
});

afterEach(() => {
    rateLimitStore.clear();
});

describe('Account Linking rate limit', () => {
    it('happy path: includes rate-limit headers and succeeds', async () => {
        const res = await request(app)
            .post('/api/account-links')
            .set('Authorization', `Bearer ${userToken}`)
            .send({});

        expect(res.status).not.toBe(429);
        expect(res.headers['x-ratelimit-limit']).toBe('10');
        expect(res.headers['x-ratelimit-remaining']).toBeDefined();
        expect(res.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('returns 429 after 10 write requests in the same window', async () => {
        for (let i = 0; i < 10; i++) {
            await request(app)
                .post('/api/account-links')
                .set('Authorization', `Bearer ${userToken}`)
                .send({});
        }

        const res = await request(app)
            .post('/api/account-links')
            .set('Authorization', `Bearer ${userToken}`)
            .send({});

        expect(res.status).toBe(429);
        expect(res.headers['retry-after']).toBeDefined();
        expect(res.body.success).toBe(false);
        expect(res.body.retryAfter).toBeGreaterThan(0);
    });

    it('read routes are not subject to the account-linking write limit', async () => {
        for (let i = 0; i < 10; i++) {
            await request(app)
                .post('/api/account-links')
                .set('Authorization', `Bearer ${userToken}`)
                .send({});
        }

        const res = await request(app)
            .get('/api/account-links')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).not.toBe(429);
    });
});

describe('Privacy updates rate limit', () => {
    it('happy path: includes rate-limit headers and succeeds', async () => {
        const res = await request(app)
            .post('/api/privacy')
            .set('Authorization', `Bearer ${userToken}`)
            .send({});

        expect(res.status).not.toBe(429);
        expect(res.headers['x-ratelimit-limit']).toBe('20');
        expect(res.headers['x-ratelimit-remaining']).toBeDefined();
        expect(res.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('returns 429 after 20 write requests in the same window', async () => {
        for (let i = 0; i < 20; i++) {
            await request(app)
                .post('/api/privacy')
                .set('Authorization', `Bearer ${userToken}`)
                .send({});
        }

        const res = await request(app)
            .post('/api/privacy')
            .set('Authorization', `Bearer ${userToken}`)
            .send({});

        expect(res.status).toBe(429);
        expect(res.headers['retry-after']).toBeDefined();
        expect(res.body.success).toBe(false);
        expect(res.body.retryAfter).toBeGreaterThan(0);
    });

    it('read routes are not subject to the privacy write limit', async () => {
        for (let i = 0; i < 20; i++) {
            await request(app)
                .post('/api/privacy')
                .set('Authorization', `Bearer ${userToken}`)
                .send({});
        }

        const res = await request(app)
            .get('/api/privacy')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).not.toBe(429);
    });
});
