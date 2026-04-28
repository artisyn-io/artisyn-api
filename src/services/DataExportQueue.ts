/**
 * Durable export queue backed by the database.
 *
 * Instead of keeping pending request IDs in process memory (which are lost on
 * restart), this queue polls the `data_export_requests` table for rows whose
 * status is `pending` or `processing` and drives them to completion.
 *
 * Lifecycle
 * ---------
 * 1. `enqueue(requestId)` – immediately schedules one processing attempt via
 *    `queueMicrotask` so the current request is handled without waiting for the
 *    next poll cycle.
 * 2. `start()` – begins a periodic poll (default: every 30 s) that picks up any
 *    requests that survived a process restart while still in `pending` or
 *    `processing` state.
 * 3. `stop()` – clears the poll interval (useful in tests / graceful shutdown).
 */

import { prisma } from 'src/db';
import { dataExportService } from './DataExportService';

const POLL_INTERVAL_MS = Number(process.env.EXPORT_QUEUE_POLL_MS ?? 30_000);

export class DataExportQueue {
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private processing = false;

    /** Immediately schedule processing for a single known request ID. */
    enqueue(requestId: string) {
        if (!requestId) return;
        queueMicrotask(() => void this.processOne(requestId));
    }

    /**
     * Start the background poll that recovers requests surviving a restart.
     * Safe to call multiple times – subsequent calls are no-ops.
     */
    start() {
        if (this.pollTimer !== null) return;
        this.pollTimer = setInterval(() => void this.drainPending(), POLL_INTERVAL_MS);
        // Unref so the timer does not prevent the process from exiting naturally.
        if (typeof this.pollTimer === 'object' && 'unref' in this.pollTimer) {
            (this.pollTimer as NodeJS.Timeout).unref();
        }
    }

    /** Stop the background poll (e.g. during graceful shutdown or in tests). */
    stop() {
        if (this.pollTimer !== null) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    /** Process a single request by ID. */
    private async processOne(requestId: string) {
        try {
            await dataExportService.processRequest(requestId);
        } catch (error) {
            console.error(`[DataExportQueue] Failed to process request ${requestId}:`, error);
        }
    }

    /**
     * Query the DB for all pending/processing requests and drive each one to
     * completion.  A simple mutex (`this.processing`) prevents concurrent drain
     * runs from the same process instance.
     */
    private async drainPending() {
        if (this.processing) return;
        this.processing = true;

        try {
            const stale = await prisma.dataExportRequest.findMany({
                where: { status: { in: ['pending', 'processing'] } },
                select: { id: true },
            });

            for (const { id } of stale) {
                await this.processOne(id);
            }
        } catch (error) {
            console.error('[DataExportQueue] Drain error:', error);
        } finally {
            this.processing = false;
        }
    }
}

export const dataExportQueue = new DataExportQueue();

// Start the background poll automatically when this module is first imported.
dataExportQueue.start();
