# Password Policy Validator

## Overview

Simple password validation utilities for repo passwords in `sharedrepo.com`. Minimal requirements with optional strength indicators for UX.

## Rules

Repo passwords must follow these rules:
- **Minimum length**: 4 characters
- **Maximum length**: 128 characters
- **No complexity requirements**: Any characters allowed (letters, digits, symbols, spaces, etc.)
- **No forbidden patterns**: No blacklist of common passwords (by design)

## Design Philosophy

Passwords in `sharedrepo.com` are **shared repo passwords**, not personal account passwords:
- Shared among collaborators
- Used only for repo access
- Not tied to user identity
- Ephemeral (repo expires after 7 days of inactivity)

Therefore, we use **minimal restrictions** (4 chars) to avoid friction while preventing trivially weak passwords.

## Functions

### `isPasswordValid(password: string): boolean`

Quick boolean check if password meets minimum length.

```typescript
import { isPasswordValid } from '@sharedrepo/shared';

isPasswordValid('test');        // true (4 chars)
isPasswordValid('secret');      // true
isPasswordValid('abc');         // false (3 chars)
isPasswordValid('');            // false (empty)
```

**Use case**: Quick validation check before form submission.

---

### `validatePassword(password: string): string`

Validates a password using Zod schema. Throws `ZodError` if invalid.

```typescript
import { validatePassword } from '@sharedrepo/shared';

try {
  const password = validatePassword('secret123');  // 'secret123'
} catch (error) {
  // Handle ZodError
  console.error(error.issues);
}
```

**Use case**: Strict validation with Zod error details.

---

### `validatePasswordDetailed(password: string): PasswordValidationResult`

Validates a password with detailed error information.

```typescript
import { validatePasswordDetailed } from '@sharedrepo/shared';

// Valid password
validatePasswordDetailed('test');
// { valid: true, error: 'valid' }

// Too short
validatePasswordDetailed('abc');
// {
//   valid: false,
//   error: 'too_short',
//   message: 'Password must be at least 4 characters'
// }

// Empty
validatePasswordDetailed('');
// { valid: false, error: 'empty', message: 'Password cannot be empty' }

// Too long
validatePasswordDetailed('a'.repeat(129));
// { valid: false, error: 'too_long', message: 'Password must be at most 128 characters' }
```

**Return type:**

```typescript
interface PasswordValidationResult {
  valid: boolean;
  error?: 'empty' | 'too_short' | 'too_long' | 'valid';
  message?: string;
}
```

**Use case**: Detailed validation feedback for user interfaces.

---

### `isPasswordAcceptable(password: string): PasswordValidationResult`

Alias for `validatePasswordDetailed`. Checks if password is acceptable for repo creation/login.

```typescript
import { isPasswordAcceptable } from '@sharedrepo/shared';

const result = isPasswordAcceptable(userInput);

if (result.valid) {
  createRepo(slug, password);
} else {
  showError(result.message);
}
```

**Use case**: Semantic alias for repo password validation.

---

### `getPasswordStrength(password: string): number`

Calculates a rough password strength score from 0 to 4.

**This is NOT a security requirement** - it's purely a UX hint to help users choose better passwords.

```typescript
import { getPasswordStrength } from '@sharedrepo/shared';

getPasswordStrength('abc');                // 0 (very weak)
getPasswordStrength('password');           // 1-2 (weak)
getPasswordStrength('Password123');        // 2-3 (fair)
getPasswordStrength('MyPassword123');      // 3-4 (good)
getPasswordStrength('MyStr0ng!P@ssw0rd');  // 4 (strong)
```

**Scoring factors:**
- Length (6, 8, 12, 16+ chars add points)
- Variety (lowercase, uppercase, digits, special chars)
- Combination bonus (good variety + length boosts score)

**Use case**: Show strength indicator in UI during password entry.

---

### `getPasswordStrengthLabel(password: string): string`

Returns human-readable strength label.

```typescript
import { getPasswordStrengthLabel } from '@sharedrepo/shared';

getPasswordStrengthLabel('abc');                // 'very weak'
getPasswordStrengthLabel('password');           // 'weak'
getPasswordStrengthLabel('Password123');        // 'fair'
getPasswordStrengthLabel('MyPassword123');      // 'good'
getPasswordStrengthLabel('MyStr0ng!P@ssw0rd');  // 'strong'
```

**Labels:**
- Score 0: `'very weak'`
- Score 1: `'weak'`
- Score 2: `'fair'`
- Score 3: `'good'`
- Score 4: `'strong'`

**Use case**: Display strength text next to password input.

---

## Constants

```typescript
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@sharedrepo/shared';

console.log(MIN_PASSWORD_LENGTH);  // 4
console.log(MAX_PASSWORD_LENGTH);  // 128
```

---

## Usage Patterns

### Frontend: Form Validation

```typescript
import { validatePasswordDetailed } from '@sharedrepo/shared';

function handlePasswordInput(password: string) {
  const result = validatePasswordDetailed(password);
  
  if (result.valid) {
    // Valid password
    setPasswordError(null);
  } else {
    // Show error message
    setPasswordError(result.message);
  }
}
```

### Frontend: Strength Indicator

```typescript
import { 
  validatePasswordDetailed,
  getPasswordStrength,
  getPasswordStrengthLabel 
} from '@sharedrepo/shared';

function PasswordInput() {
  const [password, setPassword] = useState('');
  
  const validation = validatePasswordDetailed(password);
  const strength = getPasswordStrength(password);
  const strengthLabel = getPasswordStrengthLabel(password);
  
  return (
    <div>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      
      {!validation.valid && (
        <div className="error">{validation.message}</div>
      )}
      
      {validation.valid && (
        <div className={`strength-${strength}`}>
          Password strength: {strengthLabel}
        </div>
      )}
    </div>
  );
}
```

### Backend: API Endpoint

```typescript
import { validatePasswordDetailed } from '@sharedrepo/shared';

app.post('/api/repos', async (req, res) => {
  const { slug, password } = req.body;
  
  const result = validatePasswordDetailed(password);
  
  if (!result.valid) {
    return res.status(400).json({
      error: 'Invalid password',
      details: result.message,
    });
  }
  
  // Hash and store password
  const hashedPassword = await bcrypt.hash(password, 10);
  const repo = await createRepo(slug, hashedPassword);
  
  res.json(repo);
});
```

### Backend: Quick Check

```typescript
import { isPasswordValid } from '@sharedrepo/shared';

function validateRepoInput(slug: string, password: string) {
  if (!isSlugValid(slug)) {
    throw new BadRequestError('Invalid slug');
  }
  
  if (!isPasswordValid(password)) {
    throw new BadRequestError('Password must be at least 4 characters');
  }
  
  // Proceed with repo creation
}
```

---

## Error Handling

### Detailed Validation Errors

```typescript
import { validatePasswordDetailed } from '@sharedrepo/shared';

const result = validatePasswordDetailed(userInput);

switch (result.error) {
  case 'valid':
    // Success!
    break;
    
  case 'empty':
    showError('Please enter a password');
    break;
    
  case 'too_short':
    showError('Password must be at least 4 characters');
    break;
    
  case 'too_long':
    showError('Password is too long (max 128 characters)');
    break;
}
```

### Zod Validation Errors

```typescript
import { validatePassword } from '@sharedrepo/shared';
import { ZodError } from 'zod';

try {
  const password = validatePassword(input);
  // Success
} catch (error) {
  if (error instanceof ZodError) {
    // Access detailed Zod error info
    console.log(error.issues);
    console.log(error.flatten());
  }
}
```

---

## Examples

### Example 1: Create Repo with Password

```typescript
import { 
  validateAndNormalize as validateSlug,
  validatePasswordDetailed 
} from '@sharedrepo/shared';

function createRepo(slugInput: string, passwordInput: string) {
  // Validate slug
  const slugResult = validateSlug(slugInput);
  if (!slugResult.valid) {
    throw new Error(`Invalid slug: ${slugResult.message}`);
  }
  
  // Validate password
  const passwordResult = validatePasswordDetailed(passwordInput);
  if (!passwordResult.valid) {
    throw new Error(`Invalid password: ${passwordResult.message}`);
  }
  
  // Both valid - proceed
  const repo = await repoRepo.create({
    slug: slugResult.normalized,
    password_hash: await hashPassword(passwordInput),
  });
  
  return repo;
}
```

### Example 2: Password Strength UI Component

```typescript
import { 
  getPasswordStrength,
  getPasswordStrengthLabel 
} from '@sharedrepo/shared';

function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const label = getPasswordStrengthLabel(password);
  
  const colors = {
    0: 'red',
    1: 'orange',
    2: 'yellow',
    3: 'lightgreen',
    4: 'green',
  };
  
  return (
    <div className="strength-meter">
      <div className="strength-bar">
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className="strength-segment"
            style={{
              backgroundColor: level <= strength ? colors[strength] : 'gray',
            }}
          />
        ))}
      </div>
      <span className="strength-label">
        Strength: {label}
      </span>
    </div>
  );
}
```

### Example 3: Combined Slug + Password Validation

```typescript
import { 
  validateAndNormalize,
  validatePasswordDetailed 
} from '@sharedrepo/shared';

interface CreateRepoForm {
  slug: string;
  password: string;
  confirmPassword: string;
}

function validateCreateRepoForm(form: CreateRepoForm) {
  const errors: Record<string, string> = {};
  
  // Validate slug
  const slugResult = validateAndNormalize(form.slug);
  if (!slugResult.valid) {
    errors.slug = slugResult.message!;
  }
  
  // Validate password
  const passwordResult = validatePasswordDetailed(form.password);
  if (!passwordResult.valid) {
    errors.password = passwordResult.message!;
  }
  
  // Check password confirmation
  if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    slug: slugResult.normalized,
  };
}
```

---

## Testing

Run tests:

```bash
cd packages/shared
pnpm test:unit
```

Password utilities have comprehensive test coverage (46 tests) including:
- Minimum/maximum length validation
- Empty password detection
- Zod schema validation
- Strength scoring algorithm
- Strength labels
- Edge cases (unicode, whitespace, special chars)
- Real-world password patterns

---

## Best Practices

1. **Always validate on both client and server**
   - Client: Immediate user feedback
   - Server: Security validation (never trust client)

2. **Hash passwords before storage**
   - Use bcrypt or argon2
   - Never store plaintext passwords

3. **Don't enforce complexity on shared passwords**
   - Repo passwords are shared, not personal
   - Minimal requirements reduce friction

4. **Use strength indicator as UX hint only**
   - Don't block weak passwords (user's choice)
   - Just inform users about strength

5. **Provide clear error messages**
   - Use `validatePasswordDetailed` for user-facing errors
   - Show exactly what's wrong (too short, etc.)

---

## Security Notes

- **No password reset mechanism** - if forgotten, repo is inaccessible
- **No password change feature** - password set at creation is permanent
- **Shared passwords** - multiple collaborators use same password
- **Ephemeral repos** - passwords only matter for 7-day repo lifetime
- **Always hash** - use bcrypt/argon2 before storage
- **No logging** - never log passwords in plaintext

---

## Comparison with Traditional Password Policies

**Traditional (user accounts):**
- Min 8-12 characters
- Require uppercase, lowercase, digit, symbol
- Password history
- Expiration/rotation
- Recovery mechanisms

**sharedrepo.com (shared repos):**
- Min 4 characters ✅
- No complexity requirements ✅
- No history tracking ✅
- No expiration ✅
- No recovery ✅

**Why the difference?**
- Not tied to user identity
- Shared among team (complexity creates friction)
- Ephemeral (7 days max)
- Low-stakes (just code collaboration, no PII)

---

## Migration from Old Code

**Before:**
```typescript
if (password.length < 4) {
  throw new Error('Password too short');
}
```

**After:**
```typescript
import { validatePasswordDetailed } from '@sharedrepo/shared';

const result = validatePasswordDetailed(password);
if (!result.valid) {
  throw new Error(result.message);
}
```

---

## Type Safety

All functions are fully typed with TypeScript:

```typescript
// Inferred types
const isValid: boolean = isPasswordValid('test');
const result: PasswordValidationResult = validatePasswordDetailed('test');
const strength: number = getPasswordStrength('test');
const label: 'very weak' | 'weak' | 'fair' | 'good' | 'strong' = 
  getPasswordStrengthLabel('test');

// Type-safe error discrimination
if (result.error === 'too_short') {
  console.log(result.message);  // string | undefined (narrowed to string)
}
```

---

Use these utilities consistently across frontend and backend for reliable password handling!
