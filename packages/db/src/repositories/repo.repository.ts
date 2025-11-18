import { Kysely, sql } from 'kysely';
import type { Database, Repo, NewRepo, RepoUpdate } from '../types.js';
import { NotFoundError } from '../errors.js';

export class RepoRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Create a new repo
   */
  async create(data: NewRepo): Promise<Repo> {
    return await this.db
      .insertInto('repos')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Find repo by slug (only if not expired)
   */
  async findBySlug(slug: string): Promise<Repo | null> {
    const expiryDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return await this.db
      .selectFrom('repos')
      .selectAll()
      .where('slug', '=', slug)
      .where('last_accessed_at', '>', expiryDate)
      .executeTakeFirst()
      .then((repo) => repo || null);
  }

  /**
   * Find repo by slug (including expired)
   */
  async findBySlugIncludingExpired(slug: string): Promise<Repo | null> {
    return await this.db
      .selectFrom('repos')
      .selectAll()
      .where('slug', '=', slug)
      .executeTakeFirst()
      .then((repo) => repo || null);
  }

  /**
   * Find repo by ID
   */
  async findById(id: number): Promise<Repo | null> {
    return await this.db
      .selectFrom('repos')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
      .then((repo) => repo || null);
  }

  /**
   * Update repo
   */
  async update(id: number, data: RepoUpdate): Promise<Repo> {
    const repo = await this.db
      .updateTable('repos')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!repo) {
      throw new NotFoundError(`Repo with id ${id} not found`);
    }

    return repo;
  }

  /**
   * Update last accessed timestamp
   */
  async updateLastAccessed(id: number): Promise<Repo> {
    return await this.update(id, { last_accessed_at: new Date() });
  }

  /**
   * Delete repo (cascade will delete all related data)
   */
  async delete(id: number): Promise<void> {
    const result = await this.db
      .deleteFrom('repos')
      .where('id', '=', id)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      throw new NotFoundError(`Repo with id ${id} not found`);
    }
  }

  /**
   * Check if slug is available (not taken by non-expired repo)
   */
  async isSlugAvailable(slug: string): Promise<boolean> {
    const repo = await this.findBySlug(slug);
    return repo === null;
  }

  /**
   * Find expired repos (last accessed more than 7 days ago)
   */
  async findExpired(): Promise<Repo[]> {
    const expiryDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return await this.db
      .selectFrom('repos')
      .selectAll()
      .where('last_accessed_at', '<', expiryDate)
      .execute();
  }

  /**
   * Delete expired repos and return count
   */
  async deleteExpired(): Promise<number> {
    const expiryDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.db
      .deleteFrom('repos')
      .where('last_accessed_at', '<', expiryDate)
      .executeTakeFirst();

    return Number(result.numDeletedRows);
  }

  /**
   * Update repo size
   */
  async updateSize(id: number, sizeBytes: number): Promise<Repo> {
    return await this.update(id, { approx_size_bytes: sizeBytes });
  }

  /**
   * Get total size of all repos
   */
  async getTotalSize(): Promise<number> {
    const result = await this.db
      .selectFrom('repos')
      .select((eb) => eb.fn.sum<number>('approx_size_bytes').as('total'))
      .executeTakeFirst();

    return result?.total || 0;
  }

  /**
   * Count active repos (not expired)
   */
  async countActive(): Promise<number> {
    const expiryDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.db
      .selectFrom('repos')
      .select((eb) => eb.fn.count<number>('id').as('count'))
      .where('last_accessed_at', '>', expiryDate)
      .executeTakeFirst();

    return result?.count || 0;
  }
}
