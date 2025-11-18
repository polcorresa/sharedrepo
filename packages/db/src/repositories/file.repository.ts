import { Kysely, sql } from 'kysely';
import type { Database, File, NewFile, FileUpdate } from '../types.js';
import { NotFoundError, ConflictError, ValidationError } from '../errors.js';
import { getLanguageFromExtension } from '../utils/language-mapping.js';

export class FileRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Create a new file
   */
  async create(data: NewFile): Promise<File> {
    // Auto-detect language from extension if not provided
    const fileData = {
      ...data,
      language_hint: data.language_hint || getLanguageFromExtension(data.name),
    };

    // Check for duplicate name in same folder
    const existing = await this.db
      .selectFrom('files')
      .select('id')
      .where('repo_id', '=', fileData.repo_id)
      .where('folder_id', '=', fileData.folder_id)
      .where('name', '=', fileData.name)
      .executeTakeFirst();

    if (existing) {
      throw new ConflictError(
        `File with name "${fileData.name}" already exists in this folder`
      );
    }

    return await this.db
      .insertInto('files')
      .values(fileData)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Find file by ID
   */
  async findById(id: number): Promise<File | null> {
    return await this.db
      .selectFrom('files')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
      .then((file) => file || null);
  }

  /**
   * Find all files in a repo
   */
  async findByRepoId(repoId: number): Promise<File[]> {
    return await this.db
      .selectFrom('files')
      .selectAll()
      .where('repo_id', '=', repoId)
      .orderBy('id', 'asc')
      .execute();
  }

  /**
   * Find files in a specific folder
   */
  async findByFolderId(folderId: number): Promise<File[]> {
    return await this.db
      .selectFrom('files')
      .selectAll()
      .where('folder_id', '=', folderId)
      .execute();
  }

  /**
   * Rename file with optimistic concurrency control
   */
  async rename(
    id: number,
    newName: string,
    expectedVersion: number
  ): Promise<File> {
    // Get current file
    const currentFile = await this.findById(id);
    if (!currentFile) {
      throw new NotFoundError(`File with id ${id} not found`);
    }

    // Check for duplicate name in same folder
    const duplicate = await this.db
      .selectFrom('files')
      .select('id')
      .where('repo_id', '=', currentFile.repo_id)
      .where('folder_id', '=', currentFile.folder_id)
      .where('name', '=', newName)
      .where('id', '!=', id)
      .executeTakeFirst();

    if (duplicate) {
      throw new ConflictError(
        `File with name "${newName}" already exists in this folder`
      );
    }

    // Auto-detect language from new extension
    const newLanguageHint = getLanguageFromExtension(newName);

    // Update with version check
    const updated = await this.db
      .updateTable('files')
      .set({
        name: newName,
        language_hint: newLanguageHint,
        version: sql`version + 1`,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .where('version', '=', expectedVersion)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      throw new ConflictError(
        'File was modified by another user. Please refresh and try again.'
      );
    }

    return updated;
  }

  /**
   * Move file to a new folder with optimistic concurrency control
   */
  async move(
    id: number,
    newFolderId: number,
    expectedVersion: number
  ): Promise<File> {
    // Get current file
    const currentFile = await this.findById(id);
    if (!currentFile) {
      throw new NotFoundError(`File with id ${id} not found`);
    }

    // Validate new folder exists
    const newFolder = await this.db
      .selectFrom('folders')
      .select(['id', 'repo_id'])
      .where('id', '=', newFolderId)
      .executeTakeFirst();

    if (!newFolder) {
      throw new NotFoundError(`Target folder with id ${newFolderId} not found`);
    }

    // Ensure new folder is in same repo
    if (newFolder.repo_id !== currentFile.repo_id) {
      throw new ValidationError('Cannot move file to a different repo');
    }

    // Check for duplicate name in new folder
    const duplicate = await this.db
      .selectFrom('files')
      .select('id')
      .where('repo_id', '=', currentFile.repo_id)
      .where('folder_id', '=', newFolderId)
      .where('name', '=', currentFile.name)
      .where('id', '!=', id)
      .executeTakeFirst();

    if (duplicate) {
      throw new ConflictError(
        `File with name "${currentFile.name}" already exists in target folder`
      );
    }

    // Update with version check
    const updated = await this.db
      .updateTable('files')
      .set({
        folder_id: newFolderId,
        version: sql`version + 1`,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .where('version', '=', expectedVersion)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      throw new ConflictError(
        'File was modified by another user. Please refresh and try again.'
      );
    }

    return updated;
  }

  /**
   * Update file size
   */
  async updateSize(id: number, sizeBytes: number): Promise<File> {
    const updated = await this.db
      .updateTable('files')
      .set({
        size_bytes: sizeBytes,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      throw new NotFoundError(`File with id ${id} not found`);
    }

    return updated;
  }

  /**
   * Delete file
   */
  async delete(id: number, expectedVersion: number): Promise<void> {
    const result = await this.db
      .deleteFrom('files')
      .where('id', '=', id)
      .where('version', '=', expectedVersion)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      const file = await this.findById(id);
      if (!file) {
        throw new NotFoundError(`File with id ${id} not found`);
      }
      throw new ConflictError(
        'File was modified by another user. Please refresh and try again.'
      );
    }
  }

  /**
   * Count files in a repo
   */
  async countByRepoId(repoId: number): Promise<number> {
    const result = await this.db
      .selectFrom('files')
      .select((eb) => eb.fn.count<number>('id').as('count'))
      .where('repo_id', '=', repoId)
      .executeTakeFirst();

    return result?.count || 0;
  }

  /**
   * Count files in a folder
   */
  async countByFolderId(folderId: number): Promise<number> {
    const result = await this.db
      .selectFrom('files')
      .select((eb) => eb.fn.count<number>('id').as('count'))
      .where('folder_id', '=', folderId)
      .executeTakeFirst();

    return result?.count || 0;
  }

  /**
   * Get total size of all files in a repo
   */
  async getTotalSizeByRepoId(repoId: number): Promise<number> {
    const result = await this.db
      .selectFrom('files')
      .select((eb) => eb.fn.sum<number>('size_bytes').as('total'))
      .where('repo_id', '=', repoId)
      .executeTakeFirst();

    return result?.total || 0;
  }
}
