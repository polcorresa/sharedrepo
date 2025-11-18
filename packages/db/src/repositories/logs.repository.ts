import { Kysely } from 'kysely';
import type { Database, Log, NewLog } from '../types.js';
import { hashIp } from '../utils/ip-hash.js';

export class LogsRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Create a log entry
   */
  async create(data: NewLog): Promise<Log> {
    return await this.db
      .insertInto('logs')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Create a log entry with automatic IP hashing
   */
  async log(params: {
    route: string;
    repoId?: number | null;
    ipAddress: string;
    statusCode: number;
    errorCode?: string | null;
  }): Promise<Log> {
    return await this.create({
      route: params.route,
      repo_id: params.repoId || null,
      ip_hash: hashIp(params.ipAddress),
      status_code: params.statusCode,
      error_code: params.errorCode || null,
    });
  }

  /**
   * Find logs by repo ID
   */
  async findByRepoId(repoId: number, limit = 100): Promise<Log[]> {
    return await this.db
      .selectFrom('logs')
      .selectAll()
      .where('repo_id', '=', repoId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .execute();
  }

  /**
   * Find logs by route
   */
  async findByRoute(route: string, limit = 100): Promise<Log[]> {
    return await this.db
      .selectFrom('logs')
      .selectAll()
      .where('route', '=', route)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .execute();
  }

  /**
   * Find logs by status code
   */
  async findByStatusCode(statusCode: number, limit = 100): Promise<Log[]> {
    return await this.db
      .selectFrom('logs')
      .selectAll()
      .where('status_code', '=', statusCode)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .execute();
  }

  /**
   * Find error logs (status >= 400)
   */
  async findErrors(limit = 100): Promise<Log[]> {
    return await this.db
      .selectFrom('logs')
      .selectAll()
      .where('status_code', '>=', 400)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .execute();
  }

  /**
   * Find recent logs
   */
  async findRecent(limit = 100): Promise<Log[]> {
    return await this.db
      .selectFrom('logs')
      .selectAll()
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .execute();
  }

  /**
   * Delete logs older than specified days
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.db
      .deleteFrom('logs')
      .where('timestamp', '<', cutoffDate)
      .executeTakeFirst();

    return Number(result.numDeletedRows);
  }

  /**
   * Count total logs
   */
  async count(): Promise<number> {
    const result = await this.db
      .selectFrom('logs')
      .select((eb) => eb.fn.count<number>('id').as('count'))
      .executeTakeFirst();

    return result?.count || 0;
  }

  /**
   * Count logs by status code range
   */
  async countByStatusRange(min: number, max: number): Promise<number> {
    const result = await this.db
      .selectFrom('logs')
      .select((eb) => eb.fn.count<number>('id').as('count'))
      .where('status_code', '>=', min)
      .where('status_code', '<=', max)
      .executeTakeFirst();

    return result?.count || 0;
  }

  /**
   * Get statistics about logs
   */
  async getStats(): Promise<{
    total: number;
    success: number; // 2xx
    clientErrors: number; // 4xx
    serverErrors: number; // 5xx
  }> {
    const total = await this.count();
    const success = await this.countByStatusRange(200, 299);
    const clientErrors = await this.countByStatusRange(400, 499);
    const serverErrors = await this.countByStatusRange(500, 599);

    return {
      total,
      success,
      clientErrors,
      serverErrors,
    };
  }
}
