import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from 'src/db';
import { DataRetentionJob } from 'src/services/DataRetentionJob';

/**
 * Returns a Date that is `months` months in the past, minus one day —
 * so it falls clearly before any retention cutoff computed during the test.
 */
function monthsAgo(months: number): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    d.setDate(d.getDate() - 1);
    return d;
}

describe('DataRetentionJob', () => {
    let userId: string;
    let otherUserId: string;

    beforeAll(async () => {
        const runId = Date.now();

        const user = await prisma.user.create({
            data: {
                email: `retention-test-${runId}@example.com`,
                password: 'hashed',
                firstName: 'Retention',
                lastName: 'Test',
            },
        });
        userId = user.id;

        // A second user whose data must NEVER be touched
        const other = await prisma.user.create({
            data: {
                email: `retention-other-${runId}@example.com`,
                password: 'hashed',
                firstName: 'Other',
                lastName: 'User',
            },
        });
        otherUserId = other.id;
    });

    afterEach(async () => {
        // Clean up data rows created during each test
        await prisma.auditLog.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
        await prisma.review.deleteMany({ where: { authorId: { in: [userId, otherUserId] } } });
        await prisma.tip.deleteMany({ where: { senderId: { in: [userId, otherUserId] } } });
        await prisma.privacySettings.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    });

    afterAll(async () => {
        await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    });

    // -----------------------------------------------------------------------
    // enforceForUser — core unit behaviour
    // -----------------------------------------------------------------------

    it('deletes audit logs older than the retention cutoff', async () => {
        // Seed one old and one recent audit log
        await prisma.auditLog.createMany({
            data: [
                { userId, action: 'PRIVACY_CHANGE', createdAt: monthsAgo(13) },
                { userId, action: 'PRIVACY_CHANGE', createdAt: new Date() },
            ],
        });

        const beforeJob = new Date();
        const result = await DataRetentionJob.enforceForUser(userId, 12);

        expect(result.deleted.auditLogs).toBe(1);

        // Exclude the audit row written by enforceForUser's own logAuditEvent call
        const remaining = await prisma.auditLog.findMany({
            where: { userId, createdAt: { lt: beforeJob } },
        });
        expect(remaining).toHaveLength(1);
    });

    it('deletes reviews authored by the user that are past the cutoff', async () => {
        const curator = await prisma.user.create({
            data: {
                email: `curator-${Date.now()}@example.com`,
                password: 'hashed',
                firstName: 'C',
                lastName: 'U',
            },
        });

        try {
            await prisma.review.createMany({
                data: [
                    { authorId: userId, targetId: curator.id, rating: 4, createdAt: monthsAgo(7) },
                    { authorId: userId, targetId: curator.id, rating: 5, createdAt: new Date() },
                ],
            });

            const result = await DataRetentionJob.enforceForUser(userId, 6);

            expect(result.deleted.reviews).toBe(1);

            const remaining = await prisma.review.findMany({ where: { authorId: userId } });
            expect(remaining).toHaveLength(1);
        } finally {
            await prisma.review.deleteMany({ where: { authorId: userId } });
            await prisma.user.delete({ where: { id: curator.id } });
        }
    });

    it('deletes tips sent by the user that are past the cutoff', async () => {
        const receiver = await prisma.user.create({
            data: {
                email: `receiver-${Date.now()}@example.com`,
                password: 'hashed',
                firstName: 'R',
                lastName: 'V',
            },
        });

        try {
            await prisma.tip.createMany({
                data: [
                    {
                        senderId: userId,
                        receiverId: receiver.id,
                        amount: 1,
                        currency: 'ETH',
                        status: 'PENDING',
                        createdAt: monthsAgo(4),
                    },
                    {
                        senderId: userId,
                        receiverId: receiver.id,
                        amount: 2,
                        currency: 'ETH',
                        status: 'PENDING',
                        createdAt: new Date(),
                    },
                ],
            });

            const result = await DataRetentionJob.enforceForUser(userId, 3);

            expect(result.deleted.sentTips).toBe(1);

            const remaining = await prisma.tip.findMany({ where: { senderId: userId } });
            expect(remaining).toHaveLength(1);
        } finally {
            await prisma.tip.deleteMany({ where: { senderId: userId } });
            await prisma.user.delete({ where: { id: receiver.id } });
        }
    });

    it('does not delete data that is within the retention window', async () => {
        await prisma.auditLog.create({
            data: { userId, action: 'PRIVACY_CHANGE', createdAt: new Date() },
        });

        const result = await DataRetentionJob.enforceForUser(userId, 12);

        expect(result.deleted.auditLogs).toBe(0);
        expect(result.deleted.reviews).toBe(0);
        expect(result.deleted.sentTips).toBe(0);
    });

    it('does not touch data belonging to other users', async () => {
        await prisma.auditLog.create({
            data: { userId: otherUserId, action: 'PRIVACY_CHANGE', createdAt: monthsAgo(24) },
        });

        // Enforce only for userId (not otherUserId)
        await DataRetentionJob.enforceForUser(userId, 1);

        const otherLogs = await prisma.auditLog.findMany({ where: { userId: otherUserId } });
        expect(otherLogs).toHaveLength(1);
    });

    it('returns the correct cutoff date in the result', async () => {
        const before = new Date();
        const result = await DataRetentionJob.enforceForUser(userId, 6);
        const after = new Date();

        // The cutoff should be roughly 6 months ago
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Use calendar-month arithmetic to match what enforceForUser does internally
        const expectedLow = new Date(before);
        expectedLow.setMonth(expectedLow.getMonth() - 6);
        expectedLow.setSeconds(expectedLow.getSeconds() - 2); // 2s tolerance
        const expectedHigh = new Date(after);
        expectedHigh.setMonth(expectedHigh.getMonth() - 6);
        expectedHigh.setSeconds(expectedHigh.getSeconds() + 2);

        expect(result.cutoff.getTime()).toBeGreaterThanOrEqual(expectedLow.getTime());
        expect(result.cutoff.getTime()).toBeLessThanOrEqual(expectedHigh.getTime());
    });

    // -----------------------------------------------------------------------
    // run() — batch sweep honours each user's individual policy
    // -----------------------------------------------------------------------

    it('run() sweeps old data for all users with privacy settings', async () => {
        // Give both users a 1-month retention policy
        await prisma.privacySettings.createMany({
            data: [
                { userId, dataRetentionMonths: 1 },
                { userId: otherUserId, dataRetentionMonths: 1 },
            ],
        });

        // Seed old audit logs for both
        await prisma.auditLog.createMany({
            data: [
                { userId, action: 'PRIVACY_CHANGE', createdAt: monthsAgo(3) },
                { userId: otherUserId, action: 'PRIVACY_CHANGE', createdAt: monthsAgo(3) },
            ],
        });

        const beforeSweep = new Date();
        const summary = await DataRetentionJob.run();

        // At least our two users must have been processed
        expect(summary.usersProcessed).toBeGreaterThanOrEqual(2);

        // Errors from unrelated CI users (orphaned PrivacySettings rows, etc.) are
        // acceptable — we only care that OUR two users were not among the errors.
        const ourErrors = summary.errors.filter(
            (e) => e.userId === userId || e.userId === otherUserId,
        );
        expect(ourErrors).toHaveLength(0);

        // Seeded rows (before the sweep) must be gone
        const remainingUser = await prisma.auditLog.findMany({
            where: { userId, createdAt: { lt: beforeSweep } },
        });
        const remainingOther = await prisma.auditLog.findMany({
            where: { userId: otherUserId, createdAt: { lt: beforeSweep } },
        });
        expect(remainingUser).toHaveLength(0);
        expect(remainingOther).toHaveLength(0);
    });
});