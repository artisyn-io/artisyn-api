import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanupOrphanedFiles, cleanupMissingMediaRecords } from '../utils/mediaScheduler';
import { prisma } from 'src/db';
import fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import path from 'node:path';

vi.mock('src/db', () => ({
    prisma: {
        media: {
            findMany: vi.fn(),
            delete: vi.fn(),
        },
    },
}));

vi.mock('node:fs/promises', () => ({
    default: {
        readdir: vi.fn(),
        stat: vi.fn(),
        unlink: vi.fn(),
        access: vi.fn(),
    },
}));

vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
}));

describe('Media Scheduler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('cleanupOrphanedFiles', () => {
        it('should delete orphaned files in default uploads directory', async () => {
            const baseDir = path.join(process.cwd(), 'public');
            const uploadsDir = path.join(baseDir, 'uploads');
            const orphanedFile = path.resolve(uploadsDir, 'orphaned.jpg');
            const trackedFile = path.resolve(uploadsDir, 'tracked.jpg');

            (prisma.media.findMany as any).mockResolvedValue([
                { path: trackedFile }
            ]);

            (fsSync.existsSync as any).mockImplementation((p: string) => p === uploadsDir);
            (fs.readdir as any).mockResolvedValue(['orphaned.jpg', 'tracked.jpg']);
            (fs.stat as any).mockResolvedValue({ isDirectory: () => false });

            await cleanupOrphanedFiles();

            expect(fs.unlink).toHaveBeenCalledWith(orphanedFile);
            expect(fs.unlink).not.toHaveBeenCalledWith(trackedFile);
        });

        it('should delete orphaned files in custom directories found in DB', async () => {
            const baseDir = path.join(process.cwd(), 'public');
            const customDir = path.join(baseDir, 'custom-folder');
            const trackedFile = path.resolve(customDir, 'tracked.jpg');
            const orphanedFile = path.resolve(customDir, 'orphaned.jpg');

            (prisma.media.findMany as any).mockResolvedValue([
                { path: trackedFile }
            ]);

            (fsSync.existsSync as any).mockImplementation((p: string) => p === customDir);
            (fs.readdir as any).mockResolvedValue(['tracked.jpg', 'orphaned.jpg']);
            (fs.stat as any).mockResolvedValue({ isDirectory: () => false });

            await cleanupOrphanedFiles();

            expect(fs.unlink).toHaveBeenCalledWith(orphanedFile);
        });
    });

    describe('cleanupMissingMediaRecords', () => {
        it('should delete DB records for files that do not exist', async () => {
            const existingFile = '/public/uploads/exists.jpg';
            const missingFile = '/public/uploads/missing.jpg';

            (prisma.media.findMany as any).mockResolvedValue([
                { id: '1', path: existingFile, provider: 'local' },
                { id: '2', path: missingFile, provider: 'local' }
            ]);

            (fs.access as any).mockImplementation(async (p: string) => {
                if (p === missingFile) throw new Error('Not found');
                return undefined;
            });

            await cleanupMissingMediaRecords();

            expect(prisma.media.delete).toHaveBeenCalledWith({
                where: { id: '2' }
            });
            expect(prisma.media.delete).not.toHaveBeenCalledWith({
                where: { id: '1' }
            });
        });
    });
});
