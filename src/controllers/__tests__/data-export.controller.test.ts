import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from 'src/db';

describe('DataExportController', () => {
    let testUserId: string;

    beforeAll(async () => {
        const user = await prisma.user.create({
            data: {
                email: `test-export-${Date.now()}@example.com`,
                password: 'hashed_password',
                firstName: 'Test',
                lastName: 'User',
            },
        });
        testUserId = user.id;
    });

    afterEach(async () => {
        await prisma.dataExportRequest.deleteMany({
            where: { userId: testUserId },
        });
    });

    it('should create data export request', async () => {
        const request = await prisma.dataExportRequest.create({
            data: {
                userId: testUserId,
                format: 'json',
                status: 'pending',
            },
        });

        expect(request.userId).toBe(testUserId);
        expect(request.format).toBe('json');
        expect(request.status).toBe('pending');
    });

    it('should support json and csv formats', async () => {
        const jsonRequest = await prisma.dataExportRequest.create({
            data: {
                userId: testUserId,
                format: 'json',
            },
        });

        const csvRequest = await prisma.dataExportRequest.create({
            data: {
                userId: testUserId,
                format: 'csv',
            },
        });

        expect(jsonRequest.format).toBe('json');
        expect(csvRequest.format).toBe('csv');

        await prisma.dataExportRequest.delete({ where: { id: csvRequest.id } });
    });

    it('should track export request status', async () => {
        const request = await prisma.dataExportRequest.create({
            data: {
                userId: testUserId,
                status: 'pending',
            },
        });

        const processing = await prisma.dataExportRequest.update({
            where: { id: request.id },
            data: { status: 'processing' },
        });

        expect(processing.status).toBe('processing');

        const ready = await prisma.dataExportRequest.update({
            where: { id: request.id },
            data: { status: 'ready' },
        });

        expect(ready.status).toBe('ready');
    });

    it('should set expiration date for downloads', async () => {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const request = await prisma.dataExportRequest.create({
            data: {
                userId: testUserId,
                status: 'ready',
                expiresAt,
                fileSize: 1024000,
                downloadUrl: 'https://example.com/download/export-123.json',
            },
        });

        expect(request.expiresAt).toBeDefined();
        expect(request.expiresAt!.getTime()).toBeGreaterThan(Date.now());
        expect(request.fileSize).toBe(1024000);
    });

    it('should store error messages for failed exports', async () => {
        const request = await prisma.dataExportRequest.create({
            data: {
                userId: testUserId,
                status: 'failed',
                errorMessage: 'Database connection timeout',
            },
        });

        expect(request.status).toBe('failed');
        expect(request.errorMessage).toBe('Database connection timeout');
    });

    it('should track multiple export requests per user', async () => {
        const req1 = await prisma.dataExportRequest.create({
            data: { userId: testUserId, format: 'json', status: 'ready' },
        });

        const req2 = await prisma.dataExportRequest.create({
            data: { userId: testUserId, format: 'csv', status: 'pending' },
        });

        const userRequests = await prisma.dataExportRequest.findMany({
            where: { userId: testUserId },
        });

        expect(userRequests.length).toBeGreaterThanOrEqual(2);

        await prisma.dataExportRequest.delete({ where: { id: req2.id } });
    });

    it('should allow status progression for exports', async () => {
        const request = await prisma.dataExportRequest.create({
            data: {
                userId: testUserId,
                status: 'pending',
            },
        });

        const statuses = ['pending', 'processing', 'ready', 'expired'] as const;

        for (const status of statuses) {
            const updated = await prisma.dataExportRequest.update({
                where: { id: request.id },
                data: { status },
            });
            expect(updated.status).toBe(status);
        }
    });

    it('should record creation timestamp', async () => {
        const before = new Date();

        const request = await prisma.dataExportRequest.create({
            data: { userId: testUserId },
        });

        const after = new Date();

        expect(request.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(request.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
});
