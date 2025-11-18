import { Kysely, Migrator, FileMigrationProvider } from 'kysely';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { createDatabase, closeDatabase } from '../client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

async function migrateToLatest() {
  const db = createDatabase(
    process.env.DATABASE_URL || 'postgresql://localhost/sharedrepo'
  );

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((result) => {
    if (result.status === 'Success') {
      console.log(
        `✅ Migration "${result.migrationName}" executed successfully`
      );
    } else if (result.status === 'Error') {
      console.error(`❌ Migration "${result.migrationName}" failed`);
    }
  });

  if (error) {
    console.error('❌ Migration failed');
    console.error(error);
    await closeDatabase(db);
    process.exit(1);
  }

  await closeDatabase(db);
  console.log('✅ All migrations completed');
}

async function migrateDown() {
  const db = createDatabase(
    process.env.DATABASE_URL || 'postgresql://localhost/sharedrepo'
  );

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  const { error, results } = await migrator.migrateDown();

  results?.forEach((result) => {
    if (result.status === 'Success') {
      console.log(`✅ Migration "${result.migrationName}" reverted`);
    } else if (result.status === 'Error') {
      console.error(`❌ Migration "${result.migrationName}" revert failed`);
    }
  });

  if (error) {
    console.error('❌ Migration down failed');
    console.error(error);
    await closeDatabase(db);
    process.exit(1);
  }

  await closeDatabase(db);
  console.log('✅ Migration reverted');
}

// CLI handling
const command = process.argv[2];

if (command === 'down') {
  migrateDown().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  migrateToLatest().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
