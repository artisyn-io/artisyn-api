import fs from 'fs';
import path from 'path';
import { prisma } from 'src/db';
import { env } from './helpers';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Clean up files in storage that are not in the database
 */
export const cleanupOrphanedFiles = async () => {
    try {
        console.log('[Media Scheduler] Starting orphaned files cleanup...');
        const baseDir = path.join(process.cwd(), 'public');
        const uploadsDir = path.join(baseDir, 'uploads');

        if (!fs.existsSync(uploadsDir)) {
            return;
        }

        const files = fs.readdirSync(uploadsDir);
        const mediaInDb = await prisma.media.findMany({
            select: { path: true },
        });

        const dbPaths = new Set(mediaInDb.map((m) => m.path));
        let deletedCount = 0;

        for (const file of files) {
            const fullPath = path.join(uploadsDir, file);
            // Skip directories
            if (fs.statSync(fullPath).isDirectory()) continue;

            if (!dbPaths.has(fullPath)) {
                console.log(`[Media Scheduler] Deleting orphaned file: ${file}`);
                fs.unlinkSync(fullPath);
                deletedCount++;
            }
        }

        console.log(`[Media Scheduler] Orphaned files cleanup completed. Deleted ${deletedCount} files.`);
    } catch (error) {
        console.error('[Media Scheduler] Orphaned files cleanup failed:', error);
    }
};

/**
 * Clean up database records that point to non-existent files
 */
export const cleanupMissingMediaRecords = async () => {
    try {
        console.log('[Media Scheduler] Starting missing media records cleanup...');
        const mediaInDb = await prisma.media.findMany();
        let deletedCount = 0;

        for (const media of mediaInDb) {
            if (!fs.existsSync(media.path)) {
                console.log(`[Media Scheduler] Deleting record for missing file: ${media.filename} (${media.id})`);
                await prisma.media.delete({
                    where: { id: media.id },
                });
                deletedCount++;
            }
        }

        console.log(`[Media Scheduler] Missing media records cleanup completed. Deleted ${deletedCount} records.`);
    } catch (error) {
        console.error('[Media Scheduler] Missing media records cleanup failed:', error);
    }
};

export const startMediaScheduler = () => {
    if (env('NODE_ENV') === 'test') {
        return;
    }

    console.log('[Media Scheduler] Starting scheduled jobs...');

    // Run cleanup once a day
    cleanupInterval = setInterval(async () => {
        await cleanupOrphanedFiles();
        await cleanupMissingMediaRecords();
    }, DAY);

    // Initial run after 10 seconds
    setTimeout(async () => {
        await cleanupOrphanedFiles();
        await cleanupMissingMediaRecords();
    }, 10000);
};

export const stopMediaScheduler = () => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
};

export default {
    start: startMediaScheduler,
    stop: stopMediaScheduler,
};
