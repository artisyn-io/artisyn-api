import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { prisma } from 'src/db';
import { env } from './helpers';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Helper to get all files in a directory recursively
 */
async function getFiles(dir: string): Promise<string[]> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return files.flat();
}

/**
 * Clean up files in storage that are not in the database
 */
export const cleanupOrphanedFiles = async () => {
    try {
        console.log('[Media Scheduler] Starting orphaned files cleanup...');
        
        // Get all media paths from DB
        const mediaInDb = await prisma.media.findMany({
            where: { provider: 'local' },
            select: { path: true },
        });
        const dbPaths = new Set(mediaInDb.map((m) => path.resolve(m.path)));

        // Identify directories to scan
        // Always include the default uploads dir
        const baseDir = path.join(process.cwd(), 'public');
        const defaultUploadsDir = path.join(baseDir, 'uploads');
        
        const scanDirs = new Set<string>();
        if (existsSync(defaultUploadsDir)) {
            scanDirs.add(defaultUploadsDir);
        }

        // Add any other directories found in the database
        for (const dbPath of dbPaths) {
            const dir = path.dirname(dbPath);
            if (dir.startsWith(baseDir)) {
                scanDirs.add(dir);
            }
        }

        let deletedCount = 0;
        for (const dirToScan of scanDirs) {
            if (!existsSync(dirToScan)) continue;
            
            const files = await fs.readdir(dirToScan);
            for (const file of files) {
                const fullPath = path.resolve(dirToScan, file);
                
                // Skip directories to avoid accidental deletions of system folders
                try {
                    const stats = await fs.stat(fullPath);
                    if (stats.isDirectory()) continue;
                } catch {
                    continue;
                }

                if (!dbPaths.has(fullPath)) {
                    // Safety check: ensure we are only deleting files within the public directory
                    // and not important static assets if they are not tracked in Media
                    const isUploadFolder = fullPath.includes(`${path.sep}uploads${path.sep}`) || 
                                         fullPath.includes(`${path.sep}uploads`);
                    
                    // If it's in a known upload folder or specifically tracked as a custom folder, delete it
                    if (isUploadFolder || Array.from(dbPaths).some(p => path.dirname(p) === dirToScan)) {
                        console.log(`[Media Scheduler] Deleting orphaned file: ${fullPath}`);
                        await fs.unlink(fullPath);
                        deletedCount++;
                    }
                }
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
        const mediaInDb = await prisma.media.findMany({
            where: { provider: 'local' }
        });
        let deletedCount = 0;

        for (const media of mediaInDb) {
            const fileExists = await fs.access(media.path).then(() => true).catch(() => false);
            if (!fileExists) {
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

