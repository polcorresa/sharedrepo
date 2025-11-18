# Slug Validator & Normalizer

## Overview

Comprehensive slug validation, normalization, and sanitization utilities for repo slugs in `sharedrepo.com`.

## Rules

Repo slugs must follow these rules:
- **Characters**: Only lowercase letters (`a-z`) and digits (`0-9`)
- **Length**: 1-20 characters
- **No uppercase**: Must be lowercase
- **No special characters**: No hyphens, underscores, spaces, or punctuation
- **Case-insensitive matching**: Slugs are normalized to lowercase for comparison

## Functions

### `normalizeSlug(input: string): string`

Normalizes a slug to lowercase and trims whitespace. Does NOT validate.

```typescript
import { normalizeSlug } from '@sharedrepo/shared';

normalizeSlug('MyRepo');      // 'myrepo'
normalizeSlug('  test  ');    // 'test'
normalizeSlug('TEST123');     // 'test123'
```

**Use case**: Pre-processing user input before validation.

---

### `isSlugValid(slug: string): boolean`

Checks if a normalized slug is valid. Returns `true` or `false`.

```typescript
import { isSlugValid } from '@sharedrepo/shared';

isSlugValid('myrepo');        // true
isSlugValid('test123');       // true
isSlugValid('My-Repo');       // false (uppercase and hyphen)
isSlugValid('');              // false (empty)
isSlugValid('a'.repeat(21));  // false (too long)
```

**Use case**: Quick boolean checks for pre-validated slugs.

---

### `validateSlug(slug: string): string`

Validates a slug using Zod schema. Throws `ZodError` if invalid.

```typescript
import { validateSlug } from '@sharedrepo/shared';

try {
  const slug = validateSlug('myrepo');  // 'myrepo'
} catch (error) {
  // Handle ZodError
  console.error(error.issues);
}
```

**Use case**: Strict validation with Zod error details.

---

### `validateSlugDetailed(slug: string): SlugValidationResult`

Validates a slug with detailed error information. Does NOT normalize.

```typescript
import { validateSlugDetailed } from '@sharedrepo/shared';

// Valid slug
validateSlugDetailed('myrepo');
// { valid: true, error: 'valid', normalized: 'myrepo' }

// Invalid characters
validateSlugDetailed('My-Repo!');
// {
//   valid: false,
//   error: 'invalid_characters',
//   message: 'Slug can only contain lowercase letters (a-z) and digits (0-9)'
// }

// Empty
validateSlugDetailed('');
// { valid: false, error: 'empty', message: 'Slug cannot be empty' }

// Too long
validateSlugDetailed('a'.repeat(21));
// { valid: false, error: 'too_long', message: 'Slug must be at most 20 characters' }
```

**Return type:**

```typescript
interface SlugValidationResult {
  valid: boolean;
  error?: 'empty' | 'too_short' | 'too_long' | 'invalid_characters' | 'valid';
  message?: string;
  normalized?: string;
}
```

**Use case**: Detailed validation feedback for user interfaces.

---

### `validateAndNormalize(input: string): SlugValidationResult`

**Recommended function for user input processing.**

Normalizes and validates a slug in one operation.

```typescript
import { validateAndNormalize } from '@sharedrepo/shared';

// Valid after normalization
validateAndNormalize('MyRepo');
// { valid: true, error: 'valid', normalized: 'myrepo' }

// With whitespace
validateAndNormalize('  TEST123  ');
// { valid: true, error: 'valid', normalized: 'test123' }

// Invalid characters remain invalid
validateAndNormalize('my-repo!');
// {
//   valid: false,
//   error: 'invalid_characters',
//   message: '...',
//   normalized: 'my-repo!'
// }
```

**Use case**: Primary function for validating user input in forms and APIs.

---

### `sanitizeSlug(input: string): string`

Removes invalid characters and truncates to max length. Returns a valid slug or empty string.

```typescript
import { sanitizeSlug } from '@sharedrepo/shared';

sanitizeSlug('My-Repo!');           // 'myrepo'
sanitizeSlug('test_123');           // 'test123'
sanitizeSlug('!!!');                // ''
sanitizeSlug('a'.repeat(25));       // 'aaaaa...' (20 chars)
sanitizeSlug('  Hello World  ');    // 'helloworld'
```

**Use case**: Coercing invalid input into valid format (e.g., auto-generating slugs).

---

### `suggestSlug(input: string, fallback = 'repo'): string`

Generates a valid slug from arbitrary text. Always returns a valid slug.

```typescript
import { suggestSlug } from '@sharedrepo/shared';

suggestSlug('My Awesome Repo');           // 'myawesomerepo'
suggestSlug('Test-Project_2024');         // 'testproject2024'
suggestSlug('!!!');                       // 'repo' (fallback)
suggestSlug('!!!', 'myrepo');            // 'myrepo' (custom fallback)
suggestSlug('a'.repeat(30));             // 'aaaaa...' (20 chars)
```

**Use case**: Auto-generating slugs from titles, names, or other text input.

---

## Constants

```typescript
import { MAX_SLUG_LENGTH, MIN_SLUG_LENGTH } from '@sharedrepo/shared';

console.log(MAX_SLUG_LENGTH);  // 20
console.log(MIN_SLUG_LENGTH);  // 1
```

---

## Usage Patterns

### Frontend: Form Validation

```typescript
import { validateAndNormalize } from '@sharedrepo/shared';

function handleSlugInput(input: string) {
  const result = validateAndNormalize(input);
  
  if (result.valid) {
    // Use result.normalized
    createRepo(result.normalized);
  } else {
    // Show error message
    showError(result.message);
  }
}
```

### Frontend: Real-time Slug Suggestion

```typescript
import { suggestSlug, validateSlugDetailed } from '@sharedrepo/shared';

function onProjectNameChange(name: string) {
  const suggested = suggestSlug(name);
  setSlugValue(suggested);
  
  const validation = validateSlugDetailed(suggested);
  setIsSlugValid(validation.valid);
}
```

### Backend: API Endpoint

```typescript
import { validateAndNormalize } from '@sharedrepo/shared';

app.post('/api/repos', async (req, res) => {
  const { slug } = req.body;
  
  const result = validateAndNormalize(slug);
  
  if (!result.valid) {
    return res.status(400).json({
      error: 'Invalid slug',
      details: result.message,
    });
  }
  
  // Use result.normalized for DB operations
  const repo = await createRepo(result.normalized);
  res.json(repo);
});
```

### Backend: URL Parameter Validation

```typescript
import { normalizeSlug, isSlugValid } from '@sharedrepo/shared';

app.get('/api/repos/:slug', async (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  
  if (!isSlugValid(slug)) {
    return res.status(400).json({ error: 'Invalid slug' });
  }
  
  const repo = await repoRepo.findBySlug(slug);
  if (!repo) {
    return res.status(404).json({ error: 'Repo not found' });
  }
  
  res.json(repo);
});
```

---

## Error Handling

### Detailed Validation Errors

```typescript
import { validateAndNormalize } from '@sharedrepo/shared';

const result = validateAndNormalize(userInput);

switch (result.error) {
  case 'valid':
    // Success!
    break;
    
  case 'empty':
    showError('Please enter a slug');
    break;
    
  case 'too_long':
    showError('Slug must be 20 characters or less');
    break;
    
  case 'invalid_characters':
    showError('Slug can only contain letters and numbers');
    break;
}
```

### Zod Validation Errors

```typescript
import { validateSlug } from '@sharedrepo/shared';
import { ZodError } from 'zod';

try {
  const slug = validateSlug(input);
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

## Testing

Run tests:

```bash
cd packages/shared
pnpm test:unit
```

All slug utilities have comprehensive test coverage (52 tests) including:
- Normalization edge cases
- Validation rules
- Character filtering
- Length constraints
- Real-world scenarios
- Unicode handling
- Performance with long strings

---

## Best Practices

1. **Always normalize before validation**
   - Use `validateAndNormalize()` instead of manual normalization + validation

2. **Store normalized slugs in database**
   - Use lowercase version for consistent lookups

3. **Provide user feedback**
   - Use `validateSlugDetailed()` for detailed error messages

4. **Auto-suggest slugs**
   - Use `suggestSlug()` to generate from project names

5. **Validate on both client and server**
   - Client: Immediate feedback
   - Server: Security validation

---

## Examples

### Example 1: Create Repo Flow

```typescript
import { validateAndNormalize, suggestSlug } from '@sharedrepo/shared';

// User enters project name
const projectName = 'My Awesome Project';

// Auto-suggest slug
const suggestedSlug = suggestSlug(projectName);  // 'myawesomeproject'

// User can edit suggested slug
const userEditedSlug = 'myproject';

// Validate before submission
const result = validateAndNormalize(userEditedSlug);

if (result.valid) {
  await createRepo(result.normalized, password);
} else {
  alert(result.message);
}
```

### Example 2: URL Parameter Handling

```typescript
import { normalizeSlug, isSlugValid } from '@sharedrepo/shared';

// URL: /repos/MyRepo (mixed case from user)
const rawSlug = req.params.slug;           // 'MyRepo'
const normalized = normalizeSlug(rawSlug);  // 'myrepo'

if (!isSlugValid(normalized)) {
  throw new BadRequestError('Invalid slug format');
}

// Look up by normalized slug
const repo = await db
  .selectFrom('repos')
  .where('slug', '=', normalized)
  .selectAll()
  .executeTakeFirst();
```

### Example 3: Batch Slug Validation

```typescript
import { validateSlugDetailed } from '@sharedrepo/shared';

const slugs = ['myrepo', 'test-123', 'INVALID', 'ok'];

const results = slugs.map(slug => ({
  slug,
  ...validateSlugDetailed(slug),
}));

const validSlugs = results
  .filter(r => r.valid)
  .map(r => r.slug);

const invalidSlugs = results
  .filter(r => !r.valid)
  .map(r => ({ slug: r.slug, reason: r.message }));
```

---

## Migration from Old Code

If you have existing slug validation:

**Before:**
```typescript
const slug = input.toLowerCase().trim();
if (!/^[a-z0-9]+$/.test(slug) || slug.length > 20) {
  throw new Error('Invalid slug');
}
```

**After:**
```typescript
import { validateAndNormalize } from '@sharedrepo/shared';

const result = validateAndNormalize(input);
if (!result.valid) {
  throw new Error(result.message);
}
const slug = result.normalized;
```

---

## Performance

All functions are highly optimized:
- Regex-based validation is O(n) where n = slug length
- Maximum slug length of 20 ensures fast validation
- Tested with strings up to 10,000 characters (edge case)
- No external dependencies (except Zod for schema validation)

---

## Type Safety

All functions are fully typed with TypeScript:

```typescript
// Inferred types
const normalized: string = normalizeSlug('test');
const isValid: boolean = isSlugValid('test');
const result: SlugValidationResult = validateAndNormalize('test');

// Type-safe error discrimination
if (result.error === 'invalid_characters') {
  console.log(result.message);  // string | undefined (narrowed to string)
}
```

---

Use these utilities consistently across frontend and backend for reliable slug handling!
