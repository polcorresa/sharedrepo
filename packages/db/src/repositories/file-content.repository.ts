import { Kysely } from 'kysely';
import type { Database, FileContent, NewFileContent, FileContentUpdate } from '../types.js';
import { NotFoundError } from '../errors.js';

export class FileContentRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Get file content by file ID
   */
  async getByFileId(fileId: number): Promise<FileContent | null> {
    return await this.db
      .selectFrom('file_contents')
      .selectAll()
      .where('file_id', '=', fileId)
      .executeTakeFirst()
      .then((content) => content || null);
  }

  /**
   * Get all file contents for a repo
   */
  async getByRepoId(repoId: number): Promise<FileContent[]> {
    return await this.db
      .selectFrom('file_contents')
      .selectAll()
      .where('repo_id', '=', repoId)
      .execute();
  }

  /**
   * Set or update file content (upsert)
   */
  async set(data: NewFileContent): Promise<FileContent> {
    const content = await this.db
      .insertInto('file_contents')
      .values({
        ...data,
        updated_at: new Date(),
      })
      .onConflict((oc) =>
        oc.column('file_id').doUpdateSet({
          text: data.text,
          updated_at: new Date(),
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    // Update file size
    const textBytes = Buffer.byteLength(data.text, 'utf8');
    await this.db
      .updateTable('files')
      .set({
        size_bytes: textBytes,
        updated_at: new Date(),
      })
      .where('id', '=', data.file_id)
      .execute();

    return content;
  }

  /**
   * Update file content text
   */
  async updateText(fileId: number, text: string): Promise<FileContent> {
    const updated = await this.db
      .updateTable('file_contents')
      .set({
        text,
        updated_at: new Date(),
      })
      .where('file_id', '=', fileId)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      throw new NotFoundError(`File content for file id ${fileId} not found`);
    }

    // Update file size
    const textBytes = Buffer.byteLength(text, 'utf8');
    await this.db
      .updateTable('files')
      .set({
        size_bytes: textBytes,
        updated_at: new Date(),
      })
      .where('id', '=', fileId)
      .execute();

    return updated;
  }

  /**
   * Delete file content
   */
  async delete(fileId: number): Promise<void> {
    const result = await this.db
      .deleteFrom('file_contents')
      .where('file_id', '=', fileId)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      throw new NotFoundError(`File content for file id ${fileId} not found`);
    }
  }

  /**
   * Get files with their contents for a repo (for archive generation)
   */
  async getFilesWithContent(repoId: number): Promise<
    Array<{
      fileId: number;
      fileName: string;
      folderId: number;
      languageHint: string | null;
      text: string;
    }>
  > {
    return await this.db
      .selectFrom('file_contents')
      .innerJoin('files', 'files.id', 'file_contents.file_id')
      .select([
        'files.id as fileId',
        'files.name as fileName',
        'files.folder_id as folderId',
        'files.language_hint as languageHint',
        'file_contents.text as text',
      ])
      .where('file_contents.repo_id', '=', repoId)
      .execute();
  }

  /**
   * Get total text size for a repo
   */
  async getTotalSize(repoId: number): Promise<number> {
    const contents = await this.getByRepoId(repoId);
    return contents.reduce((total, content) => {
      return total + Buffer.byteLength(content.text, 'utf8');
    }, 0);
  }
}
