import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

/**
 * Database schema types
 */

export interface Database {
  repos: RepoTable;
  folders: FolderTable;
  files: FileTable;
  file_contents: FileContentTable;
  yjs_persistence: YjsPersistenceTable;
  logs: LogTable;
}

// ============================================================================
// Repo
// ============================================================================

export interface RepoTable {
  id: Generated<number>;
  slug: string;
  password_hash: string;
  created_at: Generated<Date>;
  last_accessed_at: Generated<Date>;
  approx_size_bytes: Generated<number>;
}

export type Repo = Selectable<RepoTable>;
export type NewRepo = Insertable<RepoTable>;
export type RepoUpdate = Updateable<RepoTable>;

// ============================================================================
// Folder
// ============================================================================

export interface FolderTable {
  id: Generated<number>;
  repo_id: number;
  parent_folder_id: number | null;
  name: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  version: Generated<number>;
}

export type Folder = Selectable<FolderTable>;
export type NewFolder = Insertable<FolderTable>;
export type FolderUpdate = Updateable<FolderTable>;

// ============================================================================
// File
// ============================================================================

export interface FileTable {
  id: Generated<number>;
  repo_id: number;
  folder_id: number;
  name: string;
  language_hint: string | null;
  size_bytes: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  version: Generated<number>;
}

export type File = Selectable<FileTable>;
export type NewFile = Insertable<FileTable>;
export type FileUpdate = Updateable<FileTable>;

// ============================================================================
// FileContent
// ============================================================================

export interface FileContentTable {
  file_id: number;
  repo_id: number;
  text: string;
  updated_at: Generated<Date>;
}

export type FileContent = Selectable<FileContentTable>;
export type NewFileContent = Insertable<FileContentTable>;
export type FileContentUpdate = Updateable<FileContentTable>;

// ============================================================================
// YjsPersistence
// ============================================================================

export interface YjsPersistenceTable {
  document_key: string;
  data: Buffer;
  updated_at: Generated<Date>;
}

export type YjsPersistence = Selectable<YjsPersistenceTable>;
export type NewYjsPersistence = Insertable<YjsPersistenceTable>;
export type YjsPersistenceUpdate = Updateable<YjsPersistenceTable>;

// ============================================================================
// Log
// ============================================================================

export interface LogTable {
  id: Generated<number>;
  timestamp: Generated<Date>;
  route: string;
  repo_id: number | null;
  ip_hash: string;
  status_code: number;
  error_code: string | null;
}

export type Log = Selectable<LogTable>;
export type NewLog = Insertable<LogTable>;
export type LogUpdate = Updateable<LogTable>;
