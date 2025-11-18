import { createHash } from 'crypto';

/**
 * Hash an IP address for privacy-preserving logging
 * Uses SHA-256 with a salt and truncates to 64 characters
 */
export function hashIp(ip: string, salt?: string): string {
  const saltValue = salt || process.env.IP_HASH_SALT || 'default-salt-change-in-prod';
  const hash = createHash('sha256');
  hash.update(ip + saltValue);
  return hash.digest('hex').slice(0, 64);
}
