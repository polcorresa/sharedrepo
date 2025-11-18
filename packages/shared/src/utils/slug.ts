import { repoSlugSchema } from '../contracts/repos.js';

/**
 * Regular expression for valid slugs:
 * - Only lowercase letters (a-z) and digits (0-9)
 * - Length between 1 and 20 characters
 */
const SLUG_REGEX = /^[a-z0-9]{1,20}$/;

/**
 * Maximum allowed slug length
 */
export const MAX_SLUG_LENGTH = 20;

/**
 * Minimum allowed slug length
 */
export const MIN_SLUG_LENGTH = 1;

/**
 * Validation error types for slugs
 */
export type SlugValidationError =
  | 'empty'
  | 'too_short'
  | 'too_long'
  | 'invalid_characters'
  | 'valid';

/**
 * Result of slug validation with detailed error information
 */
export interface SlugValidationResult {
  valid: boolean;
  error?: SlugValidationError;
  message?: string;
  normalized?: string;
}

/**
 * Normalizes a slug to lowercase and trims whitespace.
 * Does NOT validate - use validateAndNormalize for validation + normalization.
 *
 * @param input - Raw slug input
 * @returns Normalized slug (lowercase, trimmed)
 *
 * @example
 * normalizeSlug('MyRepo') // 'myrepo'
 * normalizeSlug('  test  ') // 'test'
 * normalizeSlug('TEST123') // 'test123'
 */
export const normalizeSlug = (input: string): string => {
  return input.trim().toLowerCase();
};

/**
 * Checks if a normalized slug is valid.
 * Slug must be lowercase a-z and digits 0-9 only, length 1-20.
 *
 * @param slug - Normalized slug to check (should already be lowercase)
 * @returns true if slug matches validation rules
 *
 * @example
 * isSlugValid('myrepo') // true
 * isSlugValid('test123') // true
 * isSlugValid('My-Repo') // false (uppercase and hyphen)
 * isSlugValid('') // false (empty)
 * isSlugValid('a'.repeat(21)) // false (too long)
 */
export const isSlugValid = (slug: string): boolean => {
  return SLUG_REGEX.test(slug);
};

/**
 * Validates a slug using Zod schema.
 * Throws ZodError if validation fails.
 *
 * @param slug - Slug to validate
 * @returns Validated slug
 * @throws {ZodError} If slug is invalid
 *
 * @example
 * validateSlug('myrepo') // 'myrepo'
 * validateSlug('invalid!') // throws ZodError
 */
export const validateSlug = (slug: string): string => {
  return repoSlugSchema.parse(slug);
};

/**
 * Validates a slug with detailed error information.
 * Does NOT normalize - checks the slug as-is.
 *
 * @param slug - Slug to validate
 * @returns Detailed validation result
 *
 * @example
 * validateSlugDetailed('myrepo')
 * // { valid: true, error: 'valid', normalized: 'myrepo' }
 *
 * validateSlugDetailed('My-Repo!')
 * // { valid: false, error: 'invalid_characters', message: '...' }
 *
 * validateSlugDetailed('')
 * // { valid: false, error: 'empty', message: 'Slug cannot be empty' }
 */
export const validateSlugDetailed = (slug: string): SlugValidationResult => {
  // Check if empty
  if (!slug || slug.length === 0) {
    return {
      valid: false,
      error: 'empty',
      message: 'Slug cannot be empty',
    };
  }

  // Check length
  if (slug.length < MIN_SLUG_LENGTH) {
    return {
      valid: false,
      error: 'too_short',
      message: `Slug must be at least ${MIN_SLUG_LENGTH} character`,
    };
  }

  if (slug.length > MAX_SLUG_LENGTH) {
    return {
      valid: false,
      error: 'too_long',
      message: `Slug must be at most ${MAX_SLUG_LENGTH} characters`,
    };
  }

  // Check for invalid characters
  if (!SLUG_REGEX.test(slug)) {
    return {
      valid: false,
      error: 'invalid_characters',
      message: 'Slug can only contain lowercase letters (a-z) and digits (0-9)',
    };
  }

  return {
    valid: true,
    error: 'valid',
    normalized: slug,
  };
};

/**
 * Normalizes and validates a slug in one operation.
 * This is the recommended function for user input processing.
 *
 * @param input - Raw slug input
 * @returns Validation result with normalized slug
 *
 * @example
 * validateAndNormalize('MyRepo')
 * // { valid: true, error: 'valid', normalized: 'myrepo' }
 *
 * validateAndNormalize('  TEST123  ')
 * // { valid: true, error: 'valid', normalized: 'test123' }
 *
 * validateAndNormalize('my-repo!')
 * // { valid: false, error: 'invalid_characters', message: '...' }
 *
 * validateAndNormalize('a'.repeat(25))
 * // { valid: false, error: 'too_long', message: '...' }
 */
export const validateAndNormalize = (input: string): SlugValidationResult => {
  const normalized = normalizeSlug(input);
  const result = validateSlugDetailed(normalized);

  return {
    ...result,
    normalized,
  };
};

/**
 * Sanitizes a slug by removing invalid characters and truncating to max length.
 * Returns a valid slug or empty string if no valid characters remain.
 *
 * Use this when you want to coerce invalid input into valid slug format.
 *
 * @param input - Raw slug input
 * @returns Sanitized slug (may be empty if no valid characters)
 *
 * @example
 * sanitizeSlug('My-Repo!') // 'myrepo'
 * sanitizeSlug('test_123') // 'test123'
 * sanitizeSlug('!!!') // ''
 * sanitizeSlug('a'.repeat(25)) // 'aaaaa...' (20 chars)
 * sanitizeSlug('  Hello World  ') // 'helloworld'
 */
export const sanitizeSlug = (input: string): string => {
  // Normalize first
  let sanitized = normalizeSlug(input);

  // Remove all non-alphanumeric characters
  sanitized = sanitized.replace(/[^a-z0-9]/g, '');

  // Truncate to max length
  if (sanitized.length > MAX_SLUG_LENGTH) {
    sanitized = sanitized.slice(0, MAX_SLUG_LENGTH);
  }

  return sanitized;
};

/**
 * Generates a suggested slug from arbitrary input text.
 * Useful for converting titles or names into valid slugs.
 *
 * @param input - Input text to convert
 * @param fallback - Fallback slug if sanitization produces empty string
 * @returns Valid slug
 *
 * @example
 * suggestSlug('My Awesome Repo') // 'myawesomerepo'
 * suggestSlug('Test-Project_2024') // 'testproject2024'
 * suggestSlug('!!!', 'repo') // 'repo'
 * suggestSlug('a'.repeat(30)) // 'aaaaa...' (20 chars)
 */
export const suggestSlug = (input: string, fallback = 'repo'): string => {
  const sanitized = sanitizeSlug(input);

  // If sanitization produced empty string, use fallback
  if (sanitized.length === 0) {
    return sanitizeSlug(fallback) || 'repo';
  }

  return sanitized;
};
