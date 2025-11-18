import { describe, it, expect } from 'vitest';
import {
  isPasswordValid,
  validatePassword,
  validatePasswordDetailed,
  getPasswordStrength,
  getPasswordStrengthLabel,
  isPasswordAcceptable,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from './password.js';
import { ZodError } from 'zod';

describe('isPasswordValid', () => {
  it('accepts passwords meeting minimum length', () => {
    expect(isPasswordValid('test')).toBe(true); // 4 chars
    expect(isPasswordValid('abcd')).toBe(true);
    expect(isPasswordValid('12345')).toBe(true);
    expect(isPasswordValid('secret')).toBe(true);
    expect(isPasswordValid('a'.repeat(4))).toBe(true);
  });

  it('rejects passwords below minimum length', () => {
    expect(isPasswordValid('abc')).toBe(false); // 3 chars
    expect(isPasswordValid('ab')).toBe(false);
    expect(isPasswordValid('a')).toBe(false);
    expect(isPasswordValid('')).toBe(false);
  });

  it('accepts long passwords', () => {
    expect(isPasswordValid('a'.repeat(50))).toBe(true);
    expect(isPasswordValid('a'.repeat(128))).toBe(true);
  });
});

describe('validatePassword', () => {
  it('returns valid passwords unchanged', () => {
    expect(validatePassword('test')).toBe('test');
    expect(validatePassword('secret123')).toBe('secret123');
    expect(validatePassword('MyP@ssw0rd!')).toBe('MyP@ssw0rd!');
  });

  it('throws ZodError for invalid passwords', () => {
    expect(() => validatePassword('')).toThrow(ZodError);
    expect(() => validatePassword('abc')).toThrow(ZodError);
    expect(() => validatePassword('ab')).toThrow(ZodError);
  });

  it('throws ZodError for too long passwords', () => {
    expect(() => validatePassword('a'.repeat(129))).toThrow(ZodError);
    expect(() => validatePassword('a'.repeat(200))).toThrow(ZodError);
  });
});

describe('validatePasswordDetailed', () => {
  describe('valid passwords', () => {
    it('returns valid for correct passwords', () => {
      const result = validatePasswordDetailed('test');
      expect(result.valid).toBe(true);
      expect(result.error).toBe('valid');
    });

    it('accepts minimum length', () => {
      const result = validatePasswordDetailed('abcd');
      expect(result.valid).toBe(true);
    });

    it('accepts long passwords', () => {
      const result = validatePasswordDetailed('a'.repeat(50));
      expect(result.valid).toBe(true);
    });

    it('accepts maximum length', () => {
      const result = validatePasswordDetailed('a'.repeat(128));
      expect(result.valid).toBe(true);
    });

    it('accepts special characters', () => {
      const result = validatePasswordDetailed('P@ssw0rd!');
      expect(result.valid).toBe(true);
    });

    it('accepts spaces', () => {
      const result = validatePasswordDetailed('my password');
      expect(result.valid).toBe(true);
    });
  });

  describe('empty passwords', () => {
    it('detects empty string', () => {
      const result = validatePasswordDetailed('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('empty');
      expect(result.message).toContain('empty');
    });
  });

  describe('too short passwords', () => {
    it('detects 3 character password', () => {
      const result = validatePasswordDetailed('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('too_short');
      expect(result.message).toContain('4');
    });

    it('detects 2 character password', () => {
      const result = validatePasswordDetailed('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('too_short');
    });

    it('detects 1 character password', () => {
      const result = validatePasswordDetailed('a');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('too_short');
    });
  });

  describe('too long passwords', () => {
    it('detects passwords over max length', () => {
      const result = validatePasswordDetailed('a'.repeat(129));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('too_long');
      expect(result.message).toContain('128');
    });

    it('detects very long passwords', () => {
      const result = validatePasswordDetailed('a'.repeat(500));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('too_long');
    });
  });
});

describe('getPasswordStrength', () => {
  it('rates very short passwords as 0', () => {
    expect(getPasswordStrength('abc')).toBe(0);
    expect(getPasswordStrength('test')).toBe(0);
    expect(getPasswordStrength('12345')).toBe(0);
  });

  it('rates simple passwords as 1-2', () => {
    // 8 chars = score 2, but no variety keeps it lower
    expect(getPasswordStrength('password')).toBeGreaterThanOrEqual(1);
    expect(getPasswordStrength('test1234')).toBeGreaterThanOrEqual(1);
    expect(getPasswordStrength('abcdefgh')).toBeGreaterThanOrEqual(1);
  });

  it('rates medium passwords as 2-3', () => {
    // Good length + some variety
    expect(getPasswordStrength('Password123')).toBeGreaterThanOrEqual(2);
    expect(getPasswordStrength('mypassword12')).toBeGreaterThanOrEqual(2);
  });

  it('rates good passwords as 3-4', () => {
    // Good length + good variety
    expect(getPasswordStrength('MyPassword123')).toBeGreaterThanOrEqual(3);
    expect(getPasswordStrength('Test@1234567')).toBeGreaterThanOrEqual(3);
  });

  it('rates strong passwords as 4', () => {
    expect(getPasswordStrength('MyStr0ng!P@ssw0rd')).toBe(4);
    expect(getPasswordStrength('V3ry$ecure!Pass123')).toBe(4);
    expect(getPasswordStrength('a'.repeat(20))).toBe(4);
  });

  it('considers variety for scoring', () => {
    // Same length, different variety
    const simple = getPasswordStrength('aaaaaaaaaa'); // 10 chars, no variety
    const varied = getPasswordStrength('Aa1!567890'); // 10 chars, all types

    expect(varied).toBeGreaterThan(simple);
  });

  it('caps score at 4', () => {
    expect(getPasswordStrength('a'.repeat(100))).toBeLessThanOrEqual(4);
    expect(getPasswordStrength('V3ry!L0ng@Pass#123$Word%456')).toBe(4);
  });
});

describe('getPasswordStrengthLabel', () => {
  it('returns "very weak" for score 0', () => {
    expect(getPasswordStrengthLabel('abc')).toBe('very weak');
    expect(getPasswordStrengthLabel('test')).toBe('very weak');
  });

  it('returns appropriate labels for different strengths', () => {
    // Very weak
    expect(getPasswordStrengthLabel('abc')).toBe('very weak');
    expect(getPasswordStrengthLabel('test')).toBe('very weak');
    
    // Weak or better
    expect(['weak', 'fair', 'good', 'strong']).toContain(
      getPasswordStrengthLabel('password')
    );
    expect(['weak', 'fair', 'good', 'strong']).toContain(
      getPasswordStrengthLabel('test1234')
    );
    
    // Fair or better
    expect(['fair', 'good', 'strong']).toContain(
      getPasswordStrengthLabel('Password123')
    );
    
    // Good or better
    expect(['good', 'strong']).toContain(
      getPasswordStrengthLabel('MyPassword123')
    );
    
    // Strong
    expect(getPasswordStrengthLabel('MyStr0ng!P@ssw0rd')).toBe('strong');
  });

  it('returns "strong" for score 4', () => {
    expect(getPasswordStrengthLabel('MyStr0ng!P@ssw0rd')).toBe('strong');
  });
});

describe('isPasswordAcceptable', () => {
  it('accepts valid passwords', () => {
    const result = isPasswordAcceptable('test');
    expect(result.valid).toBe(true);
    expect(result.error).toBe('valid');
  });

  it('rejects too short passwords', () => {
    const result = isPasswordAcceptable('abc');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('too_short');
  });

  it('rejects empty passwords', () => {
    const result = isPasswordAcceptable('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('empty');
  });

  it('provides error messages', () => {
    const result = isPasswordAcceptable('ab');
    expect(result.message).toBeDefined();
    expect(result.message).toContain('4');
  });
});

describe('constants', () => {
  it('exports correct min length', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(4);
  });

  it('exports correct max length', () => {
    expect(MAX_PASSWORD_LENGTH).toBe(128);
  });
});

describe('edge cases', () => {
  it('handles whitespace-only passwords', () => {
    expect(isPasswordValid('    ')).toBe(true); // 4 spaces
    expect(isPasswordValid('   ')).toBe(false); // 3 spaces
  });

  it('handles unicode characters', () => {
    expect(isPasswordValid('🔒🔒🔒🔒')).toBe(true); // 4 emoji
    expect(isPasswordValid('café')).toBe(true);
  });

  it('handles newlines and tabs', () => {
    expect(isPasswordValid('test\n')).toBe(true); // 5 chars
    expect(isPasswordValid('\t\t\t\t')).toBe(true); // 4 tabs
  });

  it('handles exactly 4 characters', () => {
    expect(validatePasswordDetailed('abcd').valid).toBe(true);
    expect(validatePasswordDetailed('1234').valid).toBe(true);
  });

  it('handles exactly 128 characters', () => {
    const password = 'a'.repeat(128);
    expect(validatePasswordDetailed(password).valid).toBe(true);
  });

  it('handles 129 characters', () => {
    const password = 'a'.repeat(129);
    expect(validatePasswordDetailed(password).valid).toBe(false);
    expect(validatePasswordDetailed(password).error).toBe('too_long');
  });
});

describe('real-world scenarios', () => {
  it('accepts common password patterns', () => {
    expect(isPasswordValid('password')).toBe(true);
    expect(isPasswordValid('123456')).toBe(true);
    expect(isPasswordValid('test1234')).toBe(true);
  });

  it('accepts secure passwords', () => {
    expect(isPasswordValid('MySecureP@ssw0rd!')).toBe(true);
    expect(isPasswordValid('correct-horse-battery-staple')).toBe(true);
  });

  it('provides helpful feedback for UI', () => {
    const result = validatePasswordDetailed('ab');
    expect(result.message).toBeTruthy();
    expect(typeof result.message).toBe('string');
  });

  it('strength indicator works progressively', () => {
    const passwords = [
      'abc',        // 0 - very weak
      'password',   // 1 - weak
      'Password1',  // 2 - fair
      'MyPass123!', // 3 - good
      'MyStr0ng!Pass#123', // 4 - strong
    ];

    const strengths = passwords.map(getPasswordStrength);

    // Each should be greater than or equal to previous
    for (let i = 1; i < strengths.length; i++) {
      expect(strengths[i]).toBeGreaterThanOrEqual(strengths[i - 1]);
    }
  });
});

describe('integration with validation result', () => {
  it('combines validation with strength indicator', () => {
    const password = 'test';
    const validation = validatePasswordDetailed(password);
    const strength = getPasswordStrength(password);
    const label = getPasswordStrengthLabel(password);

    expect(validation.valid).toBe(true);
    expect(strength).toBeGreaterThanOrEqual(0);
    expect(label).toBe('very weak');
  });

  it('shows invalid passwords have no meaningful strength', () => {
    const password = 'ab';
    const validation = validatePasswordDetailed(password);

    expect(validation.valid).toBe(false);
    // Strength can still be calculated, but password is invalid
    expect(getPasswordStrength(password)).toBe(0);
  });
});
