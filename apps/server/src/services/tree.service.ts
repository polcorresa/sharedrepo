import {
  FolderRepository,
  FileRepository,
  FileContentRepository,
  NotFoundError,
} from '@sharedrepo/db';
import { detectLanguage } from '@sharedrepo/shared';
import type { Kysely } from 'kysely';
import type { Database } from '@sharedrepo/db';
import type { TreeResponse, TreeFolderNode, TreeFileNode } from '@sharedrepo/shared';
import { metrics } from '../plugins/metrics.js';
import { treeEventService } from './tree-events.service.js';

/**
 * Service layer for tree operations
 * Handles business logic for folder/file structure management
 */
export class TreeService {
  private folderRepo: FolderRepository;
  private fileRepo: FileRepository;
  private fileContentRepo: FileContentRepository;

  constructor(db: Kysely<Database>) {
    this.folderRepo = new FolderRepository(db);
    this.fileRepo = new FileRepository(db);
    this.fileContentRepo = new FileContentRepository(db);
  }

  /**
   * Get complete tree structure for a repo
   */
  async getTree(repoId: number): Promise<TreeResponse> {
    const [folders, files] = await Promise.all([
      this.folderRepo.findByRepoId(repoId),
      this.fileRepo.findByRepoId(repoId),
    ]);

    return {
      folders: folders.map(this.mapToFolderNode),
      files: files.map(this.mapToFileNode),
    };
  }

  /**
   * Create a new folder
   */
  async createFolder(
    repoId: number,
    parentFolderId: number | null,
    name: string
  ): Promise<TreeFolderNode> {
    // Verify parent exists if specified
    if (parentFolderId !== null) {
      const parent = await this.folderRepo.findById(parentFolderId);
      if (!parent) {
        throw new NotFoundError(`Parent folder with id ${parentFolderId} not found`);
      }
      if (parent.repo_id !== repoId) {
        throw new NotFoundError('Parent folder does not belong to this repo');
      }
    }

    const now = new Date();
    const folder = await this.folderRepo.create({
      repo_id: repoId,
      parent_folder_id: parentFolderId,
      name,
      version: 0,
      created_at: now,
      updated_at: now,
    });

    const node = this.mapToFolderNode(folder);
    treeEventService.emitEvent({
      repoId,
      type: 'folder',
      operation: 'create',
      node,
    });

    metrics.treeOperationsTotal.inc({ operation: 'create_folder', status: 'success' });

    return node;
  }

  /**
   * Create a new file
   */
  async createFile(
    repoId: number,
    folderId: number,
    name: string
  ): Promise<TreeFileNode> {
    // Verify folder exists
    const folder = await this.folderRepo.findById(folderId);
    if (!folder) {
      throw new NotFoundError(`Folder with id ${folderId} not found`);
    }
    if (folder.repo_id !== repoId) {
      throw new NotFoundError('Folder does not belong to this repo');
    }

    const languageHint = detectLanguage(name);
    const now = new Date();

    const file = await this.fileRepo.create({
      repo_id: repoId,
      folder_id: folderId,
      name,
      language_hint: languageHint,
      size_bytes: 0,
      version: 0,
      created_at: now,
      updated_at: now,
    });

    // Create empty file content
    await this.fileContentRepo.set({
      file_id: file.id,
      repo_id: repoId,
      text: '',
    });

    const node = this.mapToFileNode(file);
    treeEventService.emitEvent({
      repoId,
      type: 'file',
      operation: 'create',
      node,
    });

    metrics.treeOperationsTotal.inc({ operation: 'create_file', status: 'success' });

    return node;
  }

  /**
   * Rename a folder
   */
  async renameFolder(
    id: number,
    newName: string,
    expectedVersion: number
  ): Promise<TreeFolderNode> {
    const folder = await this.folderRepo.rename(id, newName, expectedVersion);
    const node = this.mapToFolderNode(folder);
    
    treeEventService.emitEvent({
      repoId: folder.repo_id,
      type: 'folder',
      operation: 'rename',
      node,
    });

    metrics.treeOperationsTotal.inc({ operation: 'rename_folder', status: 'success' });
    return node;
  }

  /**
   * Rename a file
   */
  async renameFile(
    id: number,
    newName: string,
    expectedVersion: number
  ): Promise<TreeFileNode> {
    const file = await this.fileRepo.rename(id, newName, expectedVersion);
    const node = this.mapToFileNode(file);

    treeEventService.emitEvent({
      repoId: file.repo_id,
      type: 'file',
      operation: 'rename',
      node,
    });

    metrics.treeOperationsTotal.inc({ operation: 'rename_file', status: 'success' });
    return node;
  }

  /**
   * Move a folder
   */
  async moveFolder(
    id: number,
    newParentFolderId: number | null,
    expectedVersion: number
  ): Promise<TreeFolderNode> {
    const folder = await this.folderRepo.move(id, newParentFolderId, expectedVersion);
    const node = this.mapToFolderNode(folder);

    treeEventService.emitEvent({
      repoId: folder.repo_id,
      type: 'folder',
      operation: 'move',
      node,
    });

    metrics.treeOperationsTotal.inc({ operation: 'move_folder', status: 'success' });
    return node;
  }

  /**
   * Move a file
   */
  async moveFile(
    id: number,
    newFolderId: number,
    expectedVersion: number
  ): Promise<TreeFileNode> {
    const file = await this.fileRepo.move(id, newFolderId, expectedVersion);
    const node = this.mapToFileNode(file);

    treeEventService.emitEvent({
      repoId: file.repo_id,
      type: 'file',
      operation: 'move',
      node,
    });

    metrics.treeOperationsTotal.inc({ operation: 'move_file', status: 'success' });
    return node;
  }

  /**
   * Delete a folder
   */
  async deleteFolder(id: number, expectedVersion: number): Promise<void> {
    // We need repoId to emit event. Fetch it first or assume caller knows?
    // delete returns void. Let's fetch before delete or modify delete to return repoId.
    // For efficiency, let's fetch the folder first to get repoId.
    const folder = await this.folderRepo.findById(id);
    if (!folder) throw new NotFoundError(`Folder with id ${id} not found`);

    await this.folderRepo.delete(id, expectedVersion);

    treeEventService.emitEvent({
      repoId: folder.repo_id,
      type: 'folder',
      operation: 'delete',
      node: { id: String(id) },
    });

    metrics.treeOperationsTotal.inc({ operation: 'delete_folder', status: 'success' });
  }

  /**
   * Delete a file
   */
  async deleteFile(id: number, expectedVersion: number): Promise<void> {
    const file = await this.fileRepo.findById(id);
    if (!file) throw new NotFoundError(`File with id ${id} not found`);

    await this.fileRepo.delete(id, expectedVersion);

    treeEventService.emitEvent({
      repoId: file.repo_id,
      type: 'file',
      operation: 'delete',
      node: { id: String(id) },
    });

    metrics.treeOperationsTotal.inc({ operation: 'delete_file', status: 'success' });
  }

  /**
   * Update file content
   */
  async updateFileContent(
    id: number,
    text: string
  ): Promise<TreeFileNode> {
    const file = await this.fileRepo.findById(id);
    if (!file) throw new NotFoundError(`File with id ${id} not found`);

    await this.fileContentRepo.updateText(id, text);
    
    const updatedFile = await this.fileRepo.findById(id);
    if (!updatedFile) throw new NotFoundError(`File with id ${id} not found after update`);

    const node = this.mapToFileNode(updatedFile);
    treeEventService.emitEvent({
        repoId: file.repo_id,
        type: 'file',
        operation: 'rename', // Using rename to trigger update
        node,
    });

    return node;
  }

  /**
   * Get file content
   */
  async getFileContent(id: number): Promise<{ text: string }> {
    const content = await this.fileContentRepo.getByFileId(id);
    if (!content) {
      // If file exists but no content record, return empty string
      // But we ensure content record on creation.
      // Check if file exists first?
      const file = await this.fileRepo.findById(id);
      if (!file) throw new NotFoundError(`File with id ${id} not found`);
      return { text: '' };
    }
    return { text: content.text };
  }

  /**
   * Map database folder to API folder node
   */
  private mapToFolderNode(folder: {
    id: number;
    repo_id: number;
    parent_folder_id: number | null;
    name: string;
    version: number;
    created_at: Date;
    updated_at: Date;
  }): TreeFolderNode {
    return {
      type: 'folder',
      id: String(folder.id),
      repoId: String(folder.repo_id),
      parentFolderId: folder.parent_folder_id ? String(folder.parent_folder_id) : null,
      name: folder.name,
      version: folder.version,
      createdAt: folder.created_at.toISOString(),
      updatedAt: folder.updated_at.toISOString(),
    };
  }

  /**
   * Map database file to API file node
   */
  private mapToFileNode(file: {
    id: number;
    repo_id: number;
    folder_id: number;
    name: string;
    language_hint: string | null;
    size_bytes: number;
    version: number;
    created_at: Date;
    updated_at: Date;
  }): TreeFileNode {
    return {
      type: 'file',
      id: String(file.id),
      repoId: String(file.repo_id),
      parentFolderId: String(file.folder_id),
      name: file.name,
      languageHint: file.language_hint,
      sizeBytes: file.size_bytes,
      version: file.version,
      createdAt: file.created_at.toISOString(),
      updatedAt: file.updated_at.toISOString(),
    };
  }
}
