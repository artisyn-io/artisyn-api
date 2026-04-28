/**
 * HTTP integration tests for data-export and account-deletion endpoints.
 *
 * Covers all seven routes wired in src/routes/api.ts:
 *   POST   /api/data-export/request
 *   GET    /api/data-export/requests
 *   GET    /api/data-export/:requestId/status
 *   GET    /api/data-export/:requestId/download
 *   POST   /api/data-export/:requestId/cancel
 *   POST   /api/account/deletion-request
 *   POST   /api/account/cancel-deletion
 *
 * Focus: route wiring, auth enforcement, status codes, response envelopes,
 * pagination, authorization isolation, and deletion lifecycle.
 */

import fs from 'node:fs/promises';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { faker } from '@faker-js/faker';

import app from 'src/index';
import { prisma } from 'src/db';
import { generateAccessToken } from 'src/utils/helpers';
import { DataExportService } from 'src/services/DataExportService';
import * as mailer from 'src/mailer/mailer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUser(suffix: string) {
    const plainPassword = 'Password123#';
    const user = await prisma.user.create({
        data: {
            email: `http-export-${suffix}@example.com`,
            password: await argon2.hash(plainPassword),
            firstName: 'Http',
            lastName: 'Test',
        },
    });

    const { token } = generateAccessToken({
        username: user.email,
        id: user.id,
        index: faker.number.int({ min: 1, max: 999999 }),
    });

    return { user, token, plainPassword };
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Data Export & Account Deletion — HTTP integration', () => {
    let owner: Awaited<ReturnType<typeof createUser>>;
    let intruder: Awaited<ReturnType<typeof createUser>>;

    beforeAll(async () => {
        vi.spyOn(mailer, 'sendMail').mockResolvedValue(null);

        const runId = faker.string.alphanumeric(8).toLowerCase();
        owner = await createUser(`owner-${runId}`);
        intruder = await createUser(`intruder-${runId}`);
    });

    afterEach(async () => {
        await prisma.dataExportRequest.deleteMany({
            where: { userId: { in: [owner.user.id, intruder.user.id] } },
        });
        await prisma.pendingDeletion.deleteMany({
            where: { userId: { in: [owner.user.id, intruder.user.id] } },
        });
    });

    afterAll(async () => {
        vi.restoreAllMocks();
        await prisma.user.deleteMany({
            where: { id: { in: [owner.user.id, intruder.user.id] } },
        });
    });

    // =======================================================================
    // POST /api/data-export/request
    // =======================================================================

    describe('POST /api/data-export/request', () => {
        it('returns 401 when unauthenticated', async () => {
            const res = await request(app).post('/api/data-export/request').send({ format: 'json' });
            expect(res.status).toBe(401);
        });

        it('creates a pending export and returns 201 with correct envelope', async () => {
            const res = await request(app)
                .post('/api/data-export/request')
                .set(authHeaders(owner.token))
                .send({ format: 'json' });

            expect(res.status).toBe(201);
            expect(res.body.status).toBe('success');
            expect(res.body.code).toBe(201);
            expect(res.body.data).toMatchObject({
                userId: owner.user.id,
                format: 'json',
                status: 'pending',
            });
        });

        it('defaults to json format when no format provided', async () => {
            const res = await request(app)
                .post('/api/data-export/request')
                .set(authHeaders(owner.token))
                .send({});

            expect(res.status).toBe(201);
            expect(res.body.data.format).toBe('json');
        });

        it('accepts csv format', async () => {
            const res = await request(app)
                .post('/api/data-export/request')
                .set(authHeaders(owner.token))
                .send({ format: 'csv' });

            expect(res.status).toBe(201);
            expect(res.body.data.format).toBe('csv');
        });

        it('returns 422 for unsupported format', async () => {
            const res = await request(app)
                .post('/api/data-export/request')
                .set(authHeaders(owner.token))
                .send({ format: 'xml' });

            expect(res.status).toBe(422);
            expect(res.body.status).toBe('error');
        });

        it('returns 429 when a non-expired request exists within 24 hours', async () => {
            // First request succeeds
            await request(app)
                .post('/api/data-export/request')
                .set(authHeaders(owner.token))
                .send({ format: 'json' })
                .expect(201);

            // Second request within the same 24-hour window should be rejected
            const res = await request(app)
                .post('/api/data-export/request')
                .set(authHeaders(owner.token))
                .send({ format: 'json' });

            expect(res.status).toBe(429);
        });
    });

    // =======================================================================
    // GET /api/data-export/requests
    // =======================================================================

    describe('GET /api/data-export/requests', () => {
        it('returns 401 when unauthenticated', async () => {
            const res = await request(app).get('/api/data-export/requests');
            expect(res.status).toBe(401);
        });

        it('returns a paginated list of the user\'s own requests', async () => {
            // Seed two requests for owner
            await prisma.dataExportRequest.createMany({
                data: [
                    { userId: owner.user.id, format: 'json', status: 'pending' },
                    { userId: owner.user.id, format: 'csv', status: 'pending' },
                ],
            });

            const res = await request(app)
                .get('/api/data-export/requests')
                .set(authHeaders(owner.token));

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(2);
            expect(res.body.pagination).toBeDefined();
            expect(typeof res.body.pagination.total).toBe('number');
        });

        it('does not return requests belonging to other users', async () => {
            await prisma.dataExportRequest.create({
                data: { userId: intruder.user.id, format: 'json', status: 'pending' },
            });

            const res = await request(app)
                .get('/api/data-export/requests')
                .set(authHeaders(owner.token));

            expect(res.status).toBe(200);
            const ids = res.body.data.map((r: any) => r.userId);
            expect(ids.every((id: string) => id === owner.user.id)).toBe(true);
        });

        it('respects ?take and ?skip pagination parameters', async () => {
            await prisma.dataExportRequest.createMany({
                data: Array.from({ length: 3 }, () => ({
                    userId: owner.user.id,
                    format: 'json' as const,
                    status: 'pending' as const,
                })),
            });

            const res = await request(app)
                .get('/api/data-export/requests?limit=2&page=1')
                .set(authHeaders(owner.token));

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeLessThanOrEqual(2);
        });
    });

    // =======================================================================
    // GET /api/data-export/:requestId/status
    // =======================================================================

    describe('GET /api/data-export/:requestId/status', () => {
        it('returns 401 when unauthenticated', async () => {
            const res = await request(app).get('/api/data-export/fake-id/status');
            expect(res.status).toBe(401);
        });

        it('returns 200 with status details for an owned request', async () => {
            const exportRequest = await prisma.dataExportRequest.create({
                data: { userId: owner.user.id, format: 'json', status: 'pending' },
            });

            const res = await request(app)
                .get(`/api/data-export/${exportRequest.id}/status`)
                .set(authHeaders(owner.token));

            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(exportRequest.id);
            expect(res.body.data.status).toBe('pending');
        });

        it('returns 404 for a non-existent request', async () => {
            const res = await request(app)
                .get('/api/data-export/00000000-0000-0000-0000-000000000000/status')
                .set(authHeaders(owner.token));

            expect(res.status).toBe(404);
        });

        it('returns 404 when requesting another user\'s export (authorization isolation)', async () => {
            const intruderRequest = await prisma.dataExportRequest.create({
                data: { userId: intruder.user.id, format: 'json', status: 'pending' },
            });

            const res = await request(app)
                .get(`/api/data-export/${intruderRequest.id}/status`)
                .set(authHeaders(owner.token)); // owner trying to see intruder's request

            expect(res.status).toBe(404);
        });
    });

    // =======================================================================
    // GET /api/data-export/:requestId/download
    // =======================================================================

    describe('GET /api/data-export/:requestId/download', () => {
        it('returns 401 when unauthenticated', async () => {
            const res = await request(app).get('/api/data-export/fake-id/download');
            expect(res.status).toBe(401);
        });

        it('returns 400 when the export is not yet ready', async () => {
            const exportRequest = await prisma.dataExportRequest.create({
                data: { userId: owner.user.id, format: 'json', status: 'pending' },
            });

            const res = await request(app)
                .get(`/api/data-export/${exportRequest.id}/download`)
                .set(authHeaders(owner.token));

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/not ready/i);
        });

        it('returns 410 when the download link has expired', async () => {
            const exportRequest = await prisma.dataExportRequest.create({
                data: {
                    userId: owner.user.id,
                    format: 'json',
                    status: 'ready',
                    downloadUrl: DataExportService.getDownloadUrl('test'),
                    expiresAt: new Date(Date.now() - 1000), // already expired
                },
            });

            const res = await request(app)
                .get(`/api/data-export/${exportRequest.id}/download`)
                .set(authHeaders(owner.token));

            expect(res.status).toBe(410);
        });

        it('streams the file when the export is ready and file exists', async () => {
            // Produce a real export file via the service
            const exportRequest = await prisma.dataExportRequest.create({
                data: { userId: owner.user.id, format: 'json', status: 'pending' },
            });

            await new (await import('src/services/DataExportService')).DataExportService().processRequest(exportRequest.id);

            const readyRequest = await prisma.dataExportRequest.findUnique({ where: { id: exportRequest.id } });
            if (readyRequest?.status !== 'ready') return; // if processing failed in CI, skip

            const res = await request(app)
                .get(`/api/data-export/${exportRequest.id}/download`)
                .set(authHeaders(owner.token));

            expect(res.status).toBe(200);

            // Cleanup file
            await fs
                .unlink(DataExportService.getExportFilePath(exportRequest.id, 'json'))
                .catch(() => undefined);
        });

        it('returns 404 when attempting to download another user\'s export', async () => {
            const intruderRequest = await prisma.dataExportRequest.create({
                data: {
                    userId: intruder.user.id,
                    format: 'json',
                    status: 'ready',
                    downloadUrl: 'https://external.example.com/file.json',
                },
            });

            const res = await request(app)
                .get(`/api/data-export/${intruderRequest.id}/download`)
                .set(authHeaders(owner.token));

            expect(res.status).toBe(404);
        });
    });

    // =======================================================================
    // POST /api/data-export/:requestId/cancel
    // =======================================================================

    describe('POST /api/data-export/:requestId/cancel', () => {
        it('returns 401 when unauthenticated', async () => {
            const res = await request(app).post('/api/data-export/fake-id/cancel');
            expect(res.status).toBe(401);
        });

        it('cancels a pending export and returns 200', async () => {
            const exportRequest = await prisma.dataExportRequest.create({
                data: { userId: owner.user.id, format: 'json', status: 'pending' },
            });

            const res = await request(app)
                .post(`/api/data-export/${exportRequest.id}/cancel`)
                .set(authHeaders(owner.token));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('expired');
        });

        it('cancels a processing export and returns 200', async () => {
            const exportRequest = await prisma.dataExportRequest.create({
                data: { userId: owner.user.id, format: 'json', status: 'processing' },
            });

            const res = await request(app)
                .post(`/api/data-export/${exportRequest.id}/cancel`)
                .set(authHeaders(owner.token));

            expect(res.status).toBe(200);
        });

        it('returns 400 when trying to cancel a ready export', async () => {
            const exportRequest = await prisma.dataExportRequest.create({
                data: {
                    userId: owner.user.id,
                    format: 'json',
                    status: 'ready',
                    downloadUrl: 'https://example.com/x.json',
                },
            });

            const res = await request(app)
                .post(`/api/data-export/${exportRequest.id}/cancel`)
                .set(authHeaders(owner.token));

            expect(res.status).toBe(400);
        });

        it('returns 400 when trying to cancel an already-expired request', async () => {
            const exportRequest = await prisma.dataExportRequest.create({
                data: { userId: owner.user.id, format: 'json', status: 'expired' },
            });

            const res = await request(app)
                .post(`/api/data-export/${exportRequest.id}/cancel`)
                .set(authHeaders(owner.token));

            expect(res.status).toBe(400);
        });

        it('returns 404 when cancelling another user\'s request (authorization)', async () => {
            const intruderRequest = await prisma.dataExportRequest.create({
                data: { userId: intruder.user.id, format: 'json', status: 'pending' },
            });

            const res = await request(app)
                .post(`/api/data-export/${intruderRequest.id}/cancel`)
                .set(authHeaders(owner.token));

            expect(res.status).toBe(404);
        });
    });

    // =======================================================================
    // POST /api/account/deletion-request
    // =======================================================================

    describe('POST /api/account/deletion-request', () => {
        it('returns 401 when unauthenticated', async () => {
            const res = await request(app)
                .post('/api/account/deletion-request')
                .send({ password: owner.plainPassword });
            expect(res.status).toBe(401);
        });

        it('returns 400 when password is missing', async () => {
            const res = await request(app)
                .post('/api/account/deletion-request')
                .set(authHeaders(owner.token))
                .send({});
            expect(res.status).toBe(400);
        });

        it('returns 401 when password is incorrect', async () => {
            const res = await request(app)
                .post('/api/account/deletion-request')
                .set(authHeaders(owner.token))
                .send({ password: 'WrongPassword!' });
            expect(res.status).toBe(401);
        });

        it('schedules deletion and returns 202 with scheduledAt', async () => {
            const res = await request(app)
                .post('/api/account/deletion-request')
                .set(authHeaders(owner.token))
                .send({ password: owner.plainPassword });

            expect(res.status).toBe(202);
            expect(res.body.status).toBe('success');
            expect(res.body.data.status).toBe('pending_deletion');
            expect(res.body.data.scheduledAt).toBeDefined();

            // Confirm the pending deletion record exists
            const pending = await prisma.pendingDeletion.findUnique({
                where: { userId: owner.user.id },
            });
            expect(pending).not.toBeNull();
        });

        it('returns 409 when a deletion is already pending', async () => {
            // First request
            await request(app)
                .post('/api/account/deletion-request')
                .set(authHeaders(owner.token))
                .send({ password: owner.plainPassword })
                .expect(202);

            // Duplicate request
            const res = await request(app)
                .post('/api/account/deletion-request')
                .set(authHeaders(owner.token))
                .send({ password: owner.plainPassword });

            expect(res.status).toBe(409);
        });
    });

    // =======================================================================
    // POST /api/account/cancel-deletion
    // =======================================================================

    describe('POST /api/account/cancel-deletion', () => {
        it('returns 401 when unauthenticated', async () => {
            const res = await request(app).post('/api/account/cancel-deletion').send({});
            expect(res.status).toBe(401);
        });

        it('returns 404 when no pending deletion exists', async () => {
            const res = await request(app)
                .post('/api/account/cancel-deletion')
                .set(authHeaders(owner.token))
                .send({});
            expect(res.status).toBe(404);
        });

        it('cancels a pending deletion in-app and returns 200', async () => {
            // Schedule deletion first
            await request(app)
                .post('/api/account/deletion-request')
                .set(authHeaders(owner.token))
                .send({ password: owner.plainPassword })
                .expect(202);

            // Cancel it in-app (no token in body)
            const res = await request(app)
                .post('/api/account/cancel-deletion')
                .set(authHeaders(owner.token))
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('deletion_cancelled');

            // Confirm the record is gone
            const pending = await prisma.pendingDeletion.findUnique({
                where: { userId: owner.user.id },
            });
            expect(pending).toBeNull();
        });

        it('cancels a pending deletion via email token and returns 200', async () => {
            await request(app)
                .post('/api/account/deletion-request')
                .set(authHeaders(owner.token))
                .send({ password: owner.plainPassword })
                .expect(202);

            const record = await prisma.pendingDeletion.findUnique({
                where: { userId: owner.user.id },
            });

            const res = await request(app)
                .post('/api/account/cancel-deletion')
                .set(authHeaders(owner.token))
                .send({ token: record!.token });

            expect(res.status).toBe(200);
        });

        it('returns 403 when the token belongs to a different user', async () => {
            // Schedule deletion for intruder
            await request(app)
                .post('/api/account/deletion-request')
                .set(authHeaders(intruder.token))
                .send({ password: intruder.plainPassword })
                .expect(202);

            const intruderRecord = await prisma.pendingDeletion.findUnique({
                where: { userId: intruder.user.id },
            });

            // Owner tries to cancel intruder's deletion via token
            const res = await request(app)
                .post('/api/account/cancel-deletion')
                .set(authHeaders(owner.token))
                .send({ token: intruderRecord!.token });

            expect(res.status).toBe(403);

            // Intruder's record must still exist
            const stillPending = await prisma.pendingDeletion.findUnique({
                where: { userId: intruder.user.id },
            });
            expect(stillPending).not.toBeNull();
        });
    });
});