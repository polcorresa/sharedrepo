import { repoPasswordSchema } from '../contracts/repos.js';

/**
 * Minimum allowed password length
 */
export const MIN_PASSWORD_LENGTH = 4;

/**
 * Maximum allowed password length
 */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Password validation error types
 */
export type PasswordValidationError =
  | 'empty'
  | 'too_short'
  | 'too_long'
  | 'valid';

/**
 * Result of password validation with detailed error information
 */
export interface PasswordValidationResult {
  valid: boolean;
  error?: PasswordValidationError;
  message?: string;
}

/**
 * Checks if a password meets the minimum length requirement.
 * Does NOT check maximum length or other complexity rules.
 *
 * @param password - Password to check
 * @returns true if password is at least MIN_PASSWORD_LENGTH characters
 *
 * @example
 * isPasswordValid('test') // true (4 chars)
 * isPasswordValid('secret') // true
 * isPasswordValid('abc') // false (3 chars)
 * isPasswordValid('') // false (empty)
 */
export const isPasswordValid = (password: string): boolean => {
  return password.length >= MIN_PASSWORD_LENGTH;
};

/**
 * Validates a password using Zod schema.
 * Throws ZodError if validation fails.
 *
 * @param password - Password to validate
 * @returns Validated password
 * @throws {ZodError} If password is invalid
 *
 * @example
 * validatePassword('secret123') // 'secret123'
 * validatePassword('abc') // throws ZodError (too short)
 */
export const validatePassword = (password: string): string => {
  return repoPasswordSchema.parse(password);
};

/**
 * Validates a password with detailed error information.
 *
 * @param password - Password to validate
 * @returns Detailed validation result
 *
 * @example
 * validatePasswordDetailed('secret')
 * // { valid: true, error: 'valid' }
 *
 * validatePasswordDetailed('abc')
 * // { valid: false, error: 'too_short', message: 'Password must be at least 4 characters' }
 *
 * validatePasswordDetailed('')
 * // { valid: false, error: 'empty', message: 'Password cannot be empty' }
 */
export const validatePasswordDetailed = (
  password: string
): PasswordValidationResult => {
  // Check if empty
  if (password.length === 0) {
    return {
      valid: false,
      error: 'empty',
      message: 'Password cannot be empty',
    };
  }

  // Check minimum length
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: 'too_short',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  // Check maximum length
  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: 'too_long',
      message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
    };
  }

  return {
    valid: true,
    error: 'valid',
  };
};

/**
 * Calculates rough password strength score (0-4).
 * This is NOT a security requirement, just a UX hint.
 *
 * Score levels:
 * - 0: Very weak (< 6 chars)
 * - 1: Weak (6-8 chars, no variety)
 * - 2: Fair (8-12 chars, some variety)
 * - 3: Good (12+ chars, good variety)
 * - 4: Strong (16+ chars, excellent variety)
 *
 * @param password - Password to evaluate
 * @returns Score from 0 to 4
 *
 * @example
 * getPasswordStrength('abc') // 0
 * getPasswordStrength('test1234') // 1
 * getPasswordStrength('MyPassword123') // 2
 * getPasswordStrength('MyStr0ngP@ssw0rd!') // 4
 */
export const getPasswordStrength = (password: string): number => {
  let score = 0;

  // Length-based scoring
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  // Variety bonuses (don't add to base score, but improve it)
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigits = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  const varietyCount = [
    hasLowercase,
    hasUppercase,
    hasDigits,
    hasSpecial,
  ].filter(Boolean).length;

  // Boost score if good variety
  if (varietyCount >= 3 && password.length >= 8) {
    score = Math.min(score + 1, 4);
  }

  return Math.min(score, 4);
};

/**
 * Gets a human-readable strength label for a password.
 *
 * @param password - Password to evaluate
 * @returns Strength label: 'very weak', 'weak', 'fair', 'good', or 'strong'
 *
 * @example
 * getPasswordStrengthLabel('abc') // 'very weak'
 * getPasswordStrengthLabel('password') // 'weak'
 * getPasswordStrengthLabel('MyPassword123') // 'fair'
 * getPasswordStrengthLabel('MyStr0ng!Pass') // 'good'
 * getPasswordStrengthLabel('V3ry$tr0ng!P@ssw0rd') // 'strong'
 */
export const getPasswordStrengthLabel = (
  password: string
): 'very weak' | 'weak' | 'fair' | 'good' | 'strong' => {
  const strength = getPasswordStrength(password);

  switch (strength) {
    case 0:
      return 'very weak';
    case 1:
      return 'weak';
    case 2:
      return 'fair';
    case 3:
      return 'good';
    case 4:
      return 'strong';
    default:
      return 'very weak';
  }
};

/**
 * Checks if a password is acceptable for repo creation/login.
 * Currently just checks minimum length, but can be extended.
 *
 * @param password - Password to check
 * @returns Validation result
 *
 * @example
 * isPasswordAcceptable('test') // { valid: true, error: 'valid' }
 * isPasswordAcceptable('abc') // { valid: false, error: 'too_short', message: '...' }
 */
export const isPasswordAcceptable = (
  password: string
): PasswordValidationResult => {
  return validatePasswordDetailed(password);
};
