import { dataExportService } from './DataExportService';

export class DataExportQueue {
    private readonly pending = new Set<string>();
    private processing = false;

    enqueue(requestId: string) {
        if (!requestId || this.pending.has(requestId)) {
            return;
        }

        this.pending.add(requestId);
        queueMicrotask(() => {
            void this.drain();
        });
    }

    private async drain() {
        if (this.processing) {
            return;
        }

        this.processing = true;

        try {
            while (this.pending.size > 0) {
                const [requestId] = this.pending;
                this.pending.delete(requestId);
                try {
                    await dataExportService.processRequest(requestId);
                } catch (error) {
                    console.error('Data export queue processing failed:', error);
                }
            }
        } finally {
            this.processing = false;

            if (this.pending.size > 0) {
                queueMicrotask(() => {
                    void this.drain();
                });
            }
        }
    }
}

export const dataExportQueue = new DataExportQueue();
