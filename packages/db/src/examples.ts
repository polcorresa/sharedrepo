/**
 * Complete example demonstrating all repository usage patterns
 */

import {
  createDatabase,
  closeDatabase,
  RepoRepository,
  FolderRepository,
  FileRepository,
  FileContentRepository,
  LogsRepository,
  ConflictError,
  NotFoundError,
  ValidationError,
  getLanguageFromExtension,
} from './index.js';
import type { Kysely } from 'kysely';
import type { Database } from './types.js';

/**
 * Initialize database and repositories
 */
function initRepositories(connectionString: string) {
  const db = createDatabase(connectionString);

  return {
    db,
    repos: {
      repo: new RepoRepository(db),
      folder: new FolderRepository(db),
      file: new FileRepository(db),
      content: new FileContentRepository(db),
      logs: new LogsRepository(db),
    },
  };
}

/**
 * Example: Create a complete repo with initial structure
 */
async function createCompleteRepo(
  repos: ReturnType<typeof initRepositories>['repos'],
  slug: string,
  passwordHash: string,
  ipAddress: string
) {
  try {
    // 1. Check slug availability
    const available = await repos.repo.isSlugAvailable(slug);
    if (!available) {
      throw new Error('Slug already taken');
    }

    // 2. Create repo
    const repo = await repos.repo.create({
      slug,
      password_hash: passwordHash,
    });

    // 3. Create root folder
    const rootFolder = await repos.folder.create({
      repo_id: repo.id,
      parent_folder_id: null,
      name: 'root',
    });

    // 4. Create src subfolder
    const srcFolder = await repos.folder.create({
      repo_id: repo.id,
      parent_folder_id: rootFolder.id,
      name: 'src',
    });

    // 5. Create initial README
    const readmeFile = await repos.file.create({
      repo_id: repo.id,
      folder_id: rootFolder.id,
      name: 'README.md',
    });

    // 6. Set README content
    await repos.content.set({
      file_id: readmeFile.id,
      repo_id: repo.id,
      text: `# ${slug}\n\nWelcome to your shared repo!\n`,
    });

    // 7. Create index.ts
    const indexFile = await repos.file.create({
      repo_id: repo.id,
      folder_id: srcFolder.id,
      name: 'index.ts',
      // language_hint will be auto-detected as 'typescript'
    });

    // 8. Set index.ts content
    await repos.content.set({
      file_id: indexFile.id,
      repo_id: repo.id,
      text: 'console.log("Hello from shared repo!");\n',
    });

    // 9. Log the creation
    await repos.logs.log({
      route: 'POST /api/repos',
      repoId: repo.id,
      ipAddress,
      statusCode: 201,
    });

    return {
      repo,
      rootFolder,
      srcFolder,
      files: [readmeFile, indexFile],
    };
  } catch (error) {
    // Log error
    await repos.logs.log({
      route: 'POST /api/repos',
      ipAddress,
      statusCode: 500,
      errorCode: error instanceof Error ? error.message : 'UNKNOWN',
    });
    throw error;
  }
}

/**
 * Example: Login to repo and update last accessed
 */
async function loginToRepo(
  repos: ReturnType<typeof initRepositories>['repos'],
  slug: string,
  passwordHash: string,
  ipAddress: string
) {
  try {
    // Find repo
    const repo = await repos.repo.findBySlug(slug);
    if (!repo) {
      await repos.logs.log({
        route: 'POST /api/repos/:slug/login',
        ipAddress,
        statusCode: 404,
        errorCode: 'REPO_NOT_FOUND',
      });
      throw new NotFoundError('Repo not found or expired');
    }

    // Verify password (simplified - use bcrypt in real code)
    if (repo.password_hash !== passwordHash) {
      await repos.logs.log({
        route: 'POST /api/repos/:slug/login',
        repoId: repo.id,
        ipAddress,
        statusCode: 401,
        errorCode: 'INVALID_PASSWORD',
      });
      throw new Error('Invalid password');
    }

    // Update last accessed (extends expiration)
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

/**
 * Example: Rename file with optimistic concurrency
 */
async function renameFileWithVersionCheck(
  repos: ReturnType<typeof initRepositories>['repos'],
  fileId: number,
  newName: string,
  expectedVersion: number
) {
  try {
    const renamed = await repos.file.rename(fileId, newName, expectedVersion);
    console.log(`File renamed to ${renamed.name}`);
    console.log(`Language hint updated to: ${renamed.language_hint}`);
    console.log(`New version: ${renamed.version}`);
    return renamed;
  } catch (error) {
    if (error instanceof ConflictError) {
      console.error('Conflict: File was modified by another user');
      console.error('Please refresh and try again');
      // In real app, reload the file and retry
    }
    throw error;
  }
}

/**
 * Example: Move folder with cycle detection
 */
async function moveFolderSafely(
  repos: ReturnType<typeof initRepositories>['repos'],
  folderId: number,
  newParentId: number,
  expectedVersion: number
) {
  try {
    const moved = await repos.folder.move(folderId, newParentId, expectedVersion);
    console.log('Folder moved successfully');
    return moved;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation error:', error.message);
      // e.g., "Cannot move folder into its own descendants"
    } else if (error instanceof ConflictError) {
      console.error('Conflict:', error.message);
      // e.g., duplicate name or stale version
    }
    throw error;
  }
}

/**
 * Example: Get complete tree structure
 */
async function getRepoTree(
  repos: ReturnType<typeof initRepositories>['repos'],
  repoId: number
) {
  // Get all folders and files
  const folders = await repos.folder.findByRepoId(repoId);
  const files = await repos.file.findByRepoId(repoId);

  // Build tree structure (simplified)
  const folderMap = new Map(folders.map((f) => [f.id, { ...f, children: [] as any[] }]));

  // Link children to parents
  folders.forEach((folder) => {
    if (folder.parent_folder_id !== null) {
      const parent = folderMap.get(folder.parent_folder_id);
      if (parent) {
        parent.children.push(folderMap.get(folder.id));
      }
    }
  });

  // Add files to folders
  files.forEach((file) => {
    const folder = folderMap.get(file.folder_id);
    if (folder) {
      folder.children.push(file);
    }
  });

  // Get root folders
  const roots = folders
    .filter((f) => f.parent_folder_id === null)
    .map((f) => folderMap.get(f.id));

  return roots;
}

/**
 * Example: Generate archive with file contents
 */
async function generateArchiveData(
  repos: ReturnType<typeof initRepositories>['repos'],
  repoId: number
) {
  // Get all files with content (optimized single query)
  const filesWithContent = await repos.content.getFilesWithContent(repoId);

  // Get folder structure for path building
  const folders = await repos.folder.findByRepoId(repoId);

  // Build folder paths
  const folderPaths = new Map<number, string>();
  
  function buildPath(folderId: number): string {
    if (folderPaths.has(folderId)) {
      return folderPaths.get(folderId)!;
    }

    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return '';

    if (folder.parent_folder_id === null) {
      folderPaths.set(folderId, folder.name);
      return folder.name;
    }

    const parentPath = buildPath(folder.parent_folder_id);
    const path = `${parentPath}/${folder.name}`;
    folderPaths.set(folderId, path);
    return path;
  }

  // Build file list with full paths
  const archiveFiles = filesWithContent.map((file) => ({
    path: `${buildPath(file.folderId)}/${file.fileName}`,
    content: file.text,
    language: file.languageHint,
  }));

  return archiveFiles;
}

/**
 * Example: Cleanup expired repos
 */
async function cleanupExpiredRepos(repos: ReturnType<typeof initRepositories>['repos']) {
  console.log('Finding expired repos...');
  const expired = await repos.repo.findExpired();
  console.log(`Found ${expired.length} expired repos`);

  if (expired.length > 0) {
    console.log('Deleting expired repos...');
    const deletedCount = await repos.repo.deleteExpired();
    console.log(`Deleted ${deletedCount} repos`);

    // Log cleanup
    await repos.logs.log({
      route: 'CRON /cleanup',
      ipAddress: '127.0.0.1',
      statusCode: 200,
      errorCode: `CLEANED_${deletedCount}`,
    });
  }
}

/**
 * Example: Rotate old logs
 */
async function rotateLogs(
  repos: ReturnType<typeof initRepositories>['repos'],
  daysToKeep: number = 30
) {
  console.log(`Rotating logs older than ${daysToKeep} days...`);
  const deletedCount = await repos.logs.deleteOlderThan(daysToKeep);
  console.log(`Deleted ${deletedCount} log entries`);
}

/**
 * Example: Get repo statistics
 */
async function getRepoStatistics(
  repos: ReturnType<typeof initRepositories>['repos'],
  repoId: number
) {
  const repo = await repos.repo.findById(repoId);
  if (!repo) throw new NotFoundError('Repo not found');

  const folderCount = await repos.folder.countByRepoId(repoId);
  const fileCount = await repos.file.countByRepoId(repoId);
  const totalSize = await repos.file.getTotalSizeByRepoId(repoId);
  const contentSize = await repos.content.getTotalSize(repoId);

  return {
    slug: repo.slug,
    created: repo.created_at,
    lastAccessed: repo.last_accessed_at,
    folders: folderCount,
    files: fileCount,
    totalFileSize: totalSize,
    totalContentSize: contentSize,
    approxSize: repo.approx_size_bytes,
  };
}

/**
 * Example: Get system-wide statistics
 */
async function getSystemStatistics(repos: ReturnType<typeof initRepositories>['repos']) {
  const activeRepos = await repos.repo.countActive();
  const totalSize = await repos.repo.getTotalSize();
  const logStats = await repos.logs.getStats();

  return {
    activeRepos,
    totalSize,
    logs: logStats,
  };
}

/**
 * Main example usage
 */
async function main() {
  const { db, repos } = initRepositories(process.env.DATABASE_URL!);

  try {
    // Create a new repo
    const created = await createCompleteRepo(
      repos,
      'example123',
      'hashed-password',
      '192.168.1.1'
    );
    console.log('Created repo:', created.repo.slug);

    // Login to repo
    const repo = await loginToRepo(
      repos,
      'example123',
      'hashed-password',
      '192.168.1.2'
    );
    console.log('Logged in to:', repo.slug);

    // Get tree structure
    const tree = await getRepoTree(repos, repo.id);
    console.log('Tree structure:', JSON.stringify(tree, null, 2));

    // Get statistics
    const stats = await getRepoStatistics(repos, repo.id);
    console.log('Repo statistics:', stats);

    // Generate archive data
    const archiveFiles = await generateArchiveData(repos, repo.id);
    console.log('Archive files:', archiveFiles.length);

    // System statistics
    const systemStats = await getSystemStatistics(repos);
    console.log('System statistics:', systemStats);

    // Cleanup (maintenance)
    await cleanupExpiredRepos(repos);
    await rotateLogs(repos, 30);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closeDatabase(db);
  }
}

// Export for use in other modules
export {
  initRepositories,
  createCompleteRepo,
  loginToRepo,
  renameFileWithVersionCheck,
  moveFolderSafely,
  getRepoTree,
  generateArchiveData,
  cleanupExpiredRepos,
  rotateLogs,
  getRepoStatistics,
  getSystemStatistics,
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
