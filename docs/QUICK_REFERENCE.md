# Quick Reference: Database Schema

## Table Summary

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `repos` | Repository metadata | slug, password_hash, last_accessed_at |
| `folders` | Folder tree nodes | repo_id, parent_folder_id, name, version |
| `files` | File tree nodes | repo_id, folder_id, name, version |
| `file_contents` | Saved file text | file_id, text |
| `yjs_persistence` | CRDT snapshots | document_key, data |
| `logs` | Debug/security logs | route, repo_id, ip_hash, status_code |

## Common Queries

### Repo Operations

```typescript
// Check if slug is available (not expired)
const repo = await db
  .selectFrom('repos')
  .selectAll()
  .where('slug', '=', slug)
  .where('last_accessed_at', '>', sql`NOW() - INTERVAL '7 days'`)
  .executeTakeFirst();

// Create new repo
const newRepo = await db
  .insertInto('repos')
  .values({
    slug: normalizedSlug,
    password_hash: hashedPassword,
  })
  .returningAll()
  .executeTakeFirstOrThrow();

// Update last accessed time
await db
  .updateTable('repos')
  .set({ last_accessed_at: new Date() })
  .where('id', '=', repoId)
  .execute();

// Find expired repos
const expiredRepos = await db
  .selectFrom('repos')
  .select('id')
  .where('last_accessed_at', '<', sql`NOW() - INTERVAL '7 days'`)
  .execute();
```

### Tree Operations

```typescript
// Get entire tree for a repo
const folders = await db
  .selectFrom('folders')
  .selectAll()
  .where('repo_id', '=', repoId)
  .execute();

const files = await db
  .selectFrom('files')
  .selectAll()
  .where('repo_id', '=', repoId)
  .execute();

// Create folder
const folder = await db
  .insertInto('folders')
  .values({
    repo_id: repoId,
    parent_folder_id: parentId,
    name: folderName,
  })
  .returningAll()
  .executeTakeFirstOrThrow();

// Rename with version check (optimistic concurrency)
const result = await db
  .updateTable('files')
  .set({
    name: newName,
    version: sql`version + 1`,
    updated_at: new Date(),
  })
  .where('id', '=', fileId)
  .where('version', '=', expectedVersion)
  .returningAll()
  .executeTakeFirst();

if (!result) {
  throw new Error('Conflict: file was modified by another user');
}

// Delete folder and contents (cascade automatic)
await db
  .deleteFrom('folders')
  .where('id', '=', folderId)
  .where('version', '=', expectedVersion)
  .execute();
```

### File Content

```typescript
// Save file content
await db
  .insertInto('file_contents')
  .values({
    file_id: fileId,
    repo_id: repoId,
    text: content,
  })
  .onConflict((oc) =>
    oc.column('file_id').doUpdateSet({
      text: content,
      updated_at: new Date(),
    })
  )
  .execute();

// Update file size
await db
  .updateTable('files')
  .set({
    size_bytes: Buffer.byteLength(content, 'utf8'),
    updated_at: new Date(),
  })
  .where('id', '=', fileId)
  .execute();

// Get file content for archive
const contents = await db
  .selectFrom('file_contents')
  .innerJoin('files', 'files.id', 'file_contents.file_id')
  .select(['files.name', 'file_contents.text'])
  .where('file_contents.repo_id', '=', repoId)
  .execute();
```

### Logging

```typescript
// Insert log entry
await db
  .insertInto('logs')
  .values({
    route: req.route,
    repo_id: repoId,
    ip_hash: hashIp(req.ip),
    status_code: 200,
    error_code: null,
  })
  .execute();

// Clean old logs
await db
  .deleteFrom('logs')
  .where('timestamp', '<', sql`NOW() - INTERVAL '30 days'`)
  .execute();
```

## Version Control Pattern

All tree modifications should follow this pattern:

```typescript
async function renameNode(
  db: Kysely<Database>,
  nodeId: number,
  newName: string,
  expectedVersion: number,
  table: 'files' | 'folders'
) {
  const result = await db
    .updateTable(table)
    .set({
      name: newName,
      version: sql`version + 1`,
      updated_at: new Date(),
    })
    .where('id', '=', nodeId)
    .where('version', '=', expectedVersion)
    .returningAll()
    .executeTakeFirst();

  if (!result) {
    throw new ConflictError(
      `${table} was modified by another user. Please refresh and try again.`
    );
  }

  return result;
}
```

## Expiration Job

Run periodically (e.g., hourly via cron):

```typescript
async function deleteExpiredRepos(db: Kysely<Database>) {
  const expiredRepos = await db
    .deleteFrom('repos')
    .where('last_accessed_at', '<', sql`NOW() - INTERVAL '7 days'`)
    .returning(['id', 'slug'])
    .execute();

  // Cascade deletes handle folders, files, file_contents automatically
  // Clean up Yjs persistence manually
  for (const repo of expiredRepos) {
    await db
      .deleteFrom('yjs_persistence')
      .where('document_key', 'like', `repo:${repo.id}:%`)
      .execute();
  }

  console.log(`Deleted ${expiredRepos.length} expired repos`);
  return expiredRepos;
}
```

## Transaction Example

For complex operations that need atomicity:

```typescript
async function moveFileToFolder(
  db: Kysely<Database>,
  fileId: number,
  newFolderId: number,
  expectedVersion: number
) {
  return await db.transaction().execute(async (trx) => {
    // Check target folder exists
    const targetFolder = await trx
      .selectFrom('folders')
      .select('id')
      .where('id', '=', newFolderId)
      .executeTakeFirst();

    if (!targetFolder) {
      throw new Error('Target folder not found');
    }

    // Check for name conflict
    const file = await trx
      .selectFrom('files')
      .select(['name', 'repo_id'])
      .where('id', '=', fileId)
      .executeTakeFirstOrThrow();

    const conflict = await trx
      .selectFrom('files')
      .select('id')
      .where('folder_id', '=', newFolderId)
      .where('name', '=', file.name)
      .where('repo_id', '=', file.repo_id)
      .executeTakeFirst();

    if (conflict) {
      throw new Error('File with same name already exists in target folder');
    }

    // Move file
    const result = await trx
      .updateTable('files')
      .set({
        folder_id: newFolderId,
        version: sql`version + 1`,
        updated_at: new Date(),
      })
      .where('id', '=', fileId)
      .where('version', '=', expectedVersion)
      .returningAll()
      .executeTakeFirst();

    if (!result) {
      throw new ConflictError('File was modified by another user');
    }

    return result;
  });
}
```

## Indexes Overview

| Table | Index | Purpose |
|-------|-------|---------|
| repos | slug | Fast slug lookups |
| repos | last_accessed_at | Expiry queries |
| folders | (repo_id, parent_folder_id, name) | Unique names, prevent duplicates |
| files | (repo_id, folder_id, name) | Unique names, prevent duplicates |
| logs | timestamp | Log queries and cleanup |
| logs | repo_id | Repo-specific logs |

## Security Checklist

- ✅ Password hashing: Use bcrypt/argon2
- ✅ Parameterized queries: Kysely handles this
- ✅ IP anonymization: Hash IPs before logging
- ✅ Cascade deletes: Prevent orphaned data
- ✅ No PII: Don't store personal information
- ✅ Access tokens: Validate at application layer
- ✅ Version checks: Prevent concurrent modification conflicts
