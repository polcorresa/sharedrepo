import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './types.js';

/**
 * Creates a Kysely database instance
 */
export function createDatabase(connectionString: string): Kysely<Database> {
  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString,
      max: 10,
    }),
  });

  return new Kysely<Database>({
    dialect,
  });
}

/**
 * Closes the database connection pool
 */
export async function closeDatabase(db: Kysely<Database>): Promise<void> {
  await db.destroy();
}
