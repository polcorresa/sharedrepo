import type { Generated, ColumnType, Insertable, Selectable, Updateable } from 'kysely';

export interface RepoTable {
  id: Generated<string>;
  slug: string;
  password_hash: string;
  created_at: ColumnType<Date, string | undefined, never>;
  last_accessed_at: ColumnType<Date, string | undefined, string | undefined>;
  approx_size_bytes: ColumnType<number | null, number | null | undefined, number | null>;
}

export interface FolderTable {
  id: Generated<string>;
  repo_id: string;
  parent_folder_id: string | null;
  name: string;
  version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface FileTable {
  id: Generated<string>;
  repo_id: string;
  folder_id: string;
  name: string;
  language_hint: string | null;
  size_bytes: number;
  version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface FileContentTable {
  file_id: string;
  repo_id: string;
  text: string;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface RepoLogTable {
  id: Generated<string>;
  route: string;
  repo_id: string | null;
  ip_hash: string | null;
  status_code: number;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface Database {
  repos: RepoTable;
  folders: FolderTable;
  files: FileTable;
  file_contents: FileContentTable;
  repo_logs: RepoLogTable;
}

export type RepoRow = Selectable<RepoTable>;
export type RepoInsert = Insertable<RepoTable>;
export type RepoUpdate = Updateable<RepoTable>;

export type FolderRow = Selectable<FolderTable>;
export type FolderInsert = Insertable<FolderTable>;
export type FolderUpdate = Updateable<FolderTable>;

export type FileRow = Selectable<FileTable>;
export type FileInsert = Insertable<FileTable>;
export type FileUpdate = Updateable<FileTable>;

export type FileContentRow = Selectable<FileContentTable>;
export type FileContentInsert = Insertable<FileContentTable>;
export type FileContentUpdate = Updateable<FileContentTable>;
