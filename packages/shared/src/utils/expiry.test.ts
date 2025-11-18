import { describe, it, expect } from 'vitest';
import {
  isExpired,
  getExpiryDate,
  getTimeUntilExpiry,
  getDaysUntilExpiry,
  isExpiringSoon,
  formatTimeUntilExpiry,
  getDateDaysAgo,
  getExpiryCutoffDate,
  REPO_EXPIRY_DAYS,
  REPO_EXPIRY_MS,
} from './expiry.js';

describe('isExpired', () => {
  it('returns false for repos accessed within 7 days', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-07T23:59:59Z'); // Just under 7 days
    expect(isExpired(lastAccess, now)).toBe(false);
  });

  it('returns true for repos accessed exactly 7 days ago', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-08T00:00:00Z'); // Exactly 7 days
    expect(isExpired(lastAccess, now)).toBe(true);
  });

  it('returns true for repos accessed more than 7 days ago', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-10T00:00:00Z'); // 9 days
    expect(isExpired(lastAccess, now)).toBe(true);
  });

  it('accepts ISO string dates', () => {
    const lastAccess = '2024-01-01T00:00:00Z';
    const now = '2024-01-08T00:00:00Z';
    expect(isExpired(lastAccess, now)).toBe(true);
  });

  it('accepts mixed Date and string', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = '2024-01-08T00:00:00Z';
    expect(isExpired(lastAccess, now)).toBe(true);

    const lastAccess2 = '2024-01-01T00:00:00Z';
    const now2 = new Date('2024-01-08T00:00:00Z');
    expect(isExpired(lastAccess2, now2)).toBe(true);
  });

  it('defaults to current time when now is not provided', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(isExpired(eightDaysAgo)).toBe(true);

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(isExpired(threeDaysAgo)).toBe(false);
  });

  it('supports custom expiry days', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-04T00:00:00Z'); // 3 days later

    expect(isExpired(lastAccess, now, 3)).toBe(true);  // Expired with 3-day policy
    expect(isExpired(lastAccess, now, 7)).toBe(false); // Not expired with 7-day policy
  });

  it('handles repos accessed today', () => {
    const now = new Date('2024-01-08T12:00:00Z');
    const lastAccess = new Date('2024-01-08T10:00:00Z'); // 2 hours ago
    expect(isExpired(lastAccess, now)).toBe(false);
  });
});

describe('getExpiryDate', () => {
  it('calculates expiry date 7 days from last access', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const expiryDate = getExpiryDate(lastAccess);

    expect(expiryDate).toEqual(new Date('2024-01-08T00:00:00Z'));
  });

  it('accepts ISO string dates', () => {
    const lastAccess = '2024-01-01T00:00:00Z';
    const expiryDate = getExpiryDate(lastAccess);

    expect(expiryDate).toEqual(new Date('2024-01-08T00:00:00Z'));
  });

  it('supports custom expiry days', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const expiryDate = getExpiryDate(lastAccess, 14);

    expect(expiryDate).toEqual(new Date('2024-01-15T00:00:00Z'));
  });

  it('preserves time of day', () => {
    const lastAccess = new Date('2024-01-01T15:30:45Z');
    const expiryDate = getExpiryDate(lastAccess);

    expect(expiryDate).toEqual(new Date('2024-01-08T15:30:45Z'));
  });
});

describe('getTimeUntilExpiry', () => {
  it('calculates milliseconds until expiry', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-03T00:00:00Z'); // 2 days later

    const msRemaining = getTimeUntilExpiry(lastAccess, now);
    const expectedMs = 5 * 24 * 60 * 60 * 1000; // 5 days remaining

    expect(msRemaining).toBe(expectedMs);
  });

  it('returns 0 for expired repos', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-10T00:00:00Z'); // 9 days later

    expect(getTimeUntilExpiry(lastAccess, now)).toBe(0);
  });

  it('returns 0 for repos expiring exactly now', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-08T00:00:00Z'); // Exactly 7 days

    expect(getTimeUntilExpiry(lastAccess, now)).toBe(0);
  });

  it('supports custom expiry days', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-02T00:00:00Z'); // 1 day later

    const ms14Days = getTimeUntilExpiry(lastAccess, now, 14);
    const expected = 13 * 24 * 60 * 60 * 1000;

    expect(ms14Days).toBe(expected);
  });
});

describe('getDaysUntilExpiry', () => {
  it('calculates days remaining until expiry', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-03T00:00:00Z'); // 2 days later

    expect(getDaysUntilExpiry(lastAccess, now)).toBe(5);
  });

  it('returns 0 for expired repos', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-10T00:00:00Z'); // 9 days later

    expect(getDaysUntilExpiry(lastAccess, now)).toBe(0);
  });

  it('floors partial days', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-02T12:00:00Z'); // 1.5 days later

    expect(getDaysUntilExpiry(lastAccess, now)).toBe(5); // Not 5.5
  });

  it('returns 0 on exact expiry', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-08T00:00:00Z');

    expect(getDaysUntilExpiry(lastAccess, now)).toBe(0);
  });
});

describe('isExpiringSoon', () => {
  it('returns true for repos expiring within 24 hours', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-07T12:00:00Z'); // 6.5 days later

    expect(isExpiringSoon(lastAccess, now)).toBe(true);
  });

  it('returns false for repos with more than 1 day remaining', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-05T00:00:00Z'); // 4 days later (3 days remaining)

    expect(isExpiringSoon(lastAccess, now)).toBe(false);
  });

  it('returns false for already expired repos', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-10T00:00:00Z'); // 9 days later

    expect(isExpiringSoon(lastAccess, now)).toBe(false);
  });

  it('returns true at exactly 24 hours remaining', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-07T00:00:00Z'); // Exactly 6 days

    expect(isExpiringSoon(lastAccess, now)).toBe(true);
  });

  it('returns false at exactly expiry time', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-08T00:00:00Z'); // Exactly 7 days

    expect(isExpiringSoon(lastAccess, now)).toBe(false);
  });
});

describe('formatTimeUntilExpiry', () => {
  it('formats days remaining', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-03T00:00:00Z');

    expect(formatTimeUntilExpiry(lastAccess, now)).toBe('5 days');
  });

  it('formats 1 day correctly', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-07T00:00:00Z');

    expect(formatTimeUntilExpiry(lastAccess, now)).toBe('1 day');
  });

  it('formats hours when less than 1 day', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-07T18:00:00Z'); // 6 hours until expiry

    expect(formatTimeUntilExpiry(lastAccess, now)).toBe('6 hours');
  });

  it('formats 1 hour correctly', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-07T23:00:00Z'); // 1 hour until expiry

    expect(formatTimeUntilExpiry(lastAccess, now)).toBe('1 hour');
  });

  it('formats minutes when less than 1 hour', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-07T23:30:00Z'); // 30 minutes until expiry

    expect(formatTimeUntilExpiry(lastAccess, now)).toBe('30 minutes');
  });

  it('formats 1 minute correctly', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-07T23:59:00Z'); // 1 minute until expiry

    expect(formatTimeUntilExpiry(lastAccess, now)).toBe('1 minute');
  });

  it('returns "Less than a minute" for very short times', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-07T23:59:30Z'); // 30 seconds until expiry

    expect(formatTimeUntilExpiry(lastAccess, now)).toBe('Less than a minute');
  });

  it('returns "Expired" for expired repos', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-10T00:00:00Z');

    expect(formatTimeUntilExpiry(lastAccess, now)).toBe('Expired');
  });

  it('returns "Expired" at exact expiry time', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-08T00:00:00Z');

    expect(formatTimeUntilExpiry(lastAccess, now)).toBe('Expired');
  });
});

describe('getDateDaysAgo', () => {
  it('calculates date N days ago', () => {
    const now = new Date('2024-01-08T00:00:00Z');
    const eightDaysAgo = getDateDaysAgo(8, now);

    expect(eightDaysAgo).toEqual(new Date('2023-12-31T00:00:00Z'));
  });

  it('handles 0 days ago (returns same date)', () => {
    const now = new Date('2024-01-08T00:00:00Z');
    const result = getDateDaysAgo(0, now);

    expect(result).toEqual(now);
  });

  it('preserves time of day', () => {
    const now = new Date('2024-01-08T15:30:45Z');
    const threeDaysAgo = getDateDaysAgo(3, now);

    expect(threeDaysAgo).toEqual(new Date('2024-01-05T15:30:45Z'));
  });

  it('defaults to current time when from is not provided', () => {
    const result = getDateDaysAgo(1);
    const expected = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Allow 1 second tolerance for execution time
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it('accepts ISO string dates', () => {
    const now = '2024-01-08T00:00:00Z';
    const fiveDaysAgo = getDateDaysAgo(5, now);

    expect(fiveDaysAgo).toEqual(new Date('2024-01-03T00:00:00Z'));
  });
});

describe('getExpiryCutoffDate', () => {
  it('calculates cutoff date for expired repos', () => {
    const now = new Date('2024-01-08T00:00:00Z');
    const cutoff = getExpiryCutoffDate(now);

    expect(cutoff).toEqual(new Date('2024-01-01T00:00:00Z'));
  });

  it('repos accessed before cutoff are expired', () => {
    const now = new Date('2024-01-08T00:00:00Z');
    const cutoff = getExpiryCutoffDate(now);

    const beforeCutoff = new Date('2023-12-31T23:59:59Z');
    const atCutoff = new Date('2024-01-01T00:00:00Z');
    const afterCutoff = new Date('2024-01-01T00:00:01Z');

    expect(isExpired(beforeCutoff, now)).toBe(true);
    expect(isExpired(atCutoff, now)).toBe(true);
    expect(isExpired(afterCutoff, now)).toBe(false);
  });

  it('supports custom expiry days', () => {
    const now = new Date('2024-01-15T00:00:00Z');
    const cutoff = getExpiryCutoffDate(now, 14);

    expect(cutoff).toEqual(new Date('2024-01-01T00:00:00Z'));
  });

  it('defaults to current time when now is not provided', () => {
    const result = getExpiryCutoffDate();
    const expected = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Allow 1 second tolerance for execution time
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000);
  });
});

describe('constants', () => {
  it('exports correct expiry days', () => {
    expect(REPO_EXPIRY_DAYS).toBe(7);
  });

  it('exports correct expiry milliseconds', () => {
    const expected = 7 * 24 * 60 * 60 * 1000;
    expect(REPO_EXPIRY_MS).toBe(expected);
  });
});

describe('edge cases', () => {
  it('handles leap seconds gracefully', () => {
    // JavaScript Date doesn't support leap seconds, but test boundary
    const lastAccess = new Date('2024-06-30T23:59:59Z');
    const now = new Date('2024-07-06T23:59:59Z'); // 6 days later

    expect(isExpired(lastAccess, now)).toBe(false);
  });

  it('handles daylight saving time transitions', () => {
    // DST doesn't affect UTC calculations
    const lastAccess = new Date('2024-03-10T00:00:00Z'); // US DST starts
    const now = new Date('2024-03-16T00:00:00Z'); // 6 days later

    expect(isExpired(lastAccess, now)).toBe(false);
  });

  it('handles year boundaries', () => {
    const lastAccess = new Date('2023-12-29T00:00:00Z');
    const now = new Date('2024-01-05T00:00:00Z'); // 7 days later

    expect(isExpired(lastAccess, now)).toBe(true);
  });

  it('handles very old dates', () => {
    const lastAccess = new Date('2020-01-01T00:00:00Z');
    const now = new Date('2024-01-01T00:00:00Z');

    expect(isExpired(lastAccess, now)).toBe(true);
    expect(getDaysUntilExpiry(lastAccess, now)).toBe(0);
  });

  it('handles future dates gracefully', () => {
    const lastAccess = new Date('2024-01-10T00:00:00Z');
    const now = new Date('2024-01-01T00:00:00Z'); // now is before last access

    // Future access date should not be expired
    expect(isExpired(lastAccess, now)).toBe(false);
  });
});

describe('real-world scenarios', () => {
  it('scenario: repo just created', () => {
    const created = new Date('2024-01-01T10:00:00Z');
    const now = new Date('2024-01-01T10:05:00Z'); // 5 minutes later

    expect(isExpired(created, now)).toBe(false);
    expect(getDaysUntilExpiry(created, now)).toBe(6); // ~7 days remaining
    expect(isExpiringSoon(created, now)).toBe(false);
    expect(formatTimeUntilExpiry(created, now)).toBe('6 days');
  });

  it('scenario: repo expires tomorrow', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-07T00:00:00Z'); // 6 days later

    expect(isExpired(lastAccess, now)).toBe(false);
    expect(getDaysUntilExpiry(lastAccess, now)).toBe(1);
    expect(isExpiringSoon(lastAccess, now)).toBe(true);
    expect(formatTimeUntilExpiry(lastAccess, now)).toBe('1 day');
  });

  it('scenario: repo expires in 1 hour', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-07T23:00:00Z');

    expect(isExpired(lastAccess, now)).toBe(false);
    expect(isExpiringSoon(lastAccess, now)).toBe(true);
    expect(formatTimeUntilExpiry(lastAccess, now)).toBe('1 hour');
  });

  it('scenario: repo just expired', () => {
    const lastAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-08T00:00:01Z'); // 1 second past expiry

    expect(isExpired(lastAccess, now)).toBe(true);
    expect(getDaysUntilExpiry(lastAccess, now)).toBe(0);
    expect(isExpiringSoon(lastAccess, now)).toBe(false);
    expect(formatTimeUntilExpiry(lastAccess, now)).toBe('Expired');
  });

  it('scenario: database cleanup query', () => {
    const now = new Date('2024-01-08T00:00:00Z');
    const cutoff = getExpiryCutoffDate(now);

    // Repos last accessed before cutoff should be deleted
    const repo1 = new Date('2023-12-31T23:59:59Z'); // Before cutoff
    const repo2 = new Date('2024-01-01T00:00:00Z'); // At cutoff
    const repo3 = new Date('2024-01-02T00:00:00Z'); // After cutoff

    expect(repo1 < cutoff).toBe(true);  // Should delete
    expect(repo2 <= cutoff).toBe(true); // Should delete (expired)
    expect(repo3 > cutoff).toBe(true);  // Should keep
  });

  it('scenario: user renews access', () => {
    const originalAccess = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-05T00:00:00Z');

    // Before renewal
    expect(getDaysUntilExpiry(originalAccess, now)).toBe(3);

    // User logs in again
    const renewedAccess = now;

    // After renewal - reset to 7 days
    expect(getDaysUntilExpiry(renewedAccess, now)).toBe(7); // Full 7 days
  });
});
