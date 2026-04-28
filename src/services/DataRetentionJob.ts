import { prisma } from 'src/db';
import { logAuditEvent } from 'src/utils/auditLogger';

/**
 * DataRetentionJob — enforces per-user dataRetentionMonths privacy settings.
 *
 * Covered data domains (matching what DataExportService exports):
 *   • auditLogs    — operational log trail
 *   • reviews      — reviews written by the user
 *   • sentTips     — tips sent by the user
 *
 * The job is intentionally non-destructive for the User record itself;
 * use the GDPR deletion flow (pendingDeletion / DeletionPurgeJob) for
 * full account erasure.
 */
export class DataRetentionJob {
    /**
     * Run retention enforcement for all users that have a custom policy.
     * Call this from a nightly cron/scheduler.
     */
    static async run(): Promise<RetentionRunSummary> {
        const summary: RetentionRunSummary = { usersProcessed: 0, errors: [] };

        // Only fetch users who have explicitly configured a retention policy.
        // Users without a PrivacySettings row (or with the default 24-month value)
        // are skipped — they can be handled by a separate system-wide sweep if needed.
        const settings = await prisma.privacySettings.findMany({
            select: { userId: true, dataRetentionMonths: true },
        });

        for (const { userId, dataRetentionMonths } of settings) {
            try {
                await this.enforceForUser(userId, dataRetentionMonths);
                summary.usersProcessed++;
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
     * Apply the retention policy for a single user.
     * Exported so it can be called directly in tests and from controllers
     * that want to trigger an immediate sweep (e.g. after a policy update).
     */
    static async enforceForUser(
        userId: string,
        dataRetentionMonths: number,
    ): Promise<UserRetentionResult> {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - dataRetentionMonths);

        const [deletedAuditLogs, deletedReviews, deletedSentTips] = await Promise.all([
            prisma.auditLog.deleteMany({
                where: { userId, createdAt: { lt: cutoff } },
            }),
            prisma.review.deleteMany({
                where: { authorId: userId, createdAt: { lt: cutoff } },
            }),
            prisma.tip.deleteMany({
                where: { senderId: userId, createdAt: { lt: cutoff } },
            }),
        ]);

        const result: UserRetentionResult = {
            userId,
            cutoff,
            deleted: {
                auditLogs: deletedAuditLogs.count,
                reviews: deletedReviews.count,
                sentTips: deletedSentTips.count,
            },
        };

        const totalDeleted =
            result.deleted.auditLogs +
            result.deleted.reviews +
            result.deleted.sentTips;

        if (totalDeleted > 0) {
            await logAuditEvent(userId, 'PRIVACY_CHANGE', {
                entityType: 'DataRetention',
                entityId: userId,
                statusCode: 200,
                metadata: {
                    action: 'retention_sweep',
                    dataRetentionMonths,
                    cutoff: cutoff.toISOString(),
                    deleted: result.deleted,
                },
            });
        }

        return result;
    }
}

export interface UserRetentionResult {
    userId: string;
    cutoff: Date;
    deleted: {
        auditLogs: number;
        reviews: number;
        sentTips: number;
    };
}

export interface RetentionRunSummary {
    usersProcessed: number;
    errors: Array<{ userId: string; message: string }>;
}