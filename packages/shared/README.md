# @sharedrepo/shared

Shared utilities, types, and validation schemas for `sharedrepo.com`.

## Overview

This package contains:
- **Contracts**: Zod schemas and TypeScript types for API contracts
- **Slug Utilities**: Validation, normalization, and sanitization
- **Password Utilities**: Validation and strength indicators
- **Expiry Utilities**: Repo expiration calculations and checks
- **Type Definitions**: Shared types used across frontend and backend

## Installation

```bash
pnpm add @sharedrepo/shared
```

## Usage

### Slug Validation

Comprehensive slug validation and normalization utilities.

```typescript
import { 
  validateAndNormalize,
  suggestSlug,
  isSlugValid 
} from '@sharedrepo/shared';

// Validate user input (recommended)
const result = validateAndNormalize('MyRepo');
if (result.valid) {
  console.log(result.normalized);  // 'myrepo'
}

// Auto-suggest from arbitrary text
const slug = suggestSlug('My Awesome Project');  // 'myawesomeproject'

// Quick boolean check
if (isSlugValid('myrepo')) {
  // Valid slug
}
```

See `SLUG_VALIDATION.md` for complete documentation.

### Password Validation

Simple password validation with optional strength indicators.

```typescript
import { 
  validatePasswordDetailed,
  getPasswordStrength,
  getPasswordStrengthLabel 
} from '@sharedrepo/shared';

// Validate password
const result = validatePasswordDetailed('secret123');
if (result.valid) {
  console.log('Password accepted');
}

// Get strength score (0-4)
const strength = getPasswordStrength('MyPassword123');  // 3

// Get strength label
const label = getPasswordStrengthLabel('MyPassword123');  // 'good'
```

See `PASSWORD_VALIDATION.md` for complete documentation.

### Expiry Calculation

Check if repos have expired based on last access time (7 days).

```typescript
import { 
  isExpired,
  getDaysUntilExpiry,
  getExpiryCutoffDate 
} from '@sharedrepo/shared';

// Check if expired
const lastAccess = new Date('2024-01-01');
const now = new Date('2024-01-09');
const expired = isExpired(lastAccess, now);  // true (8 days later)

// Days until expiry
const daysLeft = getDaysUntilExpiry(lastAccess, now);  // 0 (expired)

// Get cutoff date for DB queries
const cutoff = getExpiryCutoffDate();
// Repos last accessed before cutoff are expired
```

### Tree Validators

Validate tree operations (create/rename/move/delete) with conflict prevention.

```typescript
import { 
  validateNameUnique,
  validateNoCycle,
  validateVersion,
  isDescendant,
  getDescendants 
} from '@sharedrepo/shared';

// Check unique name among siblings
validateNameUnique('file.ts', parentFolderId, siblings);
// Throws DuplicateNameError if duplicate exists

// Prevent cycles when moving folders
validateNoCycle(folderId, newParentId, allFolders);
// Throws CycleError if move would create cycle

// Optimistic concurrency control
validateVersion(expectedVersion, currentVersion, 'folder', folderId);
// Throws VersionMismatchError if versions don't match

// Check folder relationships
if (isDescendant(folder.id, ancestorId, allFolders)) {
  console.log('Folder is a descendant');
}

// Get all descendants for deletion
const descendants = getDescendants(folderId, allFolders);
```

### Language Detection

Map file extensions to Monaco Editor language identifiers.

```typescript
import { 
  detectLanguage,
  getLanguageName,
  getSupportedLanguages 
} from '@sharedrepo/shared';

// Detect language from filename
const language = detectLanguage('index.ts');      // 'typescript'
const lang2 = detectLanguage('Dockerfile');       // 'dockerfile'
const lang3 = detectLanguage('unknown.xyz');      // 'plaintext'

// Get human-readable name
const name = getLanguageName('typescript');       // 'TypeScript'

// List all supported languages
const languages = getSupportedLanguages();
// ['c', 'cpp', 'css', 'dockerfile', ...]
```

### API Contracts

Zod schemas for request/response validation.

```typescript
import { 
  repoSlugSchema,
  repoPasswordSchema,
  repoStatusSchema,
  repoMetadataSchema 
} from '@sharedrepo/shared';

// Validate repo slug
const slug = repoSlugSchema.parse('myrepo');

// Validate password
const password = repoPasswordSchema.parse('secret123');

// Validate API responses
const status = repoStatusSchema.parse({
  slug: 'myrepo',
  state: 'exists',
  expiresAt: '2024-12-01T00:00:00Z'
});
```

### TypeScript Types

```typescript
import type { 
  RepoSlug,
  RepoPassword,
  RepoStatusResponse,
  RepoMetadata,
  RepoTokenPayload 
} from '@sharedrepo/shared';

// Use in function signatures
function createRepo(slug: RepoSlug, password: RepoPassword): Promise<RepoMetadata> {
  // ...
}
```

## Exports

### Slug Utilities

- `normalizeSlug(input: string): string`
- `isSlugValid(slug: string): boolean`
- `validateSlug(slug: string): string` (throws ZodError)
- `validateSlugDetailed(slug: string): SlugValidationResult`
- `validateAndNormalize(input: string): SlugValidationResult` ⭐
- `sanitizeSlug(input: string): string`
- `suggestSlug(input: string, fallback?: string): string`
- `MAX_SLUG_LENGTH: 20`
- `MIN_SLUG_LENGTH: 1`

### Password Utilities

- `isPasswordValid(password: string): boolean`
- `validatePassword(password: string): string` (throws ZodError)
- `validatePasswordDetailed(password: string): PasswordValidationResult`
- `isPasswordAcceptable(password: string): PasswordValidationResult`
- `getPasswordStrength(password: string): number` (0-4)
- `getPasswordStrengthLabel(password: string): string`
- `MIN_PASSWORD_LENGTH: 4`
- `MAX_PASSWORD_LENGTH: 128`

### Expiry Utilities

- `isExpired(lastAccessedAt, now?, expiryDays?): boolean`
- `getExpiryDate(lastAccessedAt, expiryDays?): Date`
- `getTimeUntilExpiry(lastAccessedAt, now?, expiryDays?): number`
- `getDaysUntilExpiry(lastAccessedAt, now?, expiryDays?): number`
- `isExpiringSoon(lastAccessedAt, now?, expiryDays?): boolean`
- `formatTimeUntilExpiry(lastAccessedAt, now?, expiryDays?): string`
- `getDateDaysAgo(daysAgo, from?): Date`
- `getExpiryCutoffDate(now?, expiryDays?): Date`
- `REPO_EXPIRY_DAYS: 7`
- `REPO_EXPIRY_MS: number`

### Tree Utilities

- `isNameUnique(name, parentFolderId, siblings, excludeId?): boolean`
- `validateNameUnique(name, parentFolderId, siblings, excludeId?): void`
- `wouldCreateCycle(folderId, targetParentId, folders): boolean`
- `validateNoCycle(folderId, targetParentId, folders): void`
- `isDescendant(folderId, ancestorId, folders): boolean`
- `isVersionMatch(expectedVersion, actualVersion): boolean`
- `validateVersion(expected, actual, resourceType, resourceId): void`
- `isTimestampMatch(expected, actual): boolean`
- `validateTimestamp(expected, actual, resourceType, resourceId): void`
- `getAncestors(folderId, folders): number[]`
- `getDescendants(folderId, folders): number[]`
- `getFolderDepth(folderId, folders): number`
- `DuplicateNameError`, `CycleError`, `VersionMismatchError` classes

### Language Utilities

- `detectLanguage(filename): string`
- `getFileExtension(filename): string`
- `isLanguageSupported(language): boolean`
- `getExtensionsForLanguage(language): string[]`
- `getSupportedLanguages(): string[]`
- `isExtensionRecognized(extension): boolean`
- `getLanguageName(languageId): string`
- `suggestExtension(language): string`
- `LANGUAGE_MAP: Record<string, string>`
- `SPECIAL_FILENAMES: Record<string, string>`
- `DEFAULT_LANGUAGE: 'plaintext'`

### Repo Contracts

- `repoSlugSchema: z.ZodSchema<string>`
- `repoPasswordSchema: z.ZodSchema<string>`
- `repoStatusSchema: z.ZodSchema<RepoStatusResponse>`
- `repoMetadataSchema: z.ZodSchema<RepoMetadata>`
- `repoTokenPayloadSchema: z.ZodSchema<RepoTokenPayload>`
- `slugAvailabilitySchema: z.ZodSchema<SlugAvailability>`

### Repo Types

- `RepoSlug`
- `RepoPassword`
- `RepoStatusResponse`
- `RepoMetadata`
- `RepoTokenPayload`
- `SlugAvailability`

### Tree Contracts

(To be added)

## Development

### Build

```bash
pnpm build
```

### Type Check

```bash
pnpm typecheck
```

### Test

```bash
pnpm test:unit
pnpm test:unit:watch  # Watch mode
```

## Documentation

- `SLUG_VALIDATION.md` - Complete slug validation guide with examples
- `PASSWORD_VALIDATION.md` - Complete password validation guide with examples

## Rules

### Slug Rules

- Characters: Only lowercase `a-z` and digits `0-9`
- Length: 1-20 characters
- No uppercase, no special characters, no spaces
- Case-insensitive matching (normalized to lowercase)

### Password Rules

- Minimum: 4 characters
- Maximum: 128 characters
- No complexity requirements

## License

Private package for sharedrepo.com
