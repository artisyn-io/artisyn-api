import { DeletionPurgeJob } from 'src/services/DeletionPurgeJob';
import { env } from './helpers';

const LOG_PREFIX = '[Deletion Purge Scheduler]';

const DAY = 24 * 60 * 60 * 1000;

let purgeInterval: NodeJS.Timeout | null = null;

const runPurge = async () => {
    try {
        if (env('NODE_ENV') !== 'test') {
            console.log(`${LOG_PREFIX} Running deletion purge sweep...`);
        }

        const summary = await DeletionPurgeJob.run();

        if (env('NODE_ENV') !== 'test') {
            console.log(
                `${LOG_PREFIX} Sweep complete — purged: ${summary.purged}, skipped: ${summary.skipped}, errors: ${summary.errors.length}`,
            );

            for (const { userId, message } of summary.errors) {
                console.error(`${LOG_PREFIX} Error purging user ${userId}: ${message}`);
            }
        }
    } catch (error) {
        console.error(`${LOG_PREFIX} Sweep failed:`, error);
    }
};

export const startDeletionPurgeScheduler = () => {
    if (env('NODE_ENV') === 'test') {
        return;
    }

    console.log(`${LOG_PREFIX} Starting scheduled deletion purge job (every 24 h)...`);

    purgeInterval = setInterval(runPurge, DAY);
};

export const stopDeletionPurgeScheduler = () => {
    if (purgeInterval) {
        clearInterval(purgeInterval);
        purgeInterval = null;
    }
};

export default {
    start: startDeletionPurgeScheduler,
    stop: stopDeletionPurgeScheduler,
};
