export { createDatabase, closeDatabase } from './client.js';
export type {
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
export { Kysely } from 'kysely';

// Repositories
export { RepoRepository } from './repositories/repo.repository.js';
export { FolderRepository } from './repositories/folder.repository.js';
export { FileRepository } from './repositories/file.repository.js';
export { FileContentRepository } from './repositories/file-content.repository.js';
export { LogsRepository } from './repositories/logs.repository.js';

// Errors
export { ConflictError, NotFoundError, ValidationError } from './errors.js';

// Utilities
export {
  getLanguageFromExtension,
  getSupportedExtensions,
  isExtensionSupported,
} from './utils/language-mapping.js';
export { hashIp } from './utils/ip-hash.js';
