import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';

import { UserRole } from '@prisma/client';
import app from '../index';
import { generateAccessToken } from '../utils/helpers';
import { prisma } from '../db';
import request from 'supertest';

describe('Listings API Integration Tests', () => {
    let curatorToken: string;
    let userToken: string;
    let otherToken: string;
    let curatorId: string;
    let applicantId: string;
    let categoryId: string;
    let locationId: string;
    let listingId: string;
    let applicationId: string;
    let statusApplicationId: string;

    beforeAll(async () => {
        // Cleanup potential stale data from aborted runs
        await prisma.tip.deleteMany();
        await prisma.review.deleteMany();
        await prisma.artisan.deleteMany();
        await prisma.personalAccessToken.deleteMany();
        await prisma.curator.deleteMany();
        await prisma.user.deleteMany();
        await prisma.application.deleteMany();
        await prisma.subcategory.deleteMany();
        await prisma.category.deleteMany();
        await prisma.location.deleteMany();

        // 1. Setup Data: Create Category & Location
        const category = await prisma.category.create({ data: { name: 'Test Category' } });
        categoryId = category.id;
        const location = await prisma.location.create({
            data: { city: 'Test City', state: 'TS', country: 'Testland', latitude: 0, longitude: 0 }
        });
        locationId = location.id;

        // 2. Setup Users: Curator & Regular User
        const curator = await prisma.user.create({
            data: {
                email: 'curator@test.com', password: 'hash', firstName: 'C', lastName: 'T', role: UserRole.CURATOR
            }
        });
        curatorId = curator.id;
        const user = await prisma.user.create({
            data: {
                email: 'user@test.com', password: 'hash', firstName: 'U', lastName: 'T', role: UserRole.USER
            }
        });
        applicantId = user.id;

        // 3. Generate Tokens
        const cAuth = generateAccessToken({ username: curator.email, id: curator.id, index: 1 });
        curatorToken = cAuth.token;
        await prisma.personalAccessToken.create({
            data: { token: cAuth.token, name: 'Test', userId: curator.id, expiresAt: new Date(cAuth.jwt.exp! * 1000) }
        });

        const uAuth = generateAccessToken({ username: user.email, id: user.id, index: 2 });
        userToken = uAuth.token;
        await prisma.personalAccessToken.create({
            data: { token: uAuth.token, name: 'Test', userId: user.id, expiresAt: new Date(uAuth.jwt.exp! * 1000) }
        });

        const otherUser = await prisma.user.create({
            data: {
                email: 'other@test.com', password: 'hash', firstName: 'O', lastName: 'T', role: UserRole.USER
            }
        });
        const otherAuth = generateAccessToken({ username: otherUser.email, id: otherUser.id, index: 3 });
        otherToken = otherAuth.token;
        await prisma.personalAccessToken.create({
            data: { token: otherAuth.token, name: 'Test', userId: otherUser.id, expiresAt: new Date(otherAuth.jwt.exp! * 1000) }
        });

        // 4. Create Initial Listing
        const listing = await prisma.artisan.create({
            data: {
                name: 'Initial Listing',
                description: 'Test Desc',
                phone: '123',
                categoryId,
                locationId,
                curatorId,
                isActive: true
            }
        });
        listingId = listing.id;
    });

    afterAll(async () => {
        // Cleanup
        await prisma.personalAccessToken.deleteMany();
        await prisma.application.deleteMany();
        await prisma.artisan.deleteMany();
        await prisma.user.deleteMany();
        await prisma.category.deleteMany();
        await prisma.location.deleteMany();
    });

    // =========================================================================
    // Public Access Tests
    // =========================================================================

    it('GET /api/listings should be public and return 200', async () => {
        const res = await request(app).get('/api/listings');
        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/listings should include pagination meta', async () => {
        const res = await request(app).get('/api/listings?page=1&limit=5');
        expect(res.status).toBe(200);
        expect(res.body.meta).toBeDefined();
        expect(res.body.meta.pagination).toBeDefined();
        expect(res.body.meta.pagination.perPage).toBe(5);
    });

    it('GET /api/listings/:id should be public and return 200', async () => {
        const res = await request(app).get(`/api/listings/${listingId}`);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(listingId);
    });

    // =========================================================================
    // Authentication & Role Tests
    // =========================================================================

    it('POST /api/listings should deny unauthenticated users (401)', async () => {
        const res = await request(app).post('/api/listings').send({});
        expect(res.status).toBe(401);
    });

    it('POST /api/listings should deny non-curators (403)', async () => {
        const res = await request(app)
            .post('/api/listings')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                name: 'Fail Listing',
                phone: '123',
                description: 'Desc',
                categoryId,
                locationId,
                images: ['http://test.com']
            });
        expect(res.status).toBe(403);
    });

    it('POST /api/listings should allow curators to create listings (201)', async () => {
        const res = await request(app)
            .post('/api/listings')
            .set('Authorization', `Bearer ${curatorToken}`)
            .expect(201)
            .send({
                name: 'New Listing',
                phone: '555-5555',
                description: 'A newly created listing by curator',
                categoryId,
                locationId,
                images: ['http://example.com/img.jpg'],
                isActive: true
            });

        expect(res.body.data.name).toBe('New Listing');
        // Verify curator info is in response but stripped of sensitive data
        expect(res.body.data.curator.id).toBe(curatorId);
        expect(res.body.data.curator.password).toBeUndefined();
    });

    // =========================================================================
    // Update & Delete Tests
    // =========================================================================

    it('PUT /api/listings/:id should return 202 on success', async () => {
        const res = await request(app)
            .put(`/api/listings/${listingId}`)
            .set('Authorization', `Bearer ${curatorToken}`)
            .send({
                name: 'Updated Name',
                phone: '999'
            });

        expect(res.status).toBe(202);
        expect(res.body.data.name).toBe('Updated Name');
    });

    it('DELETE /api/listings/:id should return 202 on success', async () => {
        // Create a temporary listing to delete
        const tempListing = await prisma.artisan.create({
            data: { name: 'To Delete', description: '...', phone: '1', categoryId, locationId, curatorId }
        });

        const res = await request(app)
            .delete(`/api/listings/${tempListing.id}`)
            .set('Authorization', `Bearer ${curatorToken}`);

        expect(res.status).toBe(202);

        // Verify deletion
        const check = await prisma.artisan.findUnique({ where: { id: tempListing.id } });
        expect(check).toBeNull();
    });

    // =========================================================================
    // Application Management Tests
    // =========================================================================

    it('POST /api/applications should reject unauthenticated requests', async () => {
        const res = await request(app)
            .post('/api/applications')
            .send({ listingId });

        expect(res.status).toBe(401);
    });

    it('POST /api/applications should validate listing existence', async () => {
        const res = await request(app)
            .post('/api/applications')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ listingId: randomUUID() });

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/Listing not found/);
    });

    it('POST /api/applications should allow authenticated users to apply', async () => {
        const res = await request(app)
            .post('/api/applications')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ listingId, message: 'Please consider me.' })
            .expect(201);

        expect(res.body.data.id).toBeDefined();
        applicationId = res.body.data.id;
        expect(res.body.data.listingId).toBe(listingId);
    });

    it('POST /api/applications should prevent duplicate active applications', async () => {
        const res = await request(app)
            .post('/api/applications')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ listingId });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/active application/);
    });

    it('GET /api/applications/:id should allow the applicant to view their submission', async () => {
        const res = await request(app)
            .get(`/api/applications/${applicationId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.data.id).toBe(applicationId);
        expect(res.body.data.applicantId).toBe(applicantId);
    });

    it('GET /api/applications/:id should allow the listing owner to view the application', async () => {
        const res = await request(app)
            .get(`/api/applications/${applicationId}`)
            .set('Authorization', `Bearer ${curatorToken}`)
            .expect(200);

        expect(res.body.data.id).toBe(applicationId);
        expect(res.body.data.listingId).toBe(listingId);
    });

    it('GET /api/applications/:id should forbid other users', async () => {
        const res = await request(app)
            .get(`/api/applications/${applicationId}`)
            .set('Authorization', `Bearer ${otherToken}`)
            .expect(403);

        expect(res.body.message).toMatch(/Unauthorized/);
    });

    it('DELETE /api/applications/:id should allow the applicant to withdraw a pending application', async () => {
        const res = await request(app)
            .delete(`/api/applications/${applicationId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(202);

        expect(res.body.data.id).toBe(applicationId);

        const record = await prisma.application.findUnique({ where: { id: applicationId } });
        expect(record).toBeNull();
    });

    it('GET /api/listings/:listingId/applications should allow owners to list their applications', async () => {
        const statusApp = await prisma.application.create({
            data: {
                listingId,
                applicantId,
                status: 'PENDING',
                message: 'Status test'
            }
        });
        statusApplicationId = statusApp.id;

        const res = await request(app)
            .get(`/api/listings/${listingId}/applications`)
            .set('Authorization', `Bearer ${curatorToken}`)
            .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.some((item: any) => item.id === statusApplicationId)).toBe(true);
    });

    it('DELETE /api/applications/:id should forbid non-applicants from withdrawing', async () => {
        await request(app)
            .delete(`/api/applications/${statusApplicationId}`)
            .set('Authorization', `Bearer ${otherToken}`)
            .expect(403);
    });

    it('PUT /api/applications/:id/status should allow owners to accept pending applications', async () => {
        const res = await request(app)
            .put(`/api/applications/${statusApplicationId}/status`)
            .set('Authorization', `Bearer ${curatorToken}`)
            .send({ status: 'ACCEPTED' })
            .expect(200);

        expect(res.body.data.status).toBe('ACCEPTED');
    });

    it('PUT /api/applications/:id/status should prevent invalid transitions', async () => {
        const res = await request(app)
            .put(`/api/applications/${statusApplicationId}/status`)
            .set('Authorization', `Bearer ${curatorToken}`)
            .send({ status: 'REJECTED' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Cannot transition/);
    });

    it('DELETE /api/applications/:id should only allow pending withdrawals', async () => {
        const res = await request(app)
            .delete(`/api/applications/${statusApplicationId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(400);

        expect(res.body.message).toMatch(/Only pending applications/);
    });
});
