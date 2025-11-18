/**
 * Database Schema Validation Tests
 * 
 * This file demonstrates the complete schema with type-safe examples.
 * Run this conceptually to validate types compile correctly.
 */

import { Kysely } from 'kysely';
import type {
  Database,
  Repo,
  NewRepo,
  RepoUpdate,
  Folder,
  NewFolder,
  FolderUpdate,
  File,
  NewFile,
  FileUpdate,
  FileContent,
  NewFileContent,
  FileContentUpdate,
  YjsPersistence,
  NewYjsPersistence,
  YjsPersistenceUpdate,
  Log,
  NewLog,
  LogUpdate,
} from './types.js';

/**
 * Type validation: All required fields are present
 */
function validateRepoTable(db: Kysely<Database>) {
  // Create repo
  const newRepo: NewRepo = {
    slug: 'test123',
    password_hash: '$2b$10$...',
  };

  // Update repo
  const repoUpdate: RepoUpdate = {
    last_accessed_at: new Date(),
    approx_size_bytes: 1024,
  };

  // Query repo
  const query = db
    .selectFrom('repos')
    .selectAll()
    .where('slug', '=', 'test123');

  return { newRepo, repoUpdate, query };
}

/**
 * Type validation: Folder tree structure
 */
function validateFolderTable(db: Kysely<Database>) {
  // Create root folder
  const rootFolder: NewFolder = {
    repo_id: 1,
    parent_folder_id: null,
    name: 'root',
  };

  // Create subfolder
  const subFolder: NewFolder = {
    repo_id: 1,
    parent_folder_id: 1,
    name: 'src',
  };

  // Update folder (rename with version)
  const folderUpdate: FolderUpdate = {
    name: 'renamed',
    version: 2,
    updated_at: new Date(),
  };

  return { rootFolder, subFolder, folderUpdate };
}

/**
 * Type validation: File metadata
 */
function validateFileTable(db: Kysely<Database>) {
  // Create file
  const newFile: NewFile = {
    repo_id: 1,
    folder_id: 1,
    name: 'index.ts',
    language_hint: 'typescript',
  };

  // Update file
  const fileUpdate: FileUpdate = {
    name: 'renamed.ts',
    size_bytes: 2048,
    version: 3,
    updated_at: new Date(),
  };

  return { newFile, fileUpdate };
}

/**
 * Type validation: File content storage
 */
function validateFileContentTable(db: Kysely<Database>) {
  // Create file content
  const newContent: NewFileContent = {
    file_id: 1,
    repo_id: 1,
    text: 'console.log("Hello");',
  };

  // Update content
  const contentUpdate: FileContentUpdate = {
    text: 'console.log("Updated");',
    updated_at: new Date(),
  };

  return { newContent, contentUpdate };
}

/**
 * Type validation: Yjs persistence
 */
function validateYjsPersistenceTable(db: Kysely<Database>) {
  // Create Yjs doc
  const newDoc: NewYjsPersistence = {
    document_key: 'repo:1:file:1',
    data: Buffer.from([0, 1, 2, 3]),
  };

  // Update doc
  const docUpdate: YjsPersistenceUpdate = {
    data: Buffer.from([4, 5, 6, 7]),
    updated_at: new Date(),
  };

  return { newDoc, docUpdate };
}

/**
 * Type validation: Logging
 */
function validateLogTable(db: Kysely<Database>) {
  // Create log entry
  const newLog: NewLog = {
    route: 'POST /api/repos',
    repo_id: 1,
    ip_hash: 'a3f5b2c1...',
    status_code: 201,
    error_code: null,
  };

  // Update log (rarely needed)
  const logUpdate: LogUpdate = {
    error_code: 'CONFLICT',
  };

  return { newLog, logUpdate };
}

/**
 * Complex query validation: Joins and relationships
 */
async function validateComplexQueries(db: Kysely<Database>) {
  // Get repo with folder count
  const repoWithCounts = await db
    .selectFrom('repos')
    .leftJoin('folders', 'folders.repo_id', 'repos.id')
    .select(['repos.id', 'repos.slug'])
    .select((eb) => eb.fn.count('folders.id').as('folder_count'))
    .where('repos.slug', '=', 'test')
    .groupBy('repos.id')
    .executeTakeFirst();

  // Get file with content
  const fileWithContent = await db
    .selectFrom('files')
    .innerJoin('file_contents', 'file_contents.file_id', 'files.id')
    .select([
      'files.id',
      'files.name',
      'files.language_hint',
      'file_contents.text',
    ])
    .where('files.id', '=', 1)
    .executeTakeFirst();

  // Get folder tree
  const folderTree = await db
    .selectFrom('folders as parent')
    .leftJoin('folders as child', 'child.parent_folder_id', 'parent.id')
    .select([
      'parent.id as parent_id',
      'parent.name as parent_name',
      'child.id as child_id',
      'child.name as child_name',
    ])
    .where('parent.repo_id', '=', 1)
    .execute();

  // Get expired repos
  const expiredRepos = await db
    .selectFrom('repos')
    .selectAll()
    .where('last_accessed_at', '<', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .execute();

  return {
    repoWithCounts,
    fileWithContent,
    folderTree,
    expiredRepos,
  };
}

/**
 * Transaction validation: Complex operations
 */
async function validateTransactions(db: Kysely<Database>) {
  // Move file to different folder
  await db.transaction().execute(async (trx) => {
    // Check target folder exists
    const targetFolder = await trx
      .selectFrom('folders')
      .select('id')
      .where('id', '=', 2)
      .executeTakeFirst();

    if (!targetFolder) {
      throw new Error('Target folder not found');
    }

    // Update file
    const result = await trx
      .updateTable('files')
      .set({ folder_id: 2, version: 2 })
      .where('id', '=', 1)
      .where('version', '=', 1)
      .returningAll()
      .executeTakeFirst();

    if (!result) {
      throw new Error('Version conflict');
    }

    return result;
  });
}

/**
 * Constraint validation: Unique constraints
 */
async function validateConstraints(db: Kysely<Database>) {
  // This would fail: duplicate slug
  try {
    await db
      .insertInto('repos')
      .values({
        slug: 'existing',
        password_hash: 'hash',
      })
      .execute();
  } catch (error) {
    // Expected: unique constraint violation
  }

  // This would fail: duplicate folder name in same parent
  try {
    await db
      .insertInto('folders')
      .values({
        repo_id: 1,
        parent_folder_id: 1,
        name: 'existing',
      })
      .execute();
  } catch (error) {
    // Expected: unique constraint violation
  }

  // This would fail: duplicate file name in same folder
  try {
    await db
      .insertInto('files')
      .values({
        repo_id: 1,
        folder_id: 1,
        name: 'existing.ts',
      })
      .execute();
  } catch (error) {
    // Expected: unique constraint violation
  }
}

/**
 * Cascade validation: Foreign key cascades
 */
async function validateCascades(db: Kysely<Database>) {
  // Deleting repo cascades to:
  // - folders
  // - files
  // - file_contents
  await db
    .deleteFrom('repos')
    .where('id', '=', 1)
    .execute();

  // All related data should be gone
  const folders = await db
    .selectFrom('folders')
    .selectAll()
    .where('repo_id', '=', 1)
    .execute();
  // folders.length === 0

  const files = await db
    .selectFrom('files')
    .selectAll()
    .where('repo_id', '=', 1)
    .execute();
  // files.length === 0

  // Logs should still exist but repo_id is NULL
  const logs = await db
    .selectFrom('logs')
    .selectAll()
    .where('repo_id', 'is', null)
    .execute();
  // logs can exist
}

/**
 * Index validation: Query performance
 */
async function validateIndexes(db: Kysely<Database>) {
  // These queries should use indexes:

  // 1. slug lookup (repos_slug_idx)
  await db
    .selectFrom('repos')
    .selectAll()
    .where('slug', '=', 'test')
    .execute();

  // 2. expiry check (repos_last_accessed_at_idx)
  await db
    .selectFrom('repos')
    .selectAll()
    .where('last_accessed_at', '<', new Date())
    .execute();

  // 3. log timestamp (logs_timestamp_idx)
  await db
    .selectFrom('logs')
    .selectAll()
    .where('timestamp', '>', new Date())
    .execute();

  // 4. repo logs (logs_repo_id_idx)
  await db
    .selectFrom('logs')
    .selectAll()
    .where('repo_id', '=', 1)
    .execute();
}

export {
  validateRepoTable,
  validateFolderTable,
  validateFileTable,
  validateFileContentTable,
  validateYjsPersistenceTable,
  validateLogTable,
  validateComplexQueries,
  validateTransactions,
  validateConstraints,
  validateCascades,
  validateIndexes,
};
