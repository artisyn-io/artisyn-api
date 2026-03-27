import { describe, it, expect, beforeEach, vi } from 'vitest';
import AnalyticsService from '../AnalyticsService';
import { EventType } from '@prisma/client';
import { prisma } from '../../db';

// Mock Prisma client
vi.mock('../../db', () => ({
  prisma: {
    analyticsEvent: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('AnalyticsService Anomaly Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectAnomalies', () => {
    it('should detect brute force login attempts', async () => {
      // Mock groupBy to return suspicious IP
      (prisma.analyticsEvent.groupBy as any).mockResolvedValue([
        {
          ipHash: 'suspicious-ip-hash',
          _count: { id: 10 },
        },
        {
          ipHash: 'safe-ip-hash',
          _count: { id: 2 },
        },
      ]);

      const result = await AnalyticsService.detectAnomalies({ windowMinutes: 60 });

      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].type).toBe('BRUTE_FORCE_LOGIN');
      expect(result.anomalies[0].severity).toBe('high');
      expect(result.anomalies[0].context.ipHash).toBe('suspicious-ip-hash');
      expect(result.anomalies[0].context.failedLogins).toBe(10);
    });

    it('should handle empty results gracefully', async () => {
      (prisma.analyticsEvent.groupBy as any).mockResolvedValue([]);
      (prisma.analyticsEvent.count as any).mockResolvedValue(0);

      const result = await AnalyticsService.detectAnomalies();

      expect(result.anomalies).toHaveLength(0);
    });

    it('should detect error rate spikes', async () => {
      (prisma.analyticsEvent.groupBy as any).mockResolvedValue([]);
      
      // Mock count for current window (high) and previous window (low)
      (prisma.analyticsEvent.count as any)
        .mockResolvedValueOnce(25) // currentErrors
        .mockResolvedValueOnce(5);  // previousErrors

      const result = await AnalyticsService.detectAnomalies({ windowMinutes: 30 });

      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].type).toBe('ERROR_RATE_SPIKE');
      expect(result.anomalies[0].severity).toBe('medium');
      expect(result.anomalies[0].context.currentErrors).toBe(25);
      expect(result.anomalies[0].context.previousErrors).toBe(5);
    });

    it('should not report error spike if current errors are below threshold', async () => {
      (prisma.analyticsEvent.groupBy as any).mockResolvedValue([]);
      
      (prisma.analyticsEvent.count as any)
        .mockResolvedValueOnce(5)  // currentErrors (below 10 threshold)
        .mockResolvedValueOnce(1);  // previousErrors

      const result = await AnalyticsService.detectAnomalies();

      expect(result.anomalies).toHaveLength(0);
    });

    it('should handle malformed groupBy results safely', async () => {
      // Mock groupBy to return unexpected structure
      (prisma.analyticsEvent.groupBy as any).mockResolvedValue([
        {
          ipHash: 'malformed-row',
          _count: true, // Should be handled by type check
        },
        {
          ipHash: 'another-malformed',
          // missing _count
        }
      ]);

      const result = await AnalyticsService.detectAnomalies();

      // Should not throw and should not detect as brute force
      expect(result.anomalies).toHaveLength(0);
    });
  });
});
