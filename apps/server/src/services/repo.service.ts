import bcrypt from 'bcrypt';
import { createSigner } from 'fast-jwt';
import { RepoRepository, FolderRepository, FileContentRepository } from '@sharedrepo/db';
import { NotFoundError, ValidationError } from '@sharedrepo/db';
import { normalizeSlug, validateSlug } from '@sharedrepo/shared';
import { getExpiryDate, isExpired } from '@sharedrepo/shared';
import archiver from 'archiver';
import type { Kysely } from 'kysely';
import type { Database } from '@sharedrepo/db';
import type { RepoMetadata, RepoStatusResponse } from '@sharedrepo/shared';
import { env } from '../config/env.js';
import { metrics } from '../plugins/metrics.js';

const SALT_ROUNDS = 10;

/**
 * JWT signer for repo access tokens
 */
const signToken = createSigner({
  key: env.JWT_SECRET,
  expiresIn: '7d', // Tokens valid for 7 days
});

/**
 * Service layer for repo operations
 * Handles business logic for repo lifecycle: status, create, login, logout
 */
export class RepoService {
  private repoRepo: RepoRepository;
  private folderRepo: FolderRepository;
  private fileContentRepo: FileContentRepository;

  constructor(db: Kysely<Database>) {
    this.repoRepo = new RepoRepository(db);
    this.folderRepo = new FolderRepository(db);
    this.fileContentRepo = new FileContentRepository(db);
  }

  /**
   * Get repo status (available or exists)
   */
  async getStatus(slug: string): Promise<RepoStatusResponse> {
    const normalized = normalizeSlug(slug);
    validateSlug(normalized);

    const repo = await this.repoRepo.findBySlug(normalized);

    if (!repo) {
      return {
        slug: normalized,
        state: 'available',
        expiresAt: null,
      };
    }

    // Check if expired
    if (isExpired(repo.last_accessed_at)) {
      return {
        slug: normalized,
        state: 'available',
        expiresAt: null,
      };
    }

    return {
      slug: normalized,
      state: 'exists',
      expiresAt: getExpiryDate(repo.last_accessed_at).toISOString(),
    };
  }

  /**
   * Create a new repo with password
   */
  async create(slug: string, password: string): Promise<{ metadata: RepoMetadata; token: string }> {
    const normalized = normalizeSlug(slug);
    validateSlug(normalized);

    // Check if slug is available
    const existing = await this.repoRepo.findBySlug(normalized);
    if (existing && !isExpired(existing.last_accessed_at)) {
      throw new ValidationError(`Slug "${normalized}" is already taken`);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create repo
    const now = new Date();
    const repo = await this.repoRepo.create({
      slug: normalized,
      password_hash: passwordHash,
      created_at: now,
      last_accessed_at: now,
    });

    // Create root folder
    await this.folderRepo.create({
      repo_id: repo.id,
      parent_folder_id: null,
      name: 'root',
      version: 0,
      created_at: now,
      updated_at: now,
    });

    // Generate access token
    const token = signToken({
      repoId: String(repo.id),
      slug: repo.slug,
    });

    // Track metric
    metrics.repoOperationsTotal.inc({ operation: 'create' });

    return {
      metadata: this.mapToMetadata(repo),
      token,
    };
  }

  /**
   * Login to existing repo with password
   */
  async login(slug: string, password: string): Promise<{ metadata: RepoMetadata; token: string }> {
    const normalized = normalizeSlug(slug);
    validateSlug(normalized);

    // Find repo (non-expired only)
    const repo = await this.repoRepo.findBySlug(normalized);
    if (!repo) {
      throw new NotFoundError(`Repo "${normalized}" not found or has expired`);
    }

    // Verify password
    const isValid = await bcrypt.compare(password, repo.password_hash);
    if (!isValid) {
      throw new ValidationError('Incorrect password');
    }

    // Update last accessed timestamp
    const updatedRepo = await this.repoRepo.updateLastAccessed(repo.id);

    // Track metric
    metrics.repoOperationsTotal.inc({ operation: 'login' });

    // Generate access token
    const token = signToken({
      repoId: String(repo.id),
      slug: repo.slug,
    });

    return {
      metadata: this.mapToMetadata(updatedRepo),
      token,
    };
  }

  /**
   * Get repo metadata by ID (for authenticated requests)
   */
  async getById(id: string): Promise<RepoMetadata> {
    const repo = await this.repoRepo.findById(Number(id));
    if (!repo) {
      throw new NotFoundError(`Repo with id ${id} not found`);
    }

    return this.mapToMetadata(repo);
  }

  /**
   * Generate a zip archive of the repo
   */
  async getArchive(id: string): Promise<NodeJS.ReadableStream> {
    const repoId = Number(id);
    const repo = await this.repoRepo.findById(repoId);
    if (!repo) {
      throw new NotFoundError(`Repo with id ${id} not found`);
    }

    const archive = archiver('zip', {
      zlib: { level: 9 }, // Sets the compression level.
    });

    // Fetch all files with content
    // Note: This loads all content into memory. For very large repos, we might need a streaming approach from DB.
    // But given the 1GB limit and ephemeral nature, this is acceptable for v1.
    const files = await this.fileContentRepo.getFilesWithContent(repoId);
    const folders = await this.folderRepo.findByRepoId(repoId);

    // Build a map of folder ID to path
    const folderPaths = new Map<number, string>();
    
    // Helper to build path recursively
    const getFolderPath = (folderId: number): string => {
      if (folderPaths.has(folderId)) {
        return folderPaths.get(folderId)!;
      }

      const folder = folders.find((f) => f.id === folderId);
      if (!folder) return ''; // Should not happen if integrity is maintained

      let path = folder.name;
      if (folder.parent_folder_id) {
        const parentPath = getFolderPath(folder.parent_folder_id);
        if (parentPath) {
          path = `${parentPath}/${path}`;
        }
      }
      
      // Cache it
      folderPaths.set(folderId, path);
      return path;
    };

    // Add files to archive
    for (const file of files) {
      let filePath = file.fileName;
      if (file.folderId) {
        const folderPath = getFolderPath(file.folderId);
        // Skip 'root' folder in path if it's the top level, or handle it gracefully.
        // Our root folder has name 'root' and parent null.
        // Usually we want the zip structure to start inside the repo.
        // If getFolderPath returns 'root/src', we might want just 'src'.
        // Let's adjust getFolderPath to ignore the root folder name if it's the root.
        
        // Actually, let's refine the path logic.
        // The root folder (parent_folder_id === null) should effectively be the base.
        // Any folder with parent_folder_id === root.id is a top-level folder in the zip.
      }
      
      // Re-implement path logic to handle root folder correctly
      let currentFolderId = file.folderId;
      const pathParts: string[] = [];
      
      while (true) {
        const folder = folders.find(f => f.id === currentFolderId);
        if (!folder) break;
        
        // Stop at root folder (parent is null)
        if (folder.parent_folder_id === null) break;
        
        pathParts.unshift(folder.name);
        currentFolderId = folder.parent_folder_id;
      }
      
      if (pathParts.length > 0) {
        filePath = `${pathParts.join('/')}/${file.fileName}`;
      }
      
      archive.append(file.text, { name: filePath });
    }

    archive.finalize();
    return archive;
  }

  /**
   * Map database repo to API metadata
   */
  private mapToMetadata(repo: {
    id: number;
    slug: string;
    created_at: Date;
    last_accessed_at: Date;
    approx_size_bytes: number | null;
  }): RepoMetadata {
    return {
      id: String(repo.id),
      slug: repo.slug,
      createdAt: repo.created_at.toISOString(),
      lastAccessedAt: repo.last_accessed_at.toISOString(),
      expiresAt: getExpiryDate(repo.last_accessed_at).toISOString(),
      approxSizeBytes: repo.approx_size_bytes,
    };
  }
}
