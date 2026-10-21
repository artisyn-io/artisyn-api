import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import app from '../index';
import { generateAccessToken } from '../utils/helpers';
import { prisma } from '../db';

describe('Saved Artisans (Shortlist) API Integration Tests', () => {
    let user1Token: string;
    let user2Token: string;
    let user1Id: string;
    let user2Id: string;
    let curatorId: string;
    let categoryId: string;
    let locationId: string;
    let artisan1Id: string;
    let artisan2Id: string;
    let artisan3Id: string;
    let archivedArtisanId: string;

    const runId = Math.random().toString(36).slice(2, 10);

    beforeAll(async () => {
        // Setup Category and Location
        const category = await prisma.category.create({
            data: { name: `Shortlist Cat ${runId}` },
        });
        categoryId = category.id;

        const location = await prisma.location.create({
            data: {
                city: `Shortlist City ${runId}`,
                state: 'SC',
                country: 'Shortland',
                latitude: 10.0,
                longitude: 20.0,
            },
        });
        locationId = location.id;

        // Setup Curator and Users
        const curator = await prisma.user.create({
            data: {
                email: `curator-${runId}@test.com`,
                password: 'hash',
                firstName: 'Curator',
                lastName: 'Test',
                role: UserRole.CURATOR,
            },
        });
        curatorId = curator.id;

        const user1 = await prisma.user.create({
            data: {
                email: `user1-${runId}@test.com`,
                password: 'hash',
                firstName: 'User1',
                lastName: 'Test',
                role: UserRole.USER,
            },
        });
        user1Id = user1.id;

        const user2 = await prisma.user.create({
            data: {
                email: `user2-${runId}@test.com`,
                password: 'hash',
                firstName: 'User2',
                lastName: 'Test',
                role: UserRole.USER,
            },
        });
        user2Id = user2.id;

        // Create Personal Access Tokens
        const u1Auth = generateAccessToken({ username: user1.email, id: user1.id, index: 1 });
        user1Token = u1Auth.token;
        await prisma.personalAccessToken.create({
            data: {
                token: u1Auth.token,
                name: 'Test',
                userId: user1.id,
                expiresAt: new Date(u1Auth.jwt.exp! * 1000),
            },
        });

        const u2Auth = generateAccessToken({ username: user2.email, id: user2.id, index: 2 });
        user2Token = u2Auth.token;
        await prisma.personalAccessToken.create({
            data: {
                token: u2Auth.token,
                name: 'Test',
                userId: user2.id,
                expiresAt: new Date(u2Auth.jwt.exp! * 1000),
            },
        });

        // Create Active Artisans
        const a1 = await prisma.artisan.create({
            data: {
                name: `Artisan One ${runId}`,
                description: 'Expert carpenter specializing in modern furniture',
                phone: '111-1111',
                categoryId,
                locationId,
                curatorId,
                images: ['http://example.com/a1.jpg'],
                price: 150,
                isActive: true,
            },
        });
        artisan1Id = a1.id;

        const a2 = await prisma.artisan.create({
            data: {
                name: `Artisan Two ${runId}`,
                description: 'Master ceramic potter and sculptor',
                phone: '222-2222',
                categoryId,
                locationId,
                curatorId,
                images: ['http://example.com/a2.jpg'],
                price: 250,
                isActive: true,
            },
        });
        artisan2Id = a2.id;

        const a3 = await prisma.artisan.create({
            data: {
                name: `Artisan Three ${runId}`,
                description: 'Custom leather craftsman',
                phone: '333-3333',
                categoryId,
                locationId,
                curatorId,
                images: ['http://example.com/a3.jpg'],
                price: 90,
                isActive: true,
            },
        });
        artisan3Id = a3.id;

        // Create Archived / Inactive Artisan
        const archived = await prisma.artisan.create({
            data: {
                name: `Archived Artisan ${runId}`,
                description: 'Archived listing',
                phone: '444-4444',
                categoryId,
                locationId,
                curatorId,
                images: ['http://example.com/archived.jpg'],
                isActive: false,
                archivedAt: new Date(),
            },
        });
        archivedArtisanId = archived.id;
    });

    afterAll(async () => {
        await prisma.savedArtisan.deleteMany({
            where: {
                OR: [
                    { userId: { in: [user1Id, user2Id] } },
                    { artisanId: { in: [artisan1Id, artisan2Id, artisan3Id, archivedArtisanId] } },
                ],
            },
        });
        await prisma.artisan.deleteMany({
            where: {
                id: { in: [artisan1Id, artisan2Id, artisan3Id, archivedArtisanId] },
            },
        });
        await prisma.personalAccessToken.deleteMany({
            where: { userId: { in: [user1Id, user2Id, curatorId] } },
        });
        await prisma.user.deleteMany({
            where: { id: { in: [user1Id, user2Id, curatorId] } },
        });
        await prisma.category.deleteMany({ where: { id: categoryId } });
        await prisma.location.deleteMany({ where: { id: locationId } });
    });

    describe('Authentication & Authorization', () => {
        it('GET /api/saved-artisans should reject unauthenticated requests with 401', async () => {
            const res = await request(app).get('/api/saved-artisans');
            expect(res.status).toBe(401);
        });

        it('PUT /api/saved-artisans/:artisanId should reject unauthenticated requests with 401', async () => {
            const res = await request(app).put(`/api/saved-artisans/${artisan1Id}`);
            expect(res.status).toBe(401);
        });

        it('DELETE /api/saved-artisans/:artisanId should reject unauthenticated requests with 401', async () => {
            const res = await request(app).delete(`/api/saved-artisans/${artisan1Id}`);
            expect(res.status).toBe(401);
        });

        it('GET /api/saved-artisans/ids should reject unauthenticated requests with 401', async () => {
            const res = await request(app).get('/api/saved-artisans/ids');
            expect(res.status).toBe(401);
        });

        it('GET /api/saved-artisans/count should reject unauthenticated requests with 401', async () => {
            const res = await request(app).get('/api/saved-artisans/count');
            expect(res.status).toBe(401);
        });

        it('Validation: should return 422 when artisanId is not a valid UUID', async () => {
            const res = await request(app)
                .put('/api/saved-artisans/not-a-valid-uuid')
                .set('Authorization', `Bearer ${user1Token}`);
            expect(res.status).toBe(422);
        });
    });

    describe('Idempotent Save & Delete Operations', () => {
        it('PUT /api/saved-artisans/:artisanId should save an artisan successfully', async () => {
            const res = await request(app)
                .put(`/api/saved-artisans/${artisan1Id}`)
                .set('Authorization', `Bearer ${user1Token}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.artisanId).toBe(artisan1Id);
            expect(res.body.data.userId).toBe(user1Id);
            expect(res.body.data.artisan).toBeDefined();
            expect(res.body.data.artisan.name).toContain('Artisan One');
            expect(res.body.data.artisan.category.id).toBe(categoryId);
            expect(res.body.data.artisan.curator.id).toBe(curatorId);
        });

        it('POST /api/saved-artisans/:artisanId alias should also save an artisan successfully', async () => {
            const res = await request(app)
                .post(`/api/saved-artisans/${artisan2Id}`)
                .set('Authorization', `Bearer ${user1Token}`);

            expect(res.status).toBe(200);
            expect(res.body.data.artisanId).toBe(artisan2Id);
        });

        it('PUT /api/saved-artisans/:artisanId should be idempotent when saving the same artisan multiple times', async () => {
            // Save again
            const res1 = await request(app)
                .put(`/api/saved-artisans/${artisan1Id}`)
                .set('Authorization', `Bearer ${user1Token}`);
            expect(res1.status).toBe(200);

            // Save third time
            const res2 = await request(app)
                .put(`/api/saved-artisans/${artisan1Id}`)
                .set('Authorization', `Bearer ${user1Token}`);
            expect(res2.status).toBe(200);

            // Verify database has exactly 1 record for this (user1, artisan1) pair
            const count = await prisma.savedArtisan.count({
                where: { userId: user1Id, artisanId: artisan1Id },
            });
            expect(count).toBe(1);
        });

        it('Concurrent saves: parallel PUT requests should resolve safely without duplicates or errors', async () => {
            const saves = await Promise.all([
                request(app).put(`/api/saved-artisans/${artisan3Id}`).set('Authorization', `Bearer ${user1Token}`),
                request(app).put(`/api/saved-artisans/${artisan3Id}`).set('Authorization', `Bearer ${user1Token}`),
                request(app).put(`/api/saved-artisans/${artisan3Id}`).set('Authorization', `Bearer ${user1Token}`),
            ]);

            for (const res of saves) {
                expect(res.status).toBe(200);
            }

            const count = await prisma.savedArtisan.count({
                where: { userId: user1Id, artisanId: artisan3Id },
            });
            expect(count).toBe(1);
        });

        it('DELETE /api/saved-artisans/:artisanId should remove an artisan from the shortlist', async () => {
            const res = await request(app)
                .delete(`/api/saved-artisans/${artisan3Id}`)
                .set('Authorization', `Bearer ${user1Token}`);

            expect(res.status).toBe(200);
            expect(res.body.data.removed).toBe(true);

            const count = await prisma.savedArtisan.count({
                where: { userId: user1Id, artisanId: artisan3Id },
            });
            expect(count).toBe(0);
        });

        it('DELETE /api/saved-artisans/:artisanId should be idempotent when deleting non-shortlisted or already deleted artisan', async () => {
            const res = await request(app)
                .delete(`/api/saved-artisans/${artisan3Id}`)
                .set('Authorization', `Bearer ${user1Token}`);

            expect(res.status).toBe(200);
            expect(res.body.data.removed).toBe(true);
        });
    });

    describe('Cross-User Authorization Isolation', () => {
        beforeAll(async () => {
            // User2 saves artisan1
            await prisma.savedArtisan.create({
                data: {
                    userId: user2Id,
                    artisanId: artisan1Id,
                },
            });
        });

        it('User cannot see another user’s saved artisans in list or count', async () => {
            // User1 has artisan1 and artisan2 saved
            const u1List = await request(app)
                .get('/api/saved-artisans')
                .set('Authorization', `Bearer ${user1Token}`);
            expect(u1List.status).toBe(200);
            expect(u1List.body.data.length).toBe(2);

            // User2 only has artisan1 saved
            const u2List = await request(app)
                .get('/api/saved-artisans')
                .set('Authorization', `Bearer ${user2Token}`);
            expect(u2List.status).toBe(200);
            expect(u2List.body.data.length).toBe(1);
            expect(u2List.body.data[0].artisanId).toBe(artisan1Id);

            // User2 count is 1, User1 count is 2
            const u1Count = await request(app)
                .get('/api/saved-artisans/count')
                .set('Authorization', `Bearer ${user1Token}`);
            expect(u1Count.body.data.count).toBe(2);

            const u2Count = await request(app)
                .get('/api/saved-artisans/count')
                .set('Authorization', `Bearer ${user2Token}`);
            expect(u2Count.body.data.count).toBe(1);
        });

        it('User1 removing an artisan does not affect User2’s shortlist for the same artisan', async () => {
            // User1 removes artisan1
            await request(app)
                .delete(`/api/saved-artisans/${artisan1Id}`)
                .set('Authorization', `Bearer ${user1Token}`);

            // User2 still has artisan1 saved
            const u2Check = await prisma.savedArtisan.findUnique({
                where: {
                    userId_artisanId: {
                        userId: user2Id,
                        artisanId: artisan1Id,
                    },
                },
            });
            expect(u2Check).not.toBeNull();

            // Re-save for User1 to continue tests
            await request(app)
                .put(`/api/saved-artisans/${artisan1Id}`)
                .set('Authorization', `Bearer ${user1Token}`);
        });
    });

    describe('Pagination and Filtering', () => {
        beforeAll(async () => {
            // User1 saves artisan3 as well (total 3 saved: artisan1, artisan2, artisan3)
            await request(app)
                .put(`/api/saved-artisans/${artisan3Id}`)
                .set('Authorization', `Bearer ${user1Token}`);
        });

        it('GET /api/saved-artisans returns paginated results with metadata', async () => {
            const res = await request(app)
                .get('/api/saved-artisans?page=1&limit=2')
                .set('Authorization', `Bearer ${user1Token}`);

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(2);
            expect(res.body.meta).toBeDefined();
            expect(res.body.meta.pagination.perPage).toBe(2);
            expect(res.body.meta.pagination.total).toBe(3);
            expect(res.body.meta.pagination.from).toBe(1);
            expect(res.body.meta.pagination.to).toBe(2);
        });

        it('GET /api/saved-artisans supports search query filter', async () => {
            const res = await request(app)
                .get('/api/saved-artisans?search=ceramic')
                .set('Authorization', `Bearer ${user1Token}`);

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].artisan.name).toContain('Artisan Two');
        });

        it('GET /api/saved-artisans supports category filter', async () => {
            const res = await request(app)
                .get(`/api/saved-artisans?categoryId=${categoryId}`)
                .set('Authorization', `Bearer ${user1Token}`);

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(3);
        });
    });

    describe('Batched Saved-ID Lookup & Search Efficiency (No N+1)', () => {
        it('GET /api/saved-artisans/ids returns all saved IDs for caller', async () => {
            const res = await request(app)
                .get('/api/saved-artisans/ids')
                .set('Authorization', `Bearer ${user1Token}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data).toContain(artisan1Id);
            expect(res.body.data).toContain(artisan2Id);
            expect(res.body.data).toContain(artisan3Id);
            expect(res.body.count).toBe(3);
        });

        it('GET /api/saved-artisans/ids?ids=... filters against a specific batch of artisan IDs', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const res = await request(app)
                .get(`/api/saved-artisans/ids?ids=${artisan1Id},${fakeId}`)
                .set('Authorization', `Bearer ${user1Token}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([artisan1Id]);
            expect(res.body.count).toBe(1);
        });

        it('GET /api/saved-artisans/:artisanId retrieves a specific saved artisan', async () => {
            const res = await request(app)
                .get(`/api/saved-artisans/${artisan1Id}`)
                .set('Authorization', `Bearer ${user1Token}`);

            expect(res.status).toBe(200);
            expect(res.body.data.artisanId).toBe(artisan1Id);
            expect(res.body.data.artisan.name).toContain('Artisan One');
        });

        it('GET /api/saved-artisans/:artisanId returns 404 for unsaved artisan', async () => {
            const unsaved = await prisma.artisan.create({
                data: {
                    name: 'Unsaved Artisan',
                    description: 'Desc',
                    phone: '999',
                    categoryId,
                    locationId,
                    curatorId,
                },
            });

            const res = await request(app)
                .get(`/api/saved-artisans/${unsaved.id}`)
                .set('Authorization', `Bearer ${user1Token}`);

            expect(res.status).toBe(404);

            await prisma.artisan.delete({ where: { id: unsaved.id } });
        });
    });

    describe('Handling Archived / Inaccessible Listings', () => {
        let tempSavedArchivedId: string;

        beforeAll(async () => {
            // Directly insert a saved record pointing to an active artisan
            const tempArtisan = await prisma.artisan.create({
                data: {
                    name: 'Soon To Be Archived',
                    description: 'Will be archived',
                    phone: '000',
                    categoryId,
                    locationId,
                    curatorId,
                    isActive: true,
                },
            });
            tempSavedArchivedId = tempArtisan.id;

            // User1 saves this artisan
            await request(app)
                .put(`/api/saved-artisans/${tempSavedArchivedId}`)
                .set('Authorization', `Bearer ${user1Token}`);

            // Now archive it
            await prisma.artisan.update({
                where: { id: tempSavedArchivedId },
                data: {
                    isActive: false,
                    archivedAt: new Date(),
                },
            });
        });

        afterAll(async () => {
            await prisma.savedArtisan.deleteMany({
                where: { artisanId: tempSavedArchivedId },
            });
            await prisma.artisan.deleteMany({
                where: { id: tempSavedArchivedId },
            });
        });

        it('Excludes archived listings from GET /api/saved-artisans without destroying the relationship', async () => {
            // The record still exists in the database
            const dbRecord = await prisma.savedArtisan.findUnique({
                where: {
                    userId_artisanId: {
                        userId: user1Id,
                        artisanId: tempSavedArchivedId,
                    },
                },
            });
            expect(dbRecord).not.toBeNull();

            // But GET /api/saved-artisans excludes it
            const res = await request(app)
                .get('/api/saved-artisans')
                .set('Authorization', `Bearer ${user1Token}`);

            expect(res.status).toBe(200);
            const returnedIds = res.body.data.map((item: any) => item.artisanId);
            expect(returnedIds).not.toContain(tempSavedArchivedId);
        });

        it('Excludes archived listings from GET /api/saved-artisans/ids and count', async () => {
            const idsRes = await request(app)
                .get('/api/saved-artisans/ids')
                .set('Authorization', `Bearer ${user1Token}`);
            expect(idsRes.body.data).not.toContain(tempSavedArchivedId);

            const countRes = await request(app)
                .get('/api/saved-artisans/count')
                .set('Authorization', `Bearer ${user1Token}`);
            // Active ones: artisan1, artisan2, artisan3 (count = 3)
            expect(countRes.body.data.count).toBe(3);
        });

        it('PUT /api/saved-artisans/:artisanId on archived or non-existent artisan returns 404', async () => {
            const res1 = await request(app)
                .put(`/api/saved-artisans/${archivedArtisanId}`)
                .set('Authorization', `Bearer ${user1Token}`);
            expect(res1.status).toBe(404);

            const res2 = await request(app)
                .put('/api/saved-artisans/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${user1Token}`);
            expect(res2.status).toBe(404);
        });

        it('Restoring an archived artisan brings it back to shortlist without re-saving', async () => {
            // Unarchive
            await prisma.artisan.update({
                where: { id: tempSavedArchivedId },
                data: {
                    isActive: true,
                    archivedAt: null,
                },
            });

            const res = await request(app)
                .get('/api/saved-artisans')
                .set('Authorization', `Bearer ${user1Token}`);

            const returnedIds = res.body.data.map((item: any) => item.artisanId);
            expect(returnedIds).toContain(tempSavedArchivedId);
        });
    });

    describe('Cascade Deletion Behavior', () => {
        it('Deleting an artisan cascades and removes associated saved records', async () => {
            const tempArtisan = await prisma.artisan.create({
                data: {
                    name: 'To Delete Cascade',
                    description: 'Desc',
                    phone: '555',
                    categoryId,
                    locationId,
                    curatorId,
                },
            });

            await request(app)
                .put(`/api/saved-artisans/${tempArtisan.id}`)
                .set('Authorization', `Bearer ${user1Token}`);

            const beforeCount = await prisma.savedArtisan.count({
                where: { artisanId: tempArtisan.id },
            });
            expect(beforeCount).toBe(1);

            // Delete artisan
            await prisma.artisan.delete({
                where: { id: tempArtisan.id },
            });

            const afterCount = await prisma.savedArtisan.count({
                where: { artisanId: tempArtisan.id },
            });
            expect(afterCount).toBe(0);
        });

        it('Deleting a user cascades and removes their saved artisan shortlist', async () => {
            const tempUser = await prisma.user.create({
                data: {
                    email: `temp-cascade-${Date.now()}@test.com`,
                    password: 'hash',
                    firstName: 'Temp',
                    lastName: 'User',
                },
            });

            await prisma.savedArtisan.create({
                data: {
                    userId: tempUser.id,
                    artisanId: artisan1Id,
                },
            });

            const beforeCount = await prisma.savedArtisan.count({
                where: { userId: tempUser.id },
            });
            expect(beforeCount).toBe(1);

            // Delete user
            await prisma.user.delete({
                where: { id: tempUser.id },
            });

            const afterCount = await prisma.savedArtisan.count({
                where: { userId: tempUser.id },
            });
            expect(afterCount).toBe(0);
        });
    });
});
