import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchAlert, type NotificationResult } from '../notificationService';
import type { SecurityAlert } from '../monitoringService';

// Mock the mailer so we don't send real emails in tests
vi.mock('src/mailer/mailer', () => ({
  sendMail: vi.fn().mockResolvedValue(null),
}));

// Track env overrides per test
let envOverrides: Record<string, string | undefined> = {};

vi.mock('src/utils/helpers', () => ({
  env: vi.fn((key: string, defaultValue?: string) => {
    if (key === 'NODE_ENV') return 'test';
    if (key in envOverrides) return envOverrides[key];
    return defaultValue ?? '';
  }),
}));

let ogConsole = [console.debug, console.error];
beforeAll(() => {
  console.debug = vi.fn();
  console.error = vi.fn();
});

afterAll(() => {
  console.debug = ogConsole[0];
  console.error = ogConsole[1];
});

const makeAlert = (overrides: Partial<SecurityAlert> = {}): SecurityAlert => ({
  id: 'alert_test_123',
  type: 'api-error',
  severity: 'critical',
  message: 'Test alert',
  data: { ip: '127.0.0.1', userId: 'user-1', timestamp: new Date().toISOString() },
  timestamp: new Date(),
  resolved: false,
  ...overrides,
});

describe('Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envOverrides = {};
  });

  it('should return failure results when no channels are configured', async () => {
    const results = await dispatchAlert(makeAlert());

    expect(results.length).toBeGreaterThanOrEqual(2);

    for (const r of results) {
      expect(r.success).toBe(false);
      expect(r.error).toBeDefined();
    }
  });

  it('should attempt email delivery when ALERT_EMAIL_RECIPIENTS is set', async () => {
    envOverrides['ALERT_EMAIL_RECIPIENTS'] = 'admin@example.com';

    const { sendMail } = await import('src/mailer/mailer');
    const results = await dispatchAlert(makeAlert());

    const emailResult = results.find(r => r.channel === 'email');
    expect(emailResult).toBeDefined();
    expect(emailResult!.success).toBe(true);
    expect(sendMail).toHaveBeenCalled();
  });

  it('should not crash when email delivery fails', async () => {
    envOverrides['ALERT_EMAIL_RECIPIENTS'] = 'admin@example.com';

    const { sendMail } = await import('src/mailer/mailer');
    (sendMail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('SMTP down'));

    const results = await dispatchAlert(makeAlert());
    const emailResult = results.find(r => r.channel === 'email');

    expect(emailResult).toBeDefined();
    expect(emailResult!.success).toBe(false);
    expect(emailResult!.error).toContain('SMTP down');
  });

  it('should return discord failure when webhook URL is missing', async () => {
    const results = await dispatchAlert(makeAlert());
    const discordResult = results.find(r => r.channel === 'discord');

    expect(discordResult).toBeDefined();
    expect(discordResult!.success).toBe(false);
    expect(discordResult!.error).toContain('ALERT_DISCORD_WEBHOOK_URL not configured');
  });

  it('should include alert metadata in results', async () => {
    const alert = makeAlert({ severity: 'high', type: 'blocked-ip' });
    const results = await dispatchAlert(alert);

    // All channels should have been attempted
    expect(results.length).toBeGreaterThanOrEqual(2);
    for (const r of results) {
      expect(r).toHaveProperty('channel');
      expect(r).toHaveProperty('success');
    }
  });
});
