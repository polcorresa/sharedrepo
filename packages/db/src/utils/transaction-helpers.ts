import { Kysely, Transaction } from 'kysely';
import type { Database } from '../types.js';
import { FolderRepository } from '../repositories/folder.repository.js';
import { FileRepository } from '../repositories/file.repository.js';
import { FileContentRepository } from '../repositories/file-content.repository.js';

/**
 * Transaction helpers for tree operations
 * Provides atomic operations for complex multi-step tree modifications
 */

export interface TreeOperationContext {
  folder: FolderRepository;
  file: FileRepository;
  content: FileContentRepository;
}

/**
 * Execute a function within a transaction
 * All operations succeed or fail together
 */
export async function withTransaction<T>(
  db: Kysely<Database>,
  fn: (trx: Transaction<Database>, ctx: TreeOperationContext) => Promise<T>
): Promise<T> {
  return await db.transaction().execute(async (trx) => {
    const context: TreeOperationContext = {
      folder: new FolderRepository(trx),
      file: new FileRepository(trx),
      content: new FileContentRepository(trx),
    };
    return await fn(trx, context);
  });
}

/**
 * Move file to different folder atomically
 * Checks for conflicts and moves in single transaction
 */
export async function moveFileToFolder(
  db: Kysely<Database>,
  fileId: number,
  newFolderId: number,
  expectedVersion: number
): Promise<{ fileId: number; oldFolderId: number; newFolderId: number }> {
  return await withTransaction(db, async (trx, ctx) => {
    // Get current file
    const file = await ctx.file.findById(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    const oldFolderId = file.folder_id;

    // Move file (validates target folder, checks duplicates)
    await ctx.file.move(fileId, newFolderId, expectedVersion);

    return { fileId, oldFolderId, newFolderId };
  });
}

/**
 * Move folder to different parent atomically
 * Checks for cycles, conflicts, and moves in single transaction
 */
export async function moveFolderToParent(
  db: Kysely<Database>,
  folderId: number,
  newParentId: number | null,
  expectedVersion: number
): Promise<{ folderId: number; oldParentId: number | null; newParentId: number | null }> {
  return await withTransaction(db, async (trx, ctx) => {
    // Get current folder
    const folder = await ctx.folder.findById(folderId);
    if (!folder) {
      throw new Error('Folder not found');
    }

    const oldParentId = folder.parent_folder_id;

    // Move folder (validates cycles, checks duplicates)
    await ctx.folder.move(folderId, newParentId, expectedVersion);

    return { folderId, oldParentId, newParentId };
  });
}

/**
 * Delete folder and all contents atomically
 * Cascade deletes are handled by database, but wrapped in transaction
 */
export async function deleteFolderWithContents(
  db: Kysely<Database>,
  folderId: number,
  expectedVersion: number
): Promise<{ deletedFolderId: number }> {
  return await withTransaction(db, async (trx, ctx) => {
    // Delete folder (cascade will delete children, files, and contents)
    await ctx.folder.delete(folderId, expectedVersion);

    return { deletedFolderId: folderId };
  });
}

/**
 * Delete file and its content atomically
 */
export async function deleteFileWithContent(
  db: Kysely<Database>,
  fileId: number,
  expectedVersion: number
): Promise<{ deletedFileId: number }> {
  return await withTransaction(db, async (trx, ctx) => {
    // Delete file (cascade will delete content)
    await ctx.file.delete(fileId, expectedVersion);

    return { deletedFileId: fileId };
  });
}

/**
 * Rename folder atomically with duplicate check
 */
export async function renameFolderSafely(
  db: Kysely<Database>,
  folderId: number,
  newName: string,
  expectedVersion: number
): Promise<{ folderId: number; oldName: string; newName: string }> {
  return await withTransaction(db, async (trx, ctx) => {
    // Get current folder
    const folder = await ctx.folder.findById(folderId);
    if (!folder) {
      throw new Error('Folder not found');
    }

    const oldName = folder.name;

    // Rename (checks for duplicates in same parent)
    await ctx.folder.rename(folderId, newName, expectedVersion);

    return { folderId, oldName, newName };
  });
}

/**
 * Rename file atomically with duplicate check
 */
export async function renameFileSafely(
  db: Kysely<Database>,
  fileId: number,
  newName: string,
  expectedVersion: number
): Promise<{ fileId: number; oldName: string; newName: string; languageHint: string | null }> {
  return await withTransaction(db, async (trx, ctx) => {
    // Get current file
    const file = await ctx.file.findById(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    const oldName = file.name;

    // Rename (checks for duplicates, updates language hint)
    const renamed = await ctx.file.rename(fileId, newName, expectedVersion);

    return {
      fileId,
      oldName,
      newName,
      languageHint: renamed.language_hint,
    };
  });
}

/**
 * Create file with initial content atomically
 */
export async function createFileWithContent(
  db: Kysely<Database>,
  repoId: number,
  folderId: number,
  fileName: string,
  content: string
): Promise<{ fileId: number; contentId: number }> {
  return await withTransaction(db, async (trx, ctx) => {
    // Create file
    const file = await ctx.file.create({
      repo_id: repoId,
      folder_id: folderId,
      name: fileName,
    });

    // Create content
    const fileContent = await ctx.content.set({
      file_id: file.id,
      repo_id: repoId,
      text: content,
    });

    return { fileId: file.id, contentId: fileContent.file_id };
  });
}

/**
 * Create folder with initial subfolder and file atomically
 */
export async function createFolderWithInitialContent(
  db: Kysely<Database>,
  repoId: number,
  parentFolderId: number | null,
  folderName: string,
  initialFileName?: string,
  initialFileContent?: string
): Promise<{
  folderId: number;
  fileId?: number;
}> {
  return await withTransaction(db, async (trx, ctx) => {
    // Create folder
    const folder = await ctx.folder.create({
      repo_id: repoId,
      parent_folder_id: parentFolderId,
      name: folderName,
    });

    let fileId: number | undefined;

    // Create initial file if provided
    if (initialFileName && initialFileContent !== undefined) {
      const file = await ctx.file.create({
        repo_id: repoId,
        folder_id: folder.id,
        name: initialFileName,
      });

      await ctx.content.set({
        file_id: file.id,
        repo_id: repoId,
        text: initialFileContent,
      });

      fileId = file.id;
    }

    return { folderId: folder.id, fileId };
  });
}

/**
 * Duplicate file within same folder or to different folder
 */
export async function duplicateFile(
  db: Kysely<Database>,
  sourceFileId: number,
  targetFolderId: number,
  newName: string
): Promise<{ sourceFileId: number; newFileId: number }> {
  return await withTransaction(db, async (trx, ctx) => {
    // Get source file
    const sourceFile = await ctx.file.findById(sourceFileId);
    if (!sourceFile) {
      throw new Error('Source file not found');
    }

    // Get source content
    const sourceContent = await ctx.content.getByFileId(sourceFileId);
    if (!sourceContent) {
      throw new Error('Source file content not found');
    }

    // Create new file
    const newFile = await ctx.file.create({
      repo_id: sourceFile.repo_id,
      folder_id: targetFolderId,
      name: newName,
      language_hint: sourceFile.language_hint,
    });

    // Copy content
    await ctx.content.set({
      file_id: newFile.id,
      repo_id: sourceFile.repo_id,
      text: sourceContent.text,
    });

    return { sourceFileId, newFileId: newFile.id };
  });
}

/**
 * Batch create multiple files with content atomically
 */
export async function batchCreateFiles(
  db: Kysely<Database>,
  repoId: number,
  folderId: number,
  files: Array<{ name: string; content: string }>
): Promise<{ fileIds: number[] }> {
  return await withTransaction(db, async (trx, ctx) => {
    const fileIds: number[] = [];

    for (const fileData of files) {
      const file = await ctx.file.create({
        repo_id: repoId,
        folder_id: folderId,
        name: fileData.name,
      });

      await ctx.content.set({
        file_id: file.id,
        repo_id: repoId,
        text: fileData.content,
      });

      fileIds.push(file.id);
    }

    return { fileIds };
  });
}

/**
 * Move multiple files to a different folder atomically
 */
export async function batchMoveFiles(
  db: Kysely<Database>,
  fileIds: number[],
  targetFolderId: number,
  expectedVersions: Map<number, number>
): Promise<{ movedFileIds: number[] }> {
  return await withTransaction(db, async (trx, ctx) => {
    const movedFileIds: number[] = [];

    for (const fileId of fileIds) {
      const expectedVersion = expectedVersions.get(fileId);
      if (expectedVersion === undefined) {
        throw new Error(`Missing version for file ${fileId}`);
      }

      await ctx.file.move(fileId, targetFolderId, expectedVersion);
      movedFileIds.push(fileId);
    }

    return { movedFileIds };
  });
}

/**
 * Rename multiple files atomically (useful for batch operations)
 */
export async function batchRenameFiles(
  db: Kysely<Database>,
  renames: Array<{ fileId: number; newName: string; expectedVersion: number }>
): Promise<{ renamedFileIds: number[] }> {
  return await withTransaction(db, async (trx, ctx) => {
    const renamedFileIds: number[] = [];

    for (const rename of renames) {
      await ctx.file.rename(rename.fileId, rename.newName, rename.expectedVersion);
      renamedFileIds.push(rename.fileId);
    }

    return { renamedFileIds };
  });
}

/**
 * Update file content and return updated size
 */
export async function updateFileContentSafely(
  db: Kysely<Database>,
  fileId: number,
  newContent: string
): Promise<{ fileId: number; oldSize: number; newSize: number }> {
  return await withTransaction(db, async (trx, ctx) => {
    // Get current file
    const file = await ctx.file.findById(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    const oldSize = file.size_bytes;

    // Update content (automatically updates file size)
    await ctx.content.updateText(fileId, newContent);

    // Get updated file to get new size
    const updatedFile = await ctx.file.findById(fileId);
    const newSize = updatedFile?.size_bytes || 0;

    return { fileId, oldSize, newSize };
  });
}
