import fs from 'node:fs/promises';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as mailer from 'src/mailer/mailer';
import { prisma } from 'src/db';
import { dataExportQueue } from 'src/services/DataExportQueue';
import { DataExportService, dataExportService } from 'src/services/DataExportService';

const waitForTerminalExportStatus = async (requestId: string, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const request = await prisma.dataExportRequest.findUnique({
            where: { id: requestId },
        });

        if (request && (request.status === 'ready' || request.status === 'failed')) {
            return request;
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error(`Timed out waiting for export request ${requestId} to finish`);
};

describe('Data export processing', () => {
    let testUserId: string;
    let testEmail: string;

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
        testEmail = user.email;
    });

    afterEach(async () => {
        const requests = await prisma.dataExportRequest.findMany({
            where: { userId: testUserId },
        });

        await Promise.all(
            requests.map(async (request) => {
                const filePath = DataExportService.getExportFilePath(request.id, request.format);
                await fs.unlink(filePath).catch(() => undefined);
            }),
        );

        await prisma.dataExportRequest.deleteMany({
            where: { userId: testUserId },
        });

        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.user.delete({ where: { id: testUserId } }).catch(() => undefined);
    });

    it('processes export requests asynchronously and stores a download url', async () => {
        const sendMailSpy = vi.spyOn(mailer, 'sendMail').mockResolvedValue(null);

        const request = await prisma.dataExportRequest.create({
            data: {
                userId: testUserId,
                format: 'json',
                status: 'pending',
            },
        });

        dataExportQueue.enqueue(request.id);

        const ready = await waitForTerminalExportStatus(request.id);
        const fileContents = await fs.readFile(
            DataExportService.getExportFilePath(request.id, request.format),
            'utf8',
        );

        expect(ready.status).toBe('ready');
        expect(ready.downloadUrl).toContain(`/api/data-export/${request.id}/download`);
        expect(ready.fileSize).toBeGreaterThan(0);
        expect(ready.expiresAt).not.toBeNull();
        expect(fileContents).toContain(testEmail);
        expect(sendMailSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                to: testEmail,
                subject: expect.stringContaining('ready'),
            }),
        );
    });

    it('marks export requests as failed when generation throws', async () => {
        vi.spyOn(mailer, 'sendMail').mockResolvedValue(null);
        const buildPayloadSpy = vi
            .spyOn(dataExportService, 'buildExportPayload')
            .mockRejectedValueOnce(new Error('Simulated export failure'));

        const request = await prisma.dataExportRequest.create({
            data: {
                userId: testUserId,
                format: 'json',
                status: 'pending',
            },
        });

        dataExportQueue.enqueue(request.id);

        const failed = await waitForTerminalExportStatus(request.id);

        expect(buildPayloadSpy).toHaveBeenCalled();
        expect(failed.status).toBe('failed');
        expect(failed.errorMessage).toContain('Simulated export failure');
    });

    it('retries a failed export request and processes it to ready', async () => {
        vi.spyOn(mailer, 'sendMail').mockResolvedValue(null);

        // Create a request already in failed state
        const request = await prisma.dataExportRequest.create({
            data: {
                userId: testUserId,
                format: 'json',
                status: 'failed',
                errorMessage: 'Previous failure',
            },
        });

        // Reset to pending (simulating the retry endpoint) and re-enqueue
        await prisma.dataExportRequest.update({
            where: { id: request.id },
            data: { status: 'pending', errorMessage: null },
        });

        dataExportQueue.enqueue(request.id);

        const ready = await waitForTerminalExportStatus(request.id);

        expect(ready.status).toBe('ready');
        expect(ready.errorMessage).toBeNull();
        expect(ready.downloadUrl).toContain(`/api/data-export/${request.id}/download`);
    });

    it('purges expired export files and marks requests as expired', async () => {
        vi.spyOn(mailer, 'sendMail').mockResolvedValue(null);

        // Create a request that is ready but whose TTL has already elapsed
        const pastExpiry = new Date(Date.now() - 1000);
        const request = await prisma.dataExportRequest.create({
            data: {
                userId: testUserId,
                format: 'json',
                status: 'ready',
                expiresAt: pastExpiry,
            },
        });

        // Write a dummy file so purge has something to delete
        const filePath = DataExportService.getExportFilePath(request.id, request.format);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, '{}', 'utf8');

        const purged = await dataExportService.purgeExpiredExports();

        expect(purged).toBeGreaterThanOrEqual(1);

        const updated = await prisma.dataExportRequest.findUnique({ where: { id: request.id } });
        expect(updated?.status).toBe('expired');

        // File should be gone
        await expect(fs.access(filePath)).rejects.toThrow();
    });
});