import request from 'supertest';
import app from '../index'; // Adjusted path
import { prisma } from '../db'; // Adjusted path
import { UserRole } from '@prisma/client';
import { generateAccessToken } from '../utils/helpers';
import { constructFrom } from 'date-fns';

describe('Listings API Integration Tests', () => {
    let curatorToken: string;
    let userToken: string;
    let curatorId: string;
    let categoryId: string;
    let locationId: string;
    let listingId: string;

    beforeAll(async () => {
        // Cleanup potential stale data from aborted runs
        await prisma.tip.deleteMany();
        await prisma.review.deleteMany();
        await prisma.artisan.deleteMany();
        await prisma.personalAccessToken.deleteMany();
        await prisma.curator.deleteMany();
        await prisma.user.deleteMany();
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
            .send({
                name: 'New Listing',
                phone: '555-5555',
                description: 'A newly created listing by curator',
                categoryId,
                locationId,
                images: ['http://example.com/img.jpg'],
                isActive: true
            });

        expect(res.status).toBe(201);
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
});
