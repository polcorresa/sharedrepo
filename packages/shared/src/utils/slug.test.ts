import { describe, it, expect } from 'vitest';
import {
  normalizeSlug,
  isSlugValid,
  validateSlug,
  validateSlugDetailed,
  validateAndNormalize,
  sanitizeSlug,
  suggestSlug,
  MAX_SLUG_LENGTH,
  MIN_SLUG_LENGTH,
} from './slug.js';
import { ZodError } from 'zod';

describe('normalizeSlug', () => {
  it('converts uppercase to lowercase', () => {
    expect(normalizeSlug('MyRepo')).toBe('myrepo');
    expect(normalizeSlug('TEST')).toBe('test');
    expect(normalizeSlug('MixedCase123')).toBe('mixedcase123');
  });

  it('trims whitespace', () => {
    expect(normalizeSlug('  test  ')).toBe('test');
    expect(normalizeSlug('\ttest\t')).toBe('test');
    expect(normalizeSlug('\ntest\n')).toBe('test');
  });

  it('preserves digits', () => {
    expect(normalizeSlug('test123')).toBe('test123');
    expect(normalizeSlug('123test')).toBe('123test');
    expect(normalizeSlug('123')).toBe('123');
  });

  it('does not remove invalid characters (normalization only)', () => {
    expect(normalizeSlug('test-repo')).toBe('test-repo');
    expect(normalizeSlug('test_repo')).toBe('test_repo');
    expect(normalizeSlug('test!repo')).toBe('test!repo');
  });
});

describe('isSlugValid', () => {
  it('accepts valid slugs', () => {
    expect(isSlugValid('myrepo')).toBe(true);
    expect(isSlugValid('test123')).toBe(true);
    expect(isSlugValid('a')).toBe(true);
    expect(isSlugValid('123')).toBe(true);
    expect(isSlugValid('a'.repeat(20))).toBe(true);
  });

  it('rejects uppercase letters', () => {
    expect(isSlugValid('MyRepo')).toBe(false);
    expect(isSlugValid('TEST')).toBe(false);
    expect(isSlugValid('Test123')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isSlugValid('test-repo')).toBe(false);
    expect(isSlugValid('test_repo')).toBe(false);
    expect(isSlugValid('test.repo')).toBe(false);
    expect(isSlugValid('test!repo')).toBe(false);
    expect(isSlugValid('test@repo')).toBe(false);
    expect(isSlugValid('test#repo')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(isSlugValid('test repo')).toBe(false);
    expect(isSlugValid(' test')).toBe(false);
    expect(isSlugValid('test ')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isSlugValid('')).toBe(false);
  });

  it('rejects slugs that are too long', () => {
    expect(isSlugValid('a'.repeat(21))).toBe(false);
    expect(isSlugValid('a'.repeat(25))).toBe(false);
    expect(isSlugValid('a'.repeat(100))).toBe(false);
  });
});

describe('validateSlug', () => {
  it('returns valid slugs unchanged', () => {
    expect(validateSlug('myrepo')).toBe('myrepo');
    expect(validateSlug('test123')).toBe('test123');
    expect(validateSlug('a')).toBe('a');
  });

  it('throws ZodError for invalid slugs', () => {
    expect(() => validateSlug('')).toThrow(ZodError);
    expect(() => validateSlug('MyRepo')).toThrow(ZodError);
    expect(() => validateSlug('test-repo')).toThrow(ZodError);
    expect(() => validateSlug('a'.repeat(21))).toThrow(ZodError);
  });
});

describe('validateSlugDetailed', () => {
  describe('valid slugs', () => {
    it('returns valid for correct slugs', () => {
      const result = validateSlugDetailed('myrepo');
      expect(result.valid).toBe(true);
      expect(result.error).toBe('valid');
      expect(result.normalized).toBe('myrepo');
    });

    it('accepts digits only', () => {
      const result = validateSlugDetailed('123');
      expect(result.valid).toBe(true);
    });

    it('accepts max length', () => {
      const result = validateSlugDetailed('a'.repeat(20));
      expect(result.valid).toBe(true);
    });
  });

  describe('empty slugs', () => {
    it('detects empty string', () => {
      const result = validateSlugDetailed('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('empty');
      expect(result.message).toContain('empty');
    });
  });

  describe('length validation', () => {
    it('detects too long slugs', () => {
      const result = validateSlugDetailed('a'.repeat(21));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('too_long');
      expect(result.message).toContain('20');
    });

    it('detects way too long slugs', () => {
      const result = validateSlugDetailed('a'.repeat(100));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('too_long');
    });
  });

  describe('invalid characters', () => {
    it('detects uppercase letters', () => {
      const result = validateSlugDetailed('MyRepo');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('invalid_characters');
      expect(result.message).toContain('lowercase');
    });

    it('detects hyphens', () => {
      const result = validateSlugDetailed('test-repo');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('invalid_characters');
    });

    it('detects underscores', () => {
      const result = validateSlugDetailed('test_repo');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('invalid_characters');
    });

    it('detects special characters', () => {
      const result = validateSlugDetailed('test!repo');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('invalid_characters');
    });

    it('detects spaces', () => {
      const result = validateSlugDetailed('test repo');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('invalid_characters');
    });
  });
});

describe('validateAndNormalize', () => {
  it('normalizes and validates valid input', () => {
    const result = validateAndNormalize('MyRepo');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('myrepo');
    expect(result.error).toBe('valid');
  });

  it('trims and normalizes', () => {
    const result = validateAndNormalize('  TEST123  ');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('test123');
  });

  it('detects invalid characters after normalization', () => {
    const result = validateAndNormalize('My-Repo');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_characters');
    expect(result.normalized).toBe('my-repo');
  });

  it('detects too long after normalization', () => {
    const result = validateAndNormalize('A'.repeat(25));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('too_long');
    expect(result.normalized).toBe('a'.repeat(25));
  });

  it('detects empty after trimming', () => {
    const result = validateAndNormalize('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('empty');
    expect(result.normalized).toBe('');
  });
});

describe('sanitizeSlug', () => {
  it('removes invalid characters', () => {
    expect(sanitizeSlug('My-Repo')).toBe('myrepo');
    expect(sanitizeSlug('test_123')).toBe('test123');
    expect(sanitizeSlug('test!@#repo')).toBe('testrepo');
  });

  it('removes spaces', () => {
    expect(sanitizeSlug('Hello World')).toBe('helloworld');
    expect(sanitizeSlug('test repo 123')).toBe('testrepo123');
  });

  it('truncates to max length', () => {
    expect(sanitizeSlug('a'.repeat(25))).toBe('a'.repeat(20));
    expect(sanitizeSlug('a'.repeat(30))).toBe('a'.repeat(20));
  });

  it('handles all invalid characters', () => {
    expect(sanitizeSlug('!!!')).toBe('');
    expect(sanitizeSlug('---')).toBe('');
    expect(sanitizeSlug('___')).toBe('');
  });

  it('preserves valid characters', () => {
    expect(sanitizeSlug('abc123')).toBe('abc123');
    expect(sanitizeSlug('test')).toBe('test');
  });

  it('combines normalization with sanitization', () => {
    expect(sanitizeSlug('My-Awesome_Repo!')).toBe('myawesomerepo');
    expect(sanitizeSlug('  Test-Project_2024  ')).toBe('testproject2024');
  });

  it('handles unicode and special characters', () => {
    expect(sanitizeSlug('café')).toBe('caf'); // removes é
    expect(sanitizeSlug('test™')).toBe('test');
    expect(sanitizeSlug('hello©world')).toBe('helloworld');
  });
});

describe('suggestSlug', () => {
  it('suggests valid slugs from arbitrary input', () => {
    expect(suggestSlug('My Awesome Repo')).toBe('myawesomerepo');
    expect(suggestSlug('Test-Project_2024')).toBe('testproject2024');
  });

  it('uses fallback for all-invalid input', () => {
    expect(suggestSlug('!!!')).toBe('repo');
    expect(suggestSlug('---')).toBe('repo');
    expect(suggestSlug('   ')).toBe('repo');
  });

  it('accepts custom fallback', () => {
    expect(suggestSlug('!!!', 'myrepo')).toBe('myrepo');
    expect(suggestSlug('---', 'test123')).toBe('test123');
  });

  it('truncates long input', () => {
    expect(suggestSlug('a'.repeat(30))).toBe('a'.repeat(20));
  });

  it('handles mixed valid and invalid characters', () => {
    expect(suggestSlug('Hello_World-2024!')).toBe('helloworld2024');
  });

  it('sanitizes fallback if needed', () => {
    expect(suggestSlug('!!!', 'My-Fallback')).toBe('myfallback');
  });

  it('uses default fallback if custom fallback is invalid', () => {
    expect(suggestSlug('!!!', '---')).toBe('repo');
  });
});

describe('constants', () => {
  it('exports correct max length', () => {
    expect(MAX_SLUG_LENGTH).toBe(20);
  });

  it('exports correct min length', () => {
    expect(MIN_SLUG_LENGTH).toBe(1);
  });
});

describe('edge cases', () => {
  it('handles very long strings efficiently', () => {
    const longString = 'a'.repeat(10000);
    const result = sanitizeSlug(longString);
    expect(result.length).toBe(20);
  });

  it('handles strings with only spaces', () => {
    expect(sanitizeSlug('     ')).toBe('');
    expect(suggestSlug('     ')).toBe('repo');
  });

  it('handles numeric-only slugs', () => {
    expect(isSlugValid('123456')).toBe(true);
    expect(validateAndNormalize('123456').valid).toBe(true);
  });

  it('handles single character slugs', () => {
    expect(isSlugValid('a')).toBe(true);
    expect(isSlugValid('1')).toBe(true);
    expect(validateAndNormalize('a').valid).toBe(true);
  });
});

describe('real-world scenarios', () => {
  it('validates common repo name patterns', () => {
    expect(validateAndNormalize('myproject').valid).toBe(true);
    expect(validateAndNormalize('test123').valid).toBe(true);
    expect(validateAndNormalize('app2024').valid).toBe(true);
  });

  it('suggests valid slugs from user input', () => {
    expect(suggestSlug('My New Project')).toBe('mynewproject');
    expect(suggestSlug('Backend-API-v2')).toBe('backendapiv2');
    expect(suggestSlug('frontend_app')).toBe('frontendapp');
  });

  it('handles URL-like input', () => {
    expect(sanitizeSlug('https://example.com')).toBe('httpsexamplecom');
    expect(suggestSlug('www.test.com')).toBe('wwwtestcom');
  });

  it('handles file-like input', () => {
    expect(sanitizeSlug('my-project.git')).toBe('myprojectgit');
    expect(suggestSlug('test_file.txt')).toBe('testfiletxt');
  });
});
