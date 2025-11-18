/**
 * Number of days before a repo expires without access
 */
export const REPO_EXPIRY_DAYS = 7;

/**
 * Number of milliseconds in one day
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Number of milliseconds before repo expiry (7 days)
 */
export const REPO_EXPIRY_MS = REPO_EXPIRY_DAYS * MS_PER_DAY;

/**
 * Checks if a repo has expired based on last access time.
 * A repo expires if it has not been successfully accessed for REPO_EXPIRY_DAYS (7 days).
 *
 * @param lastAccessedAt - Timestamp of last successful password entry (Date or ISO string)
 * @param now - Current timestamp (Date or ISO string), defaults to Date.now()
 * @param expiryDays - Number of days until expiry (defaults to 7)
 * @returns true if repo has expired
 *
 * @example
 * const lastAccess = new Date('2024-01-01');
 * const now = new Date('2024-01-09'); // 8 days later
 * isExpired(lastAccess, now); // true
 *
 * @example
 * const lastAccess = new Date('2024-01-01');
 * const now = new Date('2024-01-07'); // 6 days later
 * isExpired(lastAccess, now); // false
 */
export const isExpired = (
  lastAccessedAt: Date | string,
  now: Date | string = new Date(),
  expiryDays: number = REPO_EXPIRY_DAYS
): boolean => {
  const lastAccessTime = typeof lastAccessedAt === 'string'
    ? new Date(lastAccessedAt).getTime()
    : lastAccessedAt.getTime();

  const currentTime = typeof now === 'string'
    ? new Date(now).getTime()
    : now.getTime();

  const expiryMs = expiryDays * MS_PER_DAY;
  const timeSinceAccess = currentTime - lastAccessTime;

  return timeSinceAccess >= expiryMs;
};

/**
 * Calculates when a repo will expire based on last access time.
 *
 * @param lastAccessedAt - Timestamp of last successful password entry
 * @param expiryDays - Number of days until expiry (defaults to 7)
 * @returns Date when repo will expire
 *
 * @example
 * const lastAccess = new Date('2024-01-01');
 * const expiryDate = getExpiryDate(lastAccess);
 * // Returns Date for '2024-01-08'
 */
export const getExpiryDate = (
  lastAccessedAt: Date | string,
  expiryDays: number = REPO_EXPIRY_DAYS
): Date => {
  const lastAccessTime = typeof lastAccessedAt === 'string'
    ? new Date(lastAccessedAt).getTime()
    : lastAccessedAt.getTime();

  const expiryMs = expiryDays * MS_PER_DAY;
  return new Date(lastAccessTime + expiryMs);
};

/**
 * Calculates how many milliseconds until a repo expires.
 * Returns 0 if already expired.
 *
 * @param lastAccessedAt - Timestamp of last successful password entry
 * @param now - Current timestamp (defaults to Date.now())
 * @param expiryDays - Number of days until expiry (defaults to 7)
 * @returns Milliseconds until expiry (0 if already expired)
 *
 * @example
 * const lastAccess = new Date('2024-01-01');
 * const now = new Date('2024-01-03'); // 2 days later
 * const msRemaining = getTimeUntilExpiry(lastAccess, now);
 * // Returns ~5 days worth of milliseconds
 */
export const getTimeUntilExpiry = (
  lastAccessedAt: Date | string,
  now: Date | string = new Date(),
  expiryDays: number = REPO_EXPIRY_DAYS
): number => {
  const lastAccessTime = typeof lastAccessedAt === 'string'
    ? new Date(lastAccessedAt).getTime()
    : lastAccessedAt.getTime();

  const currentTime = typeof now === 'string'
    ? new Date(now).getTime()
    : now.getTime();

  const expiryMs = expiryDays * MS_PER_DAY;
  const expiryTime = lastAccessTime + expiryMs;
  const timeRemaining = expiryTime - currentTime;

  return Math.max(0, timeRemaining);
};

/**
 * Calculates how many days (rounded) until a repo expires.
 * Returns 0 if already expired.
 *
 * @param lastAccessedAt - Timestamp of last successful password entry
 * @param now - Current timestamp (defaults to Date.now())
 * @param expiryDays - Number of days until expiry (defaults to 7)
 * @returns Days until expiry (0 if already expired)
 *
 * @example
 * const lastAccess = new Date('2024-01-01');
 * const now = new Date('2024-01-03'); // 2 days later
 * const daysRemaining = getDaysUntilExpiry(lastAccess, now);
 * // Returns 5
 */
export const getDaysUntilExpiry = (
  lastAccessedAt: Date | string,
  now: Date | string = new Date(),
  expiryDays: number = REPO_EXPIRY_DAYS
): number => {
  const msRemaining = getTimeUntilExpiry(lastAccessedAt, now, expiryDays);
  return Math.floor(msRemaining / MS_PER_DAY);
};

/**
 * Checks if a repo is expiring soon (within 1 day).
 *
 * @param lastAccessedAt - Timestamp of last successful password entry
 * @param now - Current timestamp (defaults to Date.now())
 * @param expiryDays - Number of days until expiry (defaults to 7)
 * @returns true if repo expires within 24 hours
 *
 * @example
 * const lastAccess = new Date('2024-01-01');
 * const now = new Date('2024-01-07T12:00:00'); // 6.5 days later
 * isExpiringSoon(lastAccess, now); // true
 */
export const isExpiringSoon = (
  lastAccessedAt: Date | string,
  now: Date | string = new Date(),
  expiryDays: number = REPO_EXPIRY_DAYS
): boolean => {
  const msRemaining = getTimeUntilExpiry(lastAccessedAt, now, expiryDays);
  return msRemaining > 0 && msRemaining <= MS_PER_DAY;
};

/**
 * Formats time remaining until expiry in human-readable format.
 *
 * @param lastAccessedAt - Timestamp of last successful password entry
 * @param now - Current timestamp (defaults to Date.now())
 * @param expiryDays - Number of days until expiry (defaults to 7)
 * @returns Human-readable time remaining or "Expired"
 *
 * @example
 * const lastAccess = new Date('2024-01-01');
 * const now = new Date('2024-01-03');
 * formatTimeUntilExpiry(lastAccess, now); // "5 days"
 *
 * @example
 * const now = new Date('2024-01-07T12:00:00');
 * formatTimeUntilExpiry(lastAccess, now); // "12 hours"
 */
export const formatTimeUntilExpiry = (
  lastAccessedAt: Date | string,
  now: Date | string = new Date(),
  expiryDays: number = REPO_EXPIRY_DAYS
): string => {
  const msRemaining = getTimeUntilExpiry(lastAccessedAt, now, expiryDays);

  if (msRemaining === 0) {
    return 'Expired';
  }

  const days = Math.floor(msRemaining / MS_PER_DAY);
  if (days > 0) {
    return days === 1 ? '1 day' : `${days} days`;
  }

  const hours = Math.floor(msRemaining / (60 * 60 * 1000));
  if (hours > 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  const minutes = Math.floor(msRemaining / (60 * 1000));
  if (minutes > 0) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }

  return 'Less than a minute';
};

/**
 * Creates a timestamp for "now minus N days" for testing/queries.
 *
 * @param daysAgo - Number of days in the past
 * @param from - Base timestamp (defaults to now)
 * @returns Date N days ago
 *
 * @example
 * const eightDaysAgo = getDateDaysAgo(8);
 * // Returns Date 8 days before now
 */
export const getDateDaysAgo = (
  daysAgo: number,
  from: Date | string = new Date()
): Date => {
  const baseTime = typeof from === 'string'
    ? new Date(from).getTime()
    : from.getTime();

  const msAgo = daysAgo * MS_PER_DAY;
  return new Date(baseTime - msAgo);
};

/**
 * Gets the cutoff date for expired repos.
 * Repos last accessed before this date are expired.
 *
 * @param now - Current timestamp (defaults to Date.now())
 * @param expiryDays - Number of days until expiry (defaults to 7)
 * @returns Cutoff date (repos accessed before this are expired)
 *
 * @example
 * const now = new Date('2024-01-08');
 * const cutoff = getExpiryCutoffDate(now);
 * // Returns Date for '2024-01-01'
 * // Any repo last accessed before 2024-01-01 is expired
 */
export const getExpiryCutoffDate = (
  now: Date | string = new Date(),
  expiryDays: number = REPO_EXPIRY_DAYS
): Date => {
  return getDateDaysAgo(expiryDays, now);
};
