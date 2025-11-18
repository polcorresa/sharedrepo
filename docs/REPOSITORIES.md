# Repository Layer Documentation

This document describes the type-safe data access layer (repositories) for the sharedrepo.com database.

## Overview

The repository layer provides a clean abstraction over database operations with:
- **Type safety** - Full TypeScript types for all operations
- **Error handling** - Custom error types for common scenarios
- **Business logic** - Validation, constraints, and versioning
- **Optimistic concurrency** - Version-based conflict detection
- **Automatic features** - Language detection, size tracking, IP hashing

## Architecture

```
Application Layer
       ↓
Repository Layer (this)
       ↓
Kysely Query Builder
       ↓
PostgreSQL Database
```

Repositories encapsulate:
- CRUD operations
- Business rules and validation
- Constraint checking
- Version control
- Data transformations

## Available Repositories

### 1. RepoRepository

Manages repository metadata and lifecycle.

**Key Features:**
- Create new repos with slug and password
- Check slug availability
- Update last accessed timestamp
- Find expired repos
- Delete repos (cascades to all child data)
- Track repo size

**Usage:**

```typescript
import { createDatabase, RepoRepository } from '@sharedrepo/db';

const db = createDatabase(process.env.DATABASE_URL);
const repoRepo = new RepoRepository(db);

// Check if slug is available
const isAvailable = await repoRepo.isSlugAvailable('myproject');

// Create new repo
const repo = await repoRepo.create({
  slug: 'myproject',
  password_hash: await hashPassword('secret123'),
});

// Find by slug (only non-expired)
const found = await repoRepo.findBySlug('myproject');

// Update last accessed (extends expiration)
await repoRepo.updateLastAccessed(repo.id);

// Find and delete expired repos
const expired = await repoRepo.findExpired();
const deletedCount = await repoRepo.deleteExpired();

// Get statistics
const activeCount = await repoRepo.countActive();
const totalSize = await repoRepo.getTotalSize();
```

**Methods:**

| Method | Description |
|--------|-------------|
| `create(data)` | Create new repo |
| `findBySlug(slug)` | Find non-expired repo by slug |
| `findBySlugIncludingExpired(slug)` | Find repo including expired |
| `findById(id)` | Find by ID |
| `update(id, data)` | Update repo |
| `updateLastAccessed(id)` | Update last_accessed_at |
| `delete(id)` | Delete repo (cascade) |
| `isSlugAvailable(slug)` | Check if slug is free |
| `findExpired()` | Find repos expired >7 days |
| `deleteExpired()` | Delete expired repos |
| `updateSize(id, bytes)` | Update approx_size_bytes |
| `getTotalSize()` | Get total size of all repos |
| `countActive()` | Count non-expired repos |

---

### 2. FolderRepository

Manages folder tree structure with cycle detection.

**Key Features:**
- Create folders with parent-child relationships
- Rename with duplicate name detection
- Move with cycle detection
- Delete (cascades to children)
- Optimistic concurrency control

**Usage:**

```typescript
import { FolderRepository, ConflictError } from '@sharedrepo/db';

const folderRepo = new FolderRepository(db);

// Create root folder
const rootFolder = await folderRepo.create({
  repo_id: 1,
  parent_folder_id: null,
  name: 'root',
});

// Create subfolder
const srcFolder = await folderRepo.create({
  repo_id: 1,
  parent_folder_id: rootFolder.id,
  name: 'src',
});

// Get all folders in repo
const allFolders = await folderRepo.findByRepoId(1);

// Get children of a folder
const children = await folderRepo.findChildren(rootFolder.id);

// Rename with version check
try {
  const renamed = await folderRepo.rename(
    srcFolder.id,
    'source',
    srcFolder.version
  );
} catch (error) {
  if (error instanceof ConflictError) {
    // Handle conflict (stale version or duplicate name)
  }
}

// Move folder
try {
  await folderRepo.move(
    srcFolder.id,
    newParentId,
    srcFolder.version
  );
} catch (error) {
  if (error instanceof ValidationError) {
    // Would create cycle or other validation issue
  }
}

// Delete folder (cascades to children and files)
await folderRepo.delete(srcFolder.id, srcFolder.version);
```

**Methods:**

| Method | Description |
|--------|-------------|
| `create(data)` | Create new folder |
| `findById(id)` | Find by ID |
| `findByRepoId(repoId)` | Get all folders in repo |
| `findRootFolders(repoId)` | Get root folders (no parent) |
| `findChildren(parentId)` | Get child folders |
| `rename(id, name, version)` | Rename with version check |
| `move(id, parentId, version)` | Move with cycle detection |
| `delete(id, version)` | Delete with version check |
| `countByRepoId(repoId)` | Count folders in repo |

**Constraints:**
- Unique name per parent
- No cycles in tree
- Cannot move to different repo

---

### 3. FileRepository

Manages files with automatic language detection.

**Key Features:**
- Create files with auto language detection
- Rename (updates language hint)
- Move between folders
- Delete with version check
- Track file sizes

**Usage:**

```typescript
import { FileRepository, getLanguageFromExtension } from '@sharedrepo/db';

const fileRepo = new FileRepository(db);

// Create file (language auto-detected from extension)
const file = await fileRepo.create({
  repo_id: 1,
  folder_id: srcFolder.id,
  name: 'index.ts',
  // language_hint is optional, will be set to 'typescript'
});

// Find files
const allFiles = await fileRepo.findByRepoId(1);
const folderFiles = await fileRepo.findByFolderId(srcFolder.id);

// Rename (updates language hint)
const renamed = await fileRepo.rename(
  file.id,
  'main.py', // language_hint becomes 'python'
  file.version
);

// Move to different folder
const moved = await fileRepo.move(
  file.id,
  newFolderId,
  file.version
);

// Update size
await fileRepo.updateSize(file.id, 2048);

// Delete
await fileRepo.delete(file.id, file.version);

// Get statistics
const fileCount = await fileRepo.countByFolderId(folderId);
const totalSize = await fileRepo.getTotalSizeByRepoId(repoId);
```

**Methods:**

| Method | Description |
|--------|-------------|
| `create(data)` | Create file with auto language |
| `findById(id)` | Find by ID |
| `findByRepoId(repoId)` | Get all files in repo |
| `findByFolderId(folderId)` | Get files in folder |
| `rename(id, name, version)` | Rename with version check |
| `move(id, folderId, version)` | Move to different folder |
| `updateSize(id, bytes)` | Update size_bytes |
| `delete(id, version)` | Delete with version check |
| `countByRepoId(repoId)` | Count files in repo |
| `countByFolderId(folderId)` | Count files in folder |
| `getTotalSizeByRepoId(repoId)` | Total size in repo |

**Language Detection:**

The repository automatically detects language from file extensions:

```typescript
// Automatic detection
await fileRepo.create({
  name: 'app.tsx',  // → language_hint: 'typescript'
});

// Manual override
await fileRepo.create({
  name: 'app.tsx',
  language_hint: 'javascript', // Override auto-detection
});
```

Supported languages: TypeScript, JavaScript, Python, Java, C++, Go, Rust, and many more.

---

### 4. FileContentRepository

Manages file text content with size tracking.

**Key Features:**
- Get/set file content
- Automatic size tracking
- Upsert operations
- Batch operations for archives

**Usage:**

```typescript
import { FileContentRepository } from '@sharedrepo/db';

const contentRepo = new FileContentRepository(db);

// Set content (upsert - creates or updates)
await contentRepo.set({
  file_id: file.id,
  repo_id: repo.id,
  text: 'console.log("Hello");',
});

// Get content
const content = await contentRepo.getByFileId(file.id);
console.log(content.text);

// Update text
await contentRepo.updateText(file.id, 'console.log("Updated");');

// Get all contents for repo (for archive)
const allContents = await contentRepo.getByRepoId(repo.id);

// Get files with content (optimized for archive)
const filesWithContent = await contentRepo.getFilesWithContent(repo.id);
// Returns: [{ fileId, fileName, folderId, languageHint, text }]

// Delete content
await contentRepo.delete(file.id);

// Get total size
const totalSize = await contentRepo.getTotalSize(repo.id);
```

**Methods:**

| Method | Description |
|--------|-------------|
| `getByFileId(fileId)` | Get content for file |
| `getByRepoId(repoId)` | Get all contents in repo |
| `set(data)` | Create or update content |
| `updateText(fileId, text)` | Update text |
| `delete(fileId)` | Delete content |
| `getFilesWithContent(repoId)` | Get files + content (join) |
| `getTotalSize(repoId)` | Total text size in bytes |

**Size Tracking:**

The repository automatically:
1. Calculates text size in bytes
2. Updates `files.size_bytes`
3. Updates timestamps

---

### 5. LogsRepository

Manages privacy-preserving logs with IP hashing.

**Key Features:**
- Automatic IP hashing
- Query by repo, route, status
- Error log filtering
- Log rotation
- Statistics

**Usage:**

```typescript
import { LogsRepository } from '@sharedrepo/db';

const logsRepo = new LogsRepository(db);

// Log a request (with automatic IP hashing)
await logsRepo.log({
  route: 'POST /api/repos',
  repoId: repo.id,
  ipAddress: req.ip, // Automatically hashed
  statusCode: 201,
});

// Log an error
await logsRepo.log({
  route: 'POST /api/repos/:slug/login',
  repoId: repo.id,
  ipAddress: req.ip,
  statusCode: 401,
  errorCode: 'INVALID_PASSWORD',
});

// Query logs
const repoLogs = await logsRepo.findByRepoId(repo.id, 50);
const errors = await logsRepo.findErrors(100);
const recent = await logsRepo.findRecent(100);

// Get statistics
const stats = await logsRepo.getStats();
// { total, success, clientErrors, serverErrors }

// Rotate old logs (delete logs older than 30 days)
const deletedCount = await logsRepo.deleteOlderThan(30);
```

**Methods:**

| Method | Description |
|--------|-------------|
| `create(data)` | Create log entry |
| `log(params)` | Log with auto IP hashing |
| `findByRepoId(repoId, limit)` | Get logs for repo |
| `findByRoute(route, limit)` | Get logs for route |
| `findByStatusCode(code, limit)` | Get logs by status |
| `findErrors(limit)` | Get error logs (≥400) |
| `findRecent(limit)` | Get recent logs |
| `deleteOlderThan(days)` | Rotate old logs |
| `count()` | Count all logs |
| `countByStatusRange(min, max)` | Count by status range |
| `getStats()` | Get success/error counts |

**Privacy:**

IP addresses are **automatically hashed** before storage:
- Uses SHA-256 with configurable salt
- Truncated to 64 characters
- Salt from `IP_HASH_SALT` env var

---

## Error Handling

### Custom Error Types

```typescript
import { ConflictError, NotFoundError, ValidationError } from '@sharedrepo/db';
```

**ConflictError**
- Thrown when optimistic concurrency fails
- Thrown when duplicate names detected
- Signals need to refresh and retry

**NotFoundError**
- Thrown when entity doesn't exist
- Use for 404 responses

**ValidationError**
- Thrown when business rules violated
- Example: moving folder into itself

### Error Handling Pattern

```typescript
try {
  await folderRepo.rename(folderId, newName, expectedVersion);
} catch (error) {
  if (error instanceof ConflictError) {
    // Version mismatch or duplicate name
    // Ask client to refresh tree and retry
    return res.status(409).json({ 
      error: 'conflict',
      message: error.message 
    });
  }
  
  if (error instanceof NotFoundError) {
    return res.status(404).json({ 
      error: 'not_found',
      message: error.message 
    });
  }
  
  if (error instanceof ValidationError) {
    return res.status(400).json({ 
      error: 'validation',
      message: error.message 
    });
  }
  
  throw error; // Unexpected error
}
```

---

## Optimistic Concurrency Control

All tree operations (folders/files) use version-based OCC:

### How It Works

1. Client reads entity with current version
2. Client sends operation with expected version
3. Server checks: `current_version === expected_version`
4. If match: apply + increment version
5. If mismatch: throw `ConflictError`

### Example Flow

```typescript
// 1. Client A and B both read file
const fileA = await fileRepo.findById(1); // version: 5
const fileB = await fileRepo.findById(1); // version: 5

// 2. Client A renames successfully
const renamedA = await fileRepo.rename(1, 'new.ts', 5);
// version is now 6

// 3. Client B tries to rename with stale version
try {
  await fileRepo.rename(1, 'other.ts', 5); // version is 6, not 5!
} catch (error) {
  // ConflictError: "File was modified by another user..."
  
  // 4. Client B must refresh
  const refreshed = await fileRepo.findById(1); // version: 6
  await fileRepo.rename(1, 'other.ts', 6); // Now succeeds
}
```

### Best Practices

1. **Always include version** in update/delete operations
2. **Catch ConflictError** and prompt user to refresh
3. **Show clear message** about concurrent modifications
4. **Reload tree** after conflicts
5. **Don't auto-retry** - let user decide

---

## Utilities

### Language Mapping

```typescript
import { 
  getLanguageFromExtension,
  getSupportedExtensions,
  isExtensionSupported 
} from '@sharedrepo/db';

// Get language from filename
const lang = getLanguageFromExtension('app.tsx');
// 'typescript'

// Check if supported
if (isExtensionSupported('rs')) {
  // 'rs' → 'rust' is supported
}

// Get all supported extensions
const extensions = getSupportedExtensions();
// ['js', 'ts', 'py', 'java', 'cpp', ...]
```

### IP Hashing

```typescript
import { hashIp } from '@sharedrepo/db';

// Hash IP for privacy
const hashed = hashIp('192.168.1.1');
// '3a5f8b...' (64 chars)

// With custom salt
const hashed = hashIp('192.168.1.1', 'custom-salt');
```

Configure salt via environment:
```bash
IP_HASH_SALT=your-secret-salt-here
```

---

## Complete Example

### Initialize Repositories

```typescript
import { 
  createDatabase,
  RepoRepository,
  FolderRepository,
  FileRepository,
  FileContentRepository,
  LogsRepository
} from '@sharedrepo/db';

const db = createDatabase(process.env.DATABASE_URL);

// Create repository instances
const repos = {
  repo: new RepoRepository(db),
  folder: new FolderRepository(db),
  file: new FileRepository(db),
  content: new FileContentRepository(db),
  logs: new LogsRepository(db),
};

export { db, repos };
```

### Create Complete Repo Structure

```typescript
import { repos } from './db';
import bcrypt from 'bcrypt';

async function createNewRepo(slug: string, password: string) {
  // 1. Create repo
  const repo = await repos.repo.create({
    slug,
    password_hash: await bcrypt.hash(password, 10),
  });

  // 2. Create root folder
  const rootFolder = await repos.folder.create({
    repo_id: repo.id,
    parent_folder_id: null,
    name: 'root',
  });

  // 3. Create initial file
  const file = await repos.file.create({
    repo_id: repo.id,
    folder_id: rootFolder.id,
    name: 'README.md',
  });

  // 4. Set initial content
  await repos.content.set({
    file_id: file.id,
    repo_id: repo.id,
    text: '# Welcome to your shared repo!\n',
  });

  return { repo, rootFolder, file };
}
```

### Handle Login

```typescript
async function loginToRepo(slug: string, password: string, ipAddress: string) {
  try {
    // Find repo
    const repo = await repos.repo.findBySlug(slug);
    if (!repo) {
      await repos.logs.log({
        route: 'POST /api/repos/:slug/login',
        ipAddress,
        statusCode: 404,
      });
      throw new Error('Repo not found');
    }

    // Verify password
    const valid = await bcrypt.compare(password, repo.password_hash);
    if (!valid) {
      await repos.logs.log({
        route: 'POST /api/repos/:slug/login',
        repoId: repo.id,
        ipAddress,
        statusCode: 401,
        errorCode: 'INVALID_PASSWORD',
      });
      throw new Error('Invalid password');
    }

    // Update last accessed
    await repos.repo.updateLastAccessed(repo.id);

    // Log success
    await repos.logs.log({
      route: 'POST /api/repos/:slug/login',
      repoId: repo.id,
      ipAddress,
      statusCode: 200,
    });

    return repo;
  } catch (error) {
    throw error;
  }
}
```

### Generate Archive

```typescript
async function generateArchive(repoId: number) {
  // Get all files with content
  const filesWithContent = await repos.content.getFilesWithContent(repoId);
  
  // Get all folders for path reconstruction
  const folders = await repos.folder.findByRepoId(repoId);
  
  // Build folder path map
  const folderPaths = new Map<number, string>();
  // ... build paths from folder tree
  
  // Create zip
  const zip = new JSZip();
  for (const file of filesWithContent) {
    const folderPath = folderPaths.get(file.folderId) || '';
    const filePath = `${folderPath}/${file.fileName}`;
    zip.file(filePath, file.text);
  }
  
  return await zip.generateAsync({ type: 'nodebuffer' });
}
```

---

## Testing

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, RepoRepository } from '@sharedrepo/db';

describe('RepoRepository', () => {
  let db: Kysely<Database>;
  let repoRepo: RepoRepository;

  beforeEach(async () => {
    db = createDatabase(process.env.TEST_DATABASE_URL);
    repoRepo = new RepoRepository(db);
    // Clean test data
  });

  it('should create repo', async () => {
    const repo = await repoRepo.create({
      slug: 'test',
      password_hash: 'hash',
    });
    expect(repo.slug).toBe('test');
    expect(repo.id).toBeDefined();
  });

  it('should find by slug', async () => {
    await repoRepo.create({ slug: 'test', password_hash: 'hash' });
    const found = await repoRepo.findBySlug('test');
    expect(found).toBeDefined();
    expect(found?.slug).toBe('test');
  });

  it('should not find expired repo', async () => {
    const repo = await repoRepo.create({
      slug: 'test',
      password_hash: 'hash',
    });
    
    // Set to expired
    await repoRepo.update(repo.id, {
      last_accessed_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });
    
    const found = await repoRepo.findBySlug('test');
    expect(found).toBeNull();
  });
});
```

---

## Performance Considerations

### Indexing

All repositories leverage database indexes:
- `repos.slug` - Fast slug lookups
- `repos.last_accessed_at` - Expiry queries
- `folders(repo_id, parent_folder_id, name)` - Unique checks
- `files(repo_id, folder_id, name)` - Unique checks
- `logs.timestamp` - Log queries
- `logs.repo_id` - Repo-specific logs

### Query Optimization

1. **Use specific methods** - Don't fetch all then filter
2. **Leverage joins** - Use `getFilesWithContent()` vs separate queries
3. **Batch operations** - Process multiple items in transactions
4. **Limit results** - Use `limit` parameter on query methods

### Connection Pooling

Database connection pool is configured in client:
```typescript
max: 10 // Maximum 10 concurrent connections
```

Adjust based on load.

---

## Security Notes

1. **Password hashing** - Always hash before storing
2. **IP anonymization** - Always use `hashIp()` for logs
3. **Parameterized queries** - Kysely handles this automatically
4. **Version checks** - Prevent race conditions
5. **Cascade deletes** - Ensure no orphaned data

---

## Next Steps

- See `QUICK_REFERENCE.md` for query patterns
- See `SCHEMA.md` for database structure
- See `MIGRATION_GUIDE.md` for schema changes
- See example implementations in tests
