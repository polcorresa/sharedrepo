import { Kysely, Migrator, FileMigrationProvider, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../../src/config/env.js';
import type { Database } from '@sharedrepo/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the configured DATABASE_URL. 
// WARNING: This will wipe data in the configured DB. 
// Ideally, run tests with a separate DATABASE_URL.
const TEST_DB_URL = process.env.TEST_DATABASE_URL || env.DATABASE_URL;

if (!process.env.TEST_DATABASE_URL && !TEST_DB_URL.includes('_test')) {
  console.warn('⚠️  WARNING: Running tests against a database that does not end in "_test". Data will be wiped!');
}

export function createTestDatabase() {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: TEST_DB_URL,
        max: 10,
      }),
    }),
  });
}

export async function migrateToLatest(db: Kysely<Database>) {
  // Point to the migrations folder in packages/db
  const migrationFolder = path.resolve(__dirname, '../../../../packages/db/src/migrations/migrations');
  
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
    }),
  });

  const { error } = await migrator.migrateToLatest();
  if (error) {
    console.error('Migration failed during test setup:', error);
    throw error;
  }
}

export async function clearDatabase(db: Kysely<Database>) {
  // Delete in order of foreign key dependencies
  await db.deleteFrom('logs').execute();
  await db.deleteFrom('file_contents').execute();
  await db.deleteFrom('files').execute();
  await db.deleteFrom('folders').execute();
  await db.deleteFrom('repos').execute();
}
