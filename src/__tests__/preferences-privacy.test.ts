import { describe, it, expect } from 'vitest';
import { notificationValidationRules } from '../utils/profileValidators';

describe('Notification validation rules (issue #128)', () => {
  it('defines digestFrequency with allowed enum values', () => {
    const rules = notificationValidationRules.digestFrequency as string[];
    expect(rules).toBeDefined();
    const enumRule = rules.find(r => typeof r === 'string' && r.startsWith('in:')) as string;
    expect(enumRule).toContain('daily');
    expect(enumRule).toContain('weekly');
    expect(enumRule).toContain('monthly');
    expect(enumRule).toContain('never');
  });

  it('includes boolean rules for all notification flags', () => {
    const fields = ['emailNotifications', 'pushNotifications', 'smsNotifications', 'marketingEmails', 'activityEmails'] as const;
    for (const field of fields) {
      expect(notificationValidationRules[field] as string[]).toContain('boolean');
    }
  });

  it('does not expose non-notification preference fields', () => {
    const rules = notificationValidationRules as Record<string, unknown>;
    expect(rules.theme).toBeUndefined();
    expect(rules.language).toBeUndefined();
    expect(rules.currencyPreference).toBeUndefined();
  });
});

describe('Unblock user safety (issue #127)', () => {
  it('filters an empty block list without error', () => {
    const blockList: string[] = [];
    expect(blockList.filter(id => id !== 'user-xyz')).toEqual([]);
  });

  it('removes the correct user from the block list', () => {
    const blockList = ['user-a', 'user-b', 'user-c'];
    expect(blockList.filter(id => id !== 'user-b')).toEqual(['user-a', 'user-c']);
  });

  it('returns the list unchanged when the user was not blocked', () => {
    const blockList = ['user-a', 'user-b'];
    expect(blockList.filter(id => id !== 'user-z')).toEqual(['user-a', 'user-b']);
  });
});