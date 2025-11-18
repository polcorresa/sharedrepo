# Database Schema Documentation

This document provides a comprehensive overview of the database schema for `sharedrepo.com`.

## Overview

The database uses PostgreSQL and is designed to support:
- Ephemeral collaborative code repositories
- Folder/file tree structures
- Real-time collaborative editing (Yjs CRDT)
- Repo expiration based on activity
- Minimal security and debugging logs

## Design Principles

1. **No user accounts** - Only repo-scoped passwords
2. **Ephemeral by design** - Repos expire after 7 days of inactivity
3. **Server-authoritative tree** - Tree modifications are controlled server-side
4. **Optimistic concurrency** - Version fields prevent conflicting operations
5. **Privacy-focused** - Minimal logging, no personal data

## Entity Relationship Diagram

```
repos (1) ----< (many) folders
repos (1) ----< (many) files
repos (1) ----< (many) file_contents
repos (1) ----< (many) logs (nullable)

folders (1) ----< (many) folders (self-referencing, parent-child)
folders (1) ----< (many) files

files (1) ---- (1) file_contents
```

## Tables

### repos

Represents a collaborative repository identified by a unique slug.

**Columns:**
- `id` SERIAL PRIMARY KEY
- `slug` VARCHAR(20) NOT NULL UNIQUE
- `password_hash` VARCHAR(255) NOT NULL
- `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
- `last_accessed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
- `approx_size_bytes` BIGINT NOT NULL DEFAULT 0

**Indexes:**
- `repos_slug_idx` on `slug` - Fast slug lookups
- `repos_last_accessed_at_idx` on `last_accessed_at` - Expiry job queries

**Business Rules:**
- Slug must be lowercase, 1-20 characters, letters and digits only
- Password is hashed using bcrypt or argon2
- `last_accessed_at` is updated on successful password entry
- Repos are deleted if `last_accessed_at` is older than 7 days
- Cascade deletes all folders, files, file_contents, and yjs_persistence on deletion
- Logs have FK set to NULL on repo deletion

**Example:**
```typescript
{
  id: 1,
  slug: "myproject123",
  password_hash: "$2b$10$...",
  created_at: "2025-11-18T10:00:00Z",
  last_accessed_at: "2025-11-18T15:30:00Z",
  approx_size_bytes: 524288
}
```

---

### folders

Represents folder (directory) nodes in the tree structure.

**Columns:**
- `id` SERIAL PRIMARY KEY
- `repo_id` INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE
- `parent_folder_id` INTEGER REFERENCES folders(id) ON DELETE CASCADE
- `name` VARCHAR(255) NOT NULL
- `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
- `version` INTEGER NOT NULL DEFAULT 1

**Indexes:**
- `folders_unique_name_idx` UNIQUE on `(repo_id, parent_folder_id, name)`

**Business Rules:**
- `parent_folder_id` is NULL for root folders
- Name cannot contain slashes
- Names must be unique within the same parent folder
- Moving folders must prevent cycles (cannot move into own descendants)
- `version` is incremented on each modification (rename, move)
- Used for optimistic concurrency control

**Example:**
```typescript
// Root folder
{
  id: 1,
  repo_id: 1,
  parent_folder_id: null,
  name: "root",
  version: 1
}

// Subfolder
{
  id: 2,
  repo_id: 1,
  parent_folder_id: 1,
  name: "src",
  version: 2
}
```

---

### files

Represents file nodes in the tree structure.

**Columns:**
- `id` SERIAL PRIMARY KEY
- `repo_id` INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE
- `folder_id` INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE
- `name` VARCHAR(255) NOT NULL
- `language_hint` VARCHAR(50)
- `size_bytes` BIGINT NOT NULL DEFAULT 0
- `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
- `version` INTEGER NOT NULL DEFAULT 1

**Indexes:**
- `files_unique_name_idx` UNIQUE on `(repo_id, folder_id, name)`

**Business Rules:**
- Names must include file extension (e.g., `index.ts`, `README.md`)
- Names must be unique within the same folder
- `language_hint` is derived from file extension for syntax highlighting
- `size_bytes` is updated when file content is saved
- `version` is incremented on rename, move, or content save
- Used for optimistic concurrency control

**Example:**
```typescript
{
  id: 1,
  repo_id: 1,
  folder_id: 2,
  name: "index.ts",
  language_hint: "typescript",
  size_bytes: 1024,
  version: 3
}
```

---

### file_contents

Stores the saved text content of files. Separated from file metadata for performance.

**Columns:**
- `file_id` INTEGER PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE
- `repo_id` INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE
- `text` TEXT NOT NULL DEFAULT ''
- `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

**Business Rules:**
- One-to-one relationship with `files` table
- Contains only **saved** state (not unsaved CRDT edits)
- Used for generating `.zip` archives
- Updated when user explicitly saves or on periodic auto-save
- `updated_at` tracks last save time

**Example:**
```typescript
{
  file_id: 1,
  repo_id: 1,
  text: "export function hello() {\n  console.log('Hello');\n}",
  updated_at: "2025-11-18T15:30:00Z"
}
```

---

### yjs_persistence

Optional table for persisting Yjs CRDT documents. Enables server restart resilience.

**Columns:**
- `document_key` VARCHAR(255) PRIMARY KEY
- `data` BYTEA NOT NULL
- `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

**Business Rules:**
- `document_key` format: `repo:<repo_id>:file:<file_id>`
- `data` contains encoded Yjs document state (snapshots or update deltas)
- Updated as Yjs documents change
- Used to reconstruct Yjs state after server restarts
- No CASCADE delete (cleaned up by expiry job based on key pattern)

**Implementation Notes:**
- Optional for v1; can run Yjs purely in-memory
- Recommended for v2 for better resilience
- Can be used for future offline/sync features

**Example:**
```typescript
{
  document_key: "repo:1:file:1",
  data: <Buffer 00 01 02 ...>,
  updated_at: "2025-11-18T15:30:00Z"
}
```

---

### logs

Minimal logging for debugging and security monitoring.

**Columns:**
- `id` SERIAL PRIMARY KEY
- `timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
- `route` VARCHAR(255) NOT NULL
- `repo_id` INTEGER REFERENCES repos(id) ON DELETE SET NULL
- `ip_hash` VARCHAR(64) NOT NULL
- `status_code` INTEGER NOT NULL
- `error_code` VARCHAR(50)

**Indexes:**
- `logs_timestamp_idx` on `timestamp` - Log queries and cleanup
- `logs_repo_id_idx` on `repo_id` - Repo-specific queries

**Business Rules:**
- IP addresses must be hashed (with salt) before storage
- No full request/response bodies stored
- No personal identifiable information (PII)
- Logs should be rotated/cleaned periodically (e.g., keep 30 days)
- `error_code` is optional, short identifier (not full stack traces)

**Privacy:**
- Complies with no-PII requirement
- IP hashing prevents identification
- Minimal data for debugging only

**Example:**
```typescript
{
  id: 1,
  timestamp: "2025-11-18T15:30:00Z",
  route: "POST /api/repos/:slug/login",
  repo_id: 1,
  ip_hash: "a3f5...",
  status_code: 200,
  error_code: null
}
```

---

## Migrations

Migrations are located in `src/migrations/migrations/` and executed using Kysely's migration system.

### 001_initial_schema.ts
- Creates `repos`, `folders`, `files`, `file_contents`, `yjs_persistence` tables
- Sets up indexes and constraints
- Establishes foreign key relationships with CASCADE deletes

### 002_add_logs_table.ts
- Creates `logs` table
- Sets up indexes on `timestamp` and `repo_id`
- Uses SET NULL on repo deletion to preserve log history

### Running Migrations

```bash
# Run all pending migrations
pnpm run migrate

# Revert last migration
pnpm run migrate:down
```

---

## Optimistic Concurrency Control

Tree operations (rename, move, delete) use version-based optimistic concurrency:

1. Client reads node with current `version`
2. Client sends operation with `expected_version`
3. Server checks if `current_version === expected_version`
4. If match: apply operation, increment version
5. If mismatch: return conflict error
6. Client handles conflict by refreshing tree and retrying

This prevents silent conflicting edits from multiple collaborators.

**Example Flow:**

```typescript
// Client A reads file
const file = { id: 1, name: "old.ts", version: 5 };

// Client B also reads same file
const fileB = { id: 1, name: "old.ts", version: 5 };

// Client A renames successfully
await renameFile({ id: 1, name: "new.ts", expectedVersion: 5 });
// Server increments version to 6

// Client B tries to rename (with stale version)
await renameFile({ id: 1, name: "other.ts", expectedVersion: 5 });
// Server returns conflict error (current version is 6, not 5)

// Client B must refresh and retry
const refreshedFile = await getFile(1); // version: 6
await renameFile({ id: 1, name: "other.ts", expectedVersion: 6 });
```

---

## Expiration and Cleanup

### Repo Expiration

A background job runs periodically (e.g., hourly) to delete expired repos:

```sql
DELETE FROM repos 
WHERE last_accessed_at < NOW() - INTERVAL '7 days';
```

Cascade deletes automatically clean up:
- All folders in the repo
- All files in the repo
- All file_contents for those files
- Yjs persistence records can be cleaned separately

### Log Rotation

Logs should be rotated to prevent unbounded growth:

```sql
DELETE FROM logs 
WHERE timestamp < NOW() - INTERVAL '30 days';
```

Run as part of maintenance job.

---

## Type Safety

All database types are defined in `src/types.ts` using Kysely's type system:

- `Database` - Complete schema interface
- `<Table>Table` - Table column definitions with `Generated<T>` for auto-generated fields
- `<Table>` - Selectable row type (what you get from queries)
- `New<Table>` - Insertable type (what you can insert)
- `<Table>Update` - Updateable type (what you can update)

Example usage:

```typescript
import { Kysely } from 'kysely';
import { Database, NewRepo, Repo } from '@sharedrepo/db';

async function createRepo(db: Kysely<Database>, data: NewRepo): Promise<Repo> {
  return await db
    .insertInto('repos')
    .values(data)
    .returningAll()
    .executeTakeFirstOrThrow();
}
```

---

## Performance Considerations

1. **Indexes**: All foreign keys and frequently queried columns are indexed
2. **Cascade deletes**: Automatic cleanup on repo deletion
3. **Separate content table**: `file_contents` separated from `files` for better query performance
4. **Connection pooling**: Configured via `pg` Pool with max connections
5. **Prepared statements**: Kysely uses parameterized queries (SQL injection safe)

---

## Security

1. **Password hashing**: Use bcrypt or argon2, never store plaintext
2. **SQL injection**: Kysely prevents via parameterized queries
3. **No PII**: IP addresses hashed, no personal data stored
4. **Cascade deletes**: Ensures no orphaned data remains
5. **Access control**: Enforced at application layer, not database

---

## Future Enhancements

Potential schema additions for future features:

1. **Read-only tokens**: Add `repo_tokens` table for view-only access
2. **Snapshots**: Add `repo_snapshots` table for versioned backups
3. **Comments**: Add `comments` table for inline code comments
4. **Presence tracking**: Add `user_sessions` for active editor sessions
5. **Rate limiting**: Add counters or use Redis externally

These would maintain the core principles of no user accounts and ephemeral repos.
