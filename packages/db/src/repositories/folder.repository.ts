import { Kysely, sql } from 'kysely';
import type { Database, Folder, NewFolder, FolderUpdate } from '../types.js';
import { NotFoundError, ConflictError, ValidationError } from '../errors.js';

export class FolderRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Create a new folder
   */
  async create(data: NewFolder): Promise<Folder> {
    // Check for duplicate name in same parent
    const query = this.db
      .selectFrom('folders')
      .select('id')
      .where('repo_id', '=', data.repo_id)
      .where('name', '=', data.name);

    const existing = await (data.parent_folder_id === null || data.parent_folder_id === undefined
      ? query.where('parent_folder_id', 'is', null)
      : query.where('parent_folder_id', '=', data.parent_folder_id)
    ).executeTakeFirst();

    if (existing) {
      throw new ConflictError(
        `Folder with name "${data.name}" already exists in this location`
      );
    }

    return await this.db
      .insertInto('folders')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Find folder by ID
   */
  async findById(id: number): Promise<Folder | null> {
    return await this.db
      .selectFrom('folders')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
      .then((folder) => folder || null);
  }

  /**
   * Find all folders in a repo
   */
  async findByRepoId(repoId: number): Promise<Folder[]> {
    return await this.db
      .selectFrom('folders')
      .selectAll()
      .where('repo_id', '=', repoId)
      .orderBy('id', 'asc')
      .execute();
  }

  /**
   * Find root folders (folders with no parent) for a repo
   */
  async findRootFolders(repoId: number): Promise<Folder[]> {
    return await this.db
      .selectFrom('folders')
      .selectAll()
      .where('repo_id', '=', repoId)
      .where('parent_folder_id', 'is', null)
      .execute();
  }

  /**
   * Find child folders of a parent
   */
  async findChildren(parentFolderId: number): Promise<Folder[]> {
    return await this.db
      .selectFrom('folders')
      .selectAll()
      .where('parent_folder_id', '=', parentFolderId)
      .execute();
  }

  /**
   * Rename folder with optimistic concurrency control
   */
  async rename(
    id: number,
    newName: string,
    expectedVersion: number
  ): Promise<Folder> {
    // Get current folder
    const currentFolder = await this.findById(id);
    if (!currentFolder) {
      throw new NotFoundError(`Folder with id ${id} not found`);
    }

    // Check for duplicate name in same parent
    const query = this.db
      .selectFrom('folders')
      .select('id')
      .where('repo_id', '=', currentFolder.repo_id)
      .where('name', '=', newName)
      .where('id', '!=', id);

    const duplicate = await (currentFolder.parent_folder_id === null
      ? query.where('parent_folder_id', 'is', null)
      : query.where('parent_folder_id', '=', currentFolder.parent_folder_id)
    ).executeTakeFirst();

    if (duplicate) {
      throw new ConflictError(
        `Folder with name "${newName}" already exists in this location`
      );
    }

    // Update with version check
    const updated = await this.db
      .updateTable('folders')
      .set({
        name: newName,
        version: sql`version + 1`,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .where('version', '=', expectedVersion)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      throw new ConflictError(
        'Folder was modified by another user. Please refresh and try again.'
      );
    }

    return updated;
  }

  /**
   * Move folder to a new parent with optimistic concurrency control
   */
  async move(
    id: number,
    newParentFolderId: number | null,
    expectedVersion: number
  ): Promise<Folder> {
    // Get current folder
    const currentFolder = await this.findById(id);
    if (!currentFolder) {
      throw new NotFoundError(`Folder with id ${id} not found`);
    }

    // Validate new parent exists if not null
    if (newParentFolderId !== null) {
      const newParent = await this.findById(newParentFolderId);
      if (!newParent) {
        throw new NotFoundError(`Target folder with id ${newParentFolderId} not found`);
      }

      // Ensure new parent is in same repo
      if (newParent.repo_id !== currentFolder.repo_id) {
        throw new ValidationError('Cannot move folder to a different repo');
      }

      // Check for cycles (cannot move into own descendants)
      const wouldCreateCycle = await this.isDescendant(newParentFolderId, id);
      if (wouldCreateCycle) {
        throw new ValidationError('Cannot move folder into its own descendants');
      }
    }

    // Check for duplicate name in new parent
    const query = this.db
      .selectFrom('folders')
      .select('id')
      .where('repo_id', '=', currentFolder.repo_id)
      .where('name', '=', currentFolder.name)
      .where('id', '!=', id);

    const duplicate = await (newParentFolderId === null
      ? query.where('parent_folder_id', 'is', null)
      : query.where('parent_folder_id', '=', newParentFolderId)
    ).executeTakeFirst();

    if (duplicate) {
      throw new ConflictError(
        `Folder with name "${currentFolder.name}" already exists in target location`
      );
    }

    // Update with version check
    const updated = await this.db
      .updateTable('folders')
      .set({
        parent_folder_id: newParentFolderId,
        version: sql`version + 1`,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .where('version', '=', expectedVersion)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      throw new ConflictError(
        'Folder was modified by another user. Please refresh and try again.'
      );
    }

    return updated;
  }

  /**
   * Check if potentialDescendant is a descendant of potentialAncestor
   * (Used for cycle detection)
   */
  private async isDescendant(
    potentialDescendant: number,
    potentialAncestor: number
  ): Promise<boolean> {
    let currentId: number | null = potentialDescendant;

    // Walk up the tree from potentialDescendant
    while (currentId !== null) {
      if (currentId === potentialAncestor) {
        return true;
      }

      const folder = await this.findById(currentId);
      if (!folder) {
        break;
      }
      currentId = folder.parent_folder_id;
    }

    return false;
  }

  /**
   * Delete folder (cascade will delete children)
   */
  async delete(id: number, expectedVersion: number): Promise<void> {
    const result = await this.db
      .deleteFrom('folders')
      .where('id', '=', id)
      .where('version', '=', expectedVersion)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      const folder = await this.findById(id);
      if (!folder) {
        throw new NotFoundError(`Folder with id ${id} not found`);
      }
      throw new ConflictError(
        'Folder was modified by another user. Please refresh and try again.'
      );
    }
  }

  /**
   * Count folders in a repo
   */
  async countByRepoId(repoId: number): Promise<number> {
    const result = await this.db
      .selectFrom('folders')
      .select((eb) => eb.fn.count<number>('id').as('count'))
      .where('repo_id', '=', repoId)
      .executeTakeFirst();

    return result?.count || 0;
  }
}
