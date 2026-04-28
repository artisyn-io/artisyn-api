import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from 'src/db';
import { DeletionPurgeJob } from 'src/services/DeletionPurgeJob';

function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function createUser(tag: string) {
    const runId = Date.now();
    return prisma.user.create({
        data: {
            email: `purge-${tag}-${runId}@example.com`,
            password: 'hashed',
            firstName: 'Purge',
            lastName: tag,
        },
    });
}

describe('DeletionPurgeJob', () => {
    // Users that must survive all tests — cleaned up in afterAll
    let spectatorId: string;

    beforeAll(async () => {
        const spectator = await createUser('spectator');
        spectatorId = spectator.id;
    });

    afterEach(async () => {
        // Remove any pendingDeletion rows left over from failed tests so the
        // next test starts clean.  User rows created per-test are cleaned up
        // inside each test's own try/finally block.
        await prisma.pendingDeletion.deleteMany({
            where: { scheduledAt: { lte: daysFromNow(1) } },
        });
    });

    afterAll(async () => {
        await prisma.user.deleteMany({ where: { id: spectatorId } });
    });

    // -----------------------------------------------------------------------
    // purgeUser — per-user behaviour
    // -----------------------------------------------------------------------

    it('purgeUser() deletes a user and returns true', async () => {
        const user = await createUser('to-delete');

        await prisma.pendingDeletion.create({
            data: { userId: user.id, scheduledAt: daysAgo(1) },
        });

        const deleted = await DeletionPurgeJob.purgeUser(user.id);

        expect(deleted).toBe(true);
        const found = await prisma.user.findUnique({ where: { id: user.id } });
        expect(found).toBeNull();
    });

    it('purgeUser() is idempotent when the user no longer exists', async () => {
        const user = await createUser('already-gone');
        const userId = user.id;

        // Create a pendingDeletion row then manually delete the user to simulate
        // a race / prior manual deletion.
        await prisma.pendingDeletion.create({
            data: { userId, scheduledAt: daysAgo(1) },
        });
        await prisma.user.delete({ where: { id: userId } });

        // At this point the pendingDeletion row may or may not have been
        // cascade-deleted; either way purgeUser should not throw.
        const deleted = await DeletionPurgeJob.purgeUser(userId);

        expect(deleted).toBe(false);
    });

    it('purgeUser() writes an audit record before deleting the user', async () => {
        const user = await createUser('audited');

        await prisma.pendingDeletion.create({
            data: { userId: user.id, scheduledAt: daysAgo(1) },
        });

        const before = new Date();
        await DeletionPurgeJob.purgeUser(user.id);
        const after = new Date();

        // AuditLog uses onDelete: SetNull, so the row survives user deletion.
        const logs = await prisma.auditLog.findMany({
            where: {
                entityId: user.id,
                action: 'DATA_DELETE',
                createdAt: { gte: before, lte: after },
            },
        });

        expect(logs.length).toBeGreaterThanOrEqual(1);

        // Cleanup orphaned audit rows
        await prisma.auditLog.deleteMany({ where: { entityId: user.id } });
    });

    // -----------------------------------------------------------------------
    // run() — batch sweep
    // -----------------------------------------------------------------------

    it('run() purges due deletions and leaves future ones untouched', async () => {
        const dueUser = await createUser('due');
        const futureUser = await createUser('future');

        await prisma.pendingDeletion.createMany({
            data: [
                { userId: dueUser.id, scheduledAt: daysAgo(1) },
                { userId: futureUser.id, scheduledAt: daysFromNow(30) },
            ],
        });

        try {
            const summary = await DeletionPurgeJob.run();

            // dueUser must be gone
            const dueFound = await prisma.user.findUnique({ where: { id: dueUser.id } });
            expect(dueFound).toBeNull();

            // futureUser must still exist
            const futureFound = await prisma.user.findUnique({ where: { id: futureUser.id } });
            expect(futureFound).not.toBeNull();

            expect(summary.purged).toBeGreaterThanOrEqual(1);
            const ourErrors = summary.errors.filter(
                (e) => e.userId === dueUser.id || e.userId === futureUser.id,
            );
            expect(ourErrors).toHaveLength(0);
        } finally {
            await prisma.pendingDeletion.deleteMany({ where: { userId: futureUser.id } });
            await prisma.user.deleteMany({ where: { id: futureUser.id } });
            // dueUser was already deleted by the job
        }
    });

    it('run() counts a stale record (user pre-deleted) as skipped, not an error', async () => {
        const user = await createUser('stale');
        const userId = user.id;

        await prisma.pendingDeletion.create({
            data: { userId, scheduledAt: daysAgo(1) },
        });

        // Simulate prior manual deletion — cascade may already remove pendingDeletion;
        // if not, we want run() to handle the stale row gracefully.
        try {
            await prisma.user.delete({ where: { id: userId } });
        } catch {
            // Already gone — fine
        }

        const summary = await DeletionPurgeJob.run();

        const ourErrors = summary.errors.filter((e) => e.userId === userId);
        expect(ourErrors).toHaveLength(0);
    });

    it('run() does not touch users without a due pendingDeletion', async () => {
        // spectatorId has no pendingDeletion row at all
        const summary = await DeletionPurgeJob.run();

        const spectator = await prisma.user.findUnique({ where: { id: spectatorId } });
        expect(spectator).not.toBeNull();

        const ourErrors = summary.errors.filter((e) => e.userId === spectatorId);
        expect(ourErrors).toHaveLength(0);
    });
});
