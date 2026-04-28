import { prisma } from 'src/db';
import { logAuditEvent } from 'src/utils/auditLogger';

/**
 * DeletionPurgeJob — executes pending account deletions whose grace period has elapsed.
 *
 * Called by the nightly deletion-purge scheduler.  The job is idempotent:
 * if a user record has already been removed (e.g. manual admin action) the
 * corresponding stale pendingDeletion row is cleaned up without error.
 *
 * Cascade behaviour (from schema.prisma):
 *   - pendingDeletion.onDelete = Cascade  → removed with the User row
 *   - auditLog.onDelete = SetNull         → audit trail is preserved (userId → NULL)
 */
export class DeletionPurgeJob {
    /**
     * Run the purge sweep for all accounts whose scheduledAt has passed.
     * Call this from a nightly cron/scheduler.
     */
    static async run(): Promise<PurgeRunSummary> {
        const summary: PurgeRunSummary = { purged: 0, skipped: 0, errors: [] };

        const due = await prisma.pendingDeletion.findMany({
            where: { scheduledAt: { lte: new Date() } },
            select: { userId: true },
        });

        for (const { userId } of due) {
            try {
                const deleted = await this.purgeUser(userId);
                if (deleted) {
                    summary.purged++;
                } else {
                    summary.skipped++;
                }
            } catch (error) {
                summary.errors.push({
                    userId,
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return summary;
    }

    /**
     * Purge a single user account.
     *
     * Returns true if the user was deleted, false if the user was already gone
     * (stale record cleaned up instead).  Exported so tests and admin tooling
     * can trigger an immediate per-user purge.
     */
    static async purgeUser(userId: string): Promise<boolean> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        if (!user) {
            // User already removed — clean up the orphaned pendingDeletion row.
            await prisma.pendingDeletion.deleteMany({ where: { userId } });
            return false;
        }

        // Write audit record before deletion — the AuditLog relation uses
        // onDelete: SetNull so this row survives the cascade as a compliance trail.
        await logAuditEvent(userId, 'DATA_DELETE', {
            entityType: 'User',
            entityId: userId,
            statusCode: 200,
            metadata: { action: 'purge_account' },
        });

        // Deleting the User row cascades to pendingDeletion (and all other
        // Cascade-linked relations) automatically.
        await prisma.user.delete({ where: { id: userId } });

        return true;
    }
}

export interface PurgeRunSummary {
    purged: number;
    skipped: number;
    errors: Array<{ userId: string; message: string }>;
}
