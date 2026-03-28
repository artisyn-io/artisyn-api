import { startAnalyticsScheduler, stopAnalyticsScheduler } from "../src/utils/analyticsScheduler";
import { startMediaScheduler, stopMediaScheduler } from "../src/utils/mediaScheduler";
import { startMonitoringService, stopMonitoringService } from "../src/services/monitoringService";

describe("Scheduler Idempotency", () => {
  afterEach(() => {
    stopAnalyticsScheduler();
    stopMediaScheduler();
    stopMonitoringService();
  });

  it("should not create duplicate analytics intervals", () => {
    startAnalyticsScheduler();
    const first = (global as any).analyticsInterval;
    startAnalyticsScheduler();
    const second = (global as any).analyticsInterval;
    expect(first).toBe(second);
  });

  it("should not create duplicate media intervals", () => {
    startMediaScheduler();
    const first = (global as any).mediaCleanupInterval;
    startMediaScheduler();
    const second = (global as any).mediaCleanupInterval;
    expect(first).toBe(second);
  });

  it("should not create duplicate monitoring intervals", () => {
    startMonitoringService();
    const first = (global as any).monitoringInterval;
    startMonitoringService();
    const second = (global as any).monitoringInterval;
    expect(first).toBe(second);
  });
});
