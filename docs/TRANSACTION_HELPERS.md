# Transaction Helpers Guide

## Overview

Transaction helpers provide atomic, type-safe operations for complex tree modifications. All operations within a transaction succeed or fail together, ensuring data consistency.

## Why Use Transaction Helpers?

1. **Atomicity** - All steps succeed or fail together
2. **Simplified API** - High-level operations instead of manual coordination
3. **Error Safety** - Automatic rollback on failure
4. **Validation** - Built-in constraint checking
5. **Type Safety** - Full TypeScript support

## Core Helper: `withTransaction`

Execute any function within a database transaction with repository context.

```typescript
import { withTransaction } from '@sharedrepo/db';

const result = await withTransaction(db, async (trx, ctx) => {
  // ctx.folder - FolderRepository instance
  // ctx.file - FileRepository instance
  // ctx.content - FileContentRepository instance
  
  // All operations here are atomic
  const folder = await ctx.folder.create({ ... });
  const file = await ctx.file.create({ ... });
  
  return { folder, file };
});
```

## File Operations

### Create File with Content

Creates a file and sets its initial content atomically.

```typescript
import { createFileWithContent } from '@sharedrepo/db';

const { fileId, contentId } = await createFileWithContent(
  db,
  repoId,
  folderId,
  'index.ts',
  'console.log("Hello");'
);
```

**Benefits:**
- File and content created in single transaction
- Automatic size calculation
- Language hint auto-detected

### Move File to Folder

Moves a file to a different folder with validation.

```typescript
import { moveFileToFolder } from '@sharedrepo/db';

const result = await moveFileToFolder(
  db,
  fileId,
  newFolderId,
  expectedVersion
);

console.log(`Moved file ${result.fileId}`);
console.log(`From folder ${result.oldFolderId} to ${result.newFolderId}`);
```

**Validation:**
- Target folder exists
- No duplicate names
- Same repo
- Version check

### Rename File Safely

Renames a file with duplicate detection and language hint update.

```typescript
import { renameFileSafely } from '@sharedrepo/db';

const result = await renameFileSafely(
  db,
  fileId,
  'main.py', // New name
  expectedVersion
);

console.log(`Renamed from ${result.oldName} to ${result.newName}`);
console.log(`Language hint: ${result.languageHint}`); // 'python'
```

**Features:**
- Checks for duplicate names
- Updates language hint automatically
- Version check prevents conflicts

### Delete File with Content

Deletes a file and its content atomically.

```typescript
import { deleteFileWithContent } from '@sharedrepo/db';

const { deletedFileId } = await deleteFileWithContent(
  db,
  fileId,
  expectedVersion
);
```

**Note:** Cascade delete handles content automatically, but transaction ensures atomicity.

### Update File Content Safely

Updates file content and tracks size change.

```typescript
import { updateFileContentSafely } from '@sharedrepo/db';

const result = await updateFileContentSafely(
  db,
  fileId,
  'console.log("Updated");'
);

console.log(`Size changed from ${result.oldSize} to ${result.newSize} bytes`);
```

### Duplicate File

Copies a file to the same or different folder.

```typescript
import { duplicateFile } from '@sharedrepo/db';

const { sourceFileId, newFileId } = await duplicateFile(
  db,
  sourceFileId,
  targetFolderId,
  'copy-of-file.ts'
);
```

**Features:**
- Copies file metadata and content
- Can copy to same or different folder
- Language hint preserved

## Folder Operations

### Create Folder with Initial Content

Creates a folder optionally with an initial file.

```typescript
import { createFolderWithInitialContent } from '@sharedrepo/db';

const result = await createFolderWithInitialContent(
  db,
  repoId,
  parentFolderId,
  'src',
  'index.ts', // Optional initial file
  'console.log("Hello");' // Optional content
);

console.log(`Created folder ${result.folderId}`);
console.log(`Created file ${result.fileId}`);
```

### Move Folder to Parent

Moves a folder to a different parent with cycle detection.

```typescript
import { moveFolderToParent } from '@sharedrepo/db';

const result = await moveFolderToParent(
  db,
  folderId,
  newParentId, // or null for root
  expectedVersion
);

console.log(`Moved folder ${result.folderId}`);
console.log(`From parent ${result.oldParentId} to ${result.newParentId}`);
```

**Validation:**
- Cycle detection (can't move into descendants)
- No duplicate names
- Same repo
- Version check

### Rename Folder Safely

Renames a folder with duplicate detection.

```typescript
import { renameFolderSafely } from '@sharedrepo/db';

const result = await renameFolderSafely(
  db,
  folderId,
  'source',
  expectedVersion
);

console.log(`Renamed from ${result.oldName} to ${result.newName}`);
```

### Delete Folder with Contents

Deletes a folder and all its contents recursively.

```typescript
import { deleteFolderWithContents } from '@sharedrepo/db';

const { deletedFolderId } = await deleteFolderWithContents(
  db,
  folderId,
  expectedVersion
);
```

**Note:** Cascade delete handles all children, files, and content.

## Batch Operations

### Batch Create Files

Creates multiple files with content atomically.

```typescript
import { batchCreateFiles } from '@sharedrepo/db';

const { fileIds } = await batchCreateFiles(
  db,
  repoId,
  folderId,
  [
    { name: 'file1.ts', content: 'console.log(1);' },
    { name: 'file2.ts', content: 'console.log(2);' },
    { name: 'file3.ts', content: 'console.log(3);' },
  ]
);

console.log(`Created ${fileIds.length} files`);
```

**Benefits:**
- All files created or none
- Single transaction
- Efficient batch processing

### Batch Move Files

Moves multiple files to a target folder atomically.

```typescript
import { batchMoveFiles } from '@sharedrepo/db';

const versions = new Map([
  [fileId1, version1],
  [fileId2, version2],
  [fileId3, version3],
]);

const { movedFileIds } = await batchMoveFiles(
  db,
  [fileId1, fileId2, fileId3],
  targetFolderId,
  versions
);

console.log(`Moved ${movedFileIds.length} files`);
```

**Features:**
- All moves succeed or fail together
- Version check on each file
- Duplicate detection

### Batch Rename Files

Renames multiple files atomically.

```typescript
import { batchRenameFiles } from '@sharedrepo/db';

const { renamedFileIds } = await batchRenameFiles(
  db,
  [
    { fileId: id1, newName: 'new1.ts', expectedVersion: v1 },
    { fileId: id2, newName: 'new2.ts', expectedVersion: v2 },
    { fileId: id3, newName: 'new3.ts', expectedVersion: v3 },
  ]
);
```

## Error Handling

All transaction helpers throw appropriate errors:

```typescript
import { 
  moveFileToFolder,
  ConflictError,
  NotFoundError,
  ValidationError 
} from '@sharedrepo/db';

try {
  await moveFileToFolder(db, fileId, folderId, version);
} catch (error) {
  if (error instanceof ConflictError) {
    // Version mismatch or duplicate name
    console.error('Conflict:', error.message);
  } else if (error instanceof NotFoundError) {
    // File or folder not found
    console.error('Not found:', error.message);
  } else if (error instanceof ValidationError) {
    // Business rule violation
    console.error('Validation:', error.message);
  } else {
    // Unexpected error
    throw error;
  }
}
```

## Custom Transactions

Use `withTransaction` for custom operations:

```typescript
import { withTransaction, ConflictError } from '@sharedrepo/db';

async function moveFilesAcrossFolders(
  db: Kysely<Database>,
  sourceFileIds: number[],
  targetFolderIds: number[]
) {
  return await withTransaction(db, async (trx, ctx) => {
    const results = [];
    
    for (let i = 0; i < sourceFileIds.length; i++) {
      const file = await ctx.file.findById(sourceFileIds[i]);
      if (!file) continue;
      
      await ctx.file.move(
        sourceFileIds[i],
        targetFolderIds[i],
        file.version
      );
      
      results.push({ fileId: sourceFileIds[i], moved: true });
    }
    
    return results;
  });
}
```

## Real-World Examples

### Example 1: Reorganize Project Structure

```typescript
import { 
  withTransaction,
  createFolderWithInitialContent,
  batchMoveFiles 
} from '@sharedrepo/db';

async function reorganizeProject(db: Kysely<Database>, repoId: number) {
  return await withTransaction(db, async (trx, ctx) => {
    // Create new folder structure
    const { folderId: srcId } = await ctx.folder.create({
      repo_id: repoId,
      parent_folder_id: null,
      name: 'src',
    });
    
    const { folderId: testsId } = await ctx.folder.create({
      repo_id: repoId,
      parent_folder_id: null,
      name: 'tests',
    });
    
    // Move source files
    const sourceFiles = await ctx.file.findByFolderId(oldFolderId);
    const versions = new Map(sourceFiles.map(f => [f.id, f.version]));
    
    await batchMoveFiles(
      trx,
      sourceFiles.map(f => f.id),
      srcId,
      versions
    );
    
    return { srcId, testsId };
  });
}
```

### Example 2: Duplicate Folder with Contents

```typescript
async function duplicateFolder(
  db: Kysely<Database>,
  sourceFolderId: number,
  targetParentId: number | null,
  newFolderName: string
) {
  return await withTransaction(db, async (trx, ctx) => {
    // Get source folder
    const sourceFolder = await ctx.folder.findById(sourceFolderId);
    if (!sourceFolder) throw new Error('Source folder not found');
    
    // Create new folder
    const newFolder = await ctx.folder.create({
      repo_id: sourceFolder.repo_id,
      parent_folder_id: targetParentId,
      name: newFolderName,
    });
    
    // Get all files in source folder
    const files = await ctx.file.findByFolderId(sourceFolderId);
    
    // Copy each file
    for (const file of files) {
      const content = await ctx.content.getByFileId(file.id);
      
      const newFile = await ctx.file.create({
        repo_id: file.repo_id,
        folder_id: newFolder.id,
        name: file.name,
        language_hint: file.language_hint,
      });
      
      if (content) {
        await ctx.content.set({
          file_id: newFile.id,
          repo_id: file.repo_id,
          text: content.text,
        });
      }
    }
    
    return { newFolderId: newFolder.id, fileCount: files.length };
  });
}
```

### Example 3: Atomic Multi-File Edit

```typescript
async function applyTemplateToFiles(
  db: Kysely<Database>,
  fileIds: number[],
  template: string
) {
  return await withTransaction(db, async (trx, ctx) => {
    const results = [];
    
    for (const fileId of fileIds) {
      const file = await ctx.file.findById(fileId);
      if (!file) continue;
      
      // Apply template
      const newContent = template.replace('{{filename}}', file.name);
      
      await ctx.content.updateText(fileId, newContent);
      
      results.push({ fileId, updated: true });
    }
    
    return results;
  });
}
```

## Performance Tips

1. **Use batch operations** when possible instead of multiple transactions
2. **Keep transactions short** - minimize time holding locks
3. **Validate before transaction** - check constraints outside if possible
4. **Use specific helpers** instead of manual `withTransaction` when available

## Best Practices

1. **Always use version checks** for tree operations
2. **Handle ConflictError** and prompt user to refresh
3. **Log transaction outcomes** for debugging
4. **Test rollback scenarios** to ensure atomicity
5. **Use batch operations** for multiple related changes

## Comparison: Manual vs Helper

### Manual (Error-Prone)

```typescript
// ❌ Not atomic - can leave inconsistent state
const file = await fileRepo.create({ ... });
// If this fails, file exists without content!
await contentRepo.set({ file_id: file.id, ... });
```

### With Helper (Safe)

```typescript
// ✅ Atomic - both succeed or both fail
const { fileId } = await createFileWithContent(
  db,
  repoId,
  folderId,
  'file.ts',
  'content'
);
```

## Available Helpers Summary

| Helper | Purpose | Atomic Operations |
|--------|---------|-------------------|
| `withTransaction` | Custom transaction | Any |
| `createFileWithContent` | Create file + content | 2 |
| `moveFileToFolder` | Move file | 1 + validation |
| `renameFileSafely` | Rename file | 1 + validation |
| `deleteFileWithContent` | Delete file | 1 (cascade) |
| `updateFileContentSafely` | Update content | 1 |
| `duplicateFile` | Copy file | 2 |
| `createFolderWithInitialContent` | Create folder + file | 2-3 |
| `moveFolderToParent` | Move folder | 1 + validation |
| `renameFolderSafely` | Rename folder | 1 + validation |
| `deleteFolderWithContents` | Delete folder | 1 (cascade) |
| `batchCreateFiles` | Create many files | N × 2 |
| `batchMoveFiles` | Move many files | N |
| `batchRenameFiles` | Rename many files | N |

## Transaction Context

The `TreeOperationContext` provides repository instances scoped to the transaction:

```typescript
interface TreeOperationContext {
  folder: FolderRepository;
  file: FileRepository;
  content: FileContentRepository;
}
```

All operations through these repositories are part of the transaction.

---

Use transaction helpers to ensure data consistency and simplify complex tree operations!
