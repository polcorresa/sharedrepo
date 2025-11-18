# Migration Guide

## Overview

This guide explains how to manage database migrations for the sharedrepo.com project.

## Prerequisites

1. PostgreSQL database running
2. `DATABASE_URL` environment variable set
3. Dependencies installed: `pnpm install`

## Environment Setup

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/sharedrepo
```

Or export it in your shell:

```bash
export DATABASE_URL="postgresql://username:password@localhost:5432/sharedrepo"
```

## Running Migrations

### Apply All Pending Migrations

From project root:
```bash
pnpm --filter @sharedrepo/db run migrate
```

From packages/db:
```bash
cd packages/db
pnpm run migrate
```

Output:
```
✅ Migration "001_initial_schema" executed successfully
✅ Migration "002_add_logs_table" executed successfully
✅ All migrations completed
```

### Revert Last Migration

From project root:
```bash
pnpm --filter @sharedrepo/db run migrate:down
```

From packages/db:
```bash
cd packages/db
pnpm run migrate:down
```

## Creating New Migrations

### 1. Create Migration File

Create a new file in `packages/db/src/migrations/migrations/`:

```
00X_descriptive_name.ts
```

Naming convention:
- Sequential number (001, 002, 003, etc.)
- Underscore separator
- Descriptive name (e.g., `add_comments_table`, `add_user_preferences`)

### 2. Migration Template

```typescript
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Apply changes here
  await db.schema
    .createTable('new_table')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Revert changes here
  await db.schema.dropTable('new_table').execute();
}
```

### 3. Update Types

After creating a migration that adds/modifies tables, update `packages/db/src/types.ts`:

```typescript
// Add to Database interface
export interface Database {
  // ...existing tables
  new_table: NewTableTable;
}

// Add table definition
export interface NewTableTable {
  id: Generated<number>;
  name: string;
}

// Add utility types
export type NewTable = Selectable<NewTableTable>;
export type NewNewTable = Insertable<NewTableTable>;
export type NewTableUpdate = Updateable<NewTableTable>;
```

### 4. Export Types

Update `packages/db/src/index.ts` to export new types:

```typescript
export type {
  // ...existing exports
  NewTable,
  NewNewTable,
  NewTableUpdate,
} from './types.js';
```

## Migration Examples

### Adding a Column

```typescript
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('repos')
    .addColumn('is_public', 'boolean', (col) => 
      col.notNull().defaultTo(false)
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('repos')
    .dropColumn('is_public')
    .execute();
}
```

### Adding an Index

```typescript
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex('files_size_bytes_idx')
    .on('files')
    .column('size_bytes')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('files_size_bytes_idx')
    .execute();
}
```

### Adding a Foreign Key

```typescript
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('comments')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('file_id', 'integer', (col) => 
      col.references('files.id').onDelete('cascade').notNull()
    )
    .addColumn('text', 'text', (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('comments').execute();
}
```

## Migration Best Practices

### 1. Always Provide Down Migration
Every migration should be reversible for safe rollbacks.

### 2. Use Transactions for Complex Changes
Kysely migrations are automatically wrapped in transactions, but be aware:

```typescript
export async function up(db: Kysely<any>): Promise<void> {
  // All these operations will be in one transaction
  await db.schema.createTable('table1').execute();
  await db.schema.createTable('table2').execute();
  await db.schema.createIndex('idx1').execute();
}
```

### 3. Test Migrations
Always test both up and down migrations:

```bash
# Apply migration
pnpm run migrate

# Verify database state
psql $DATABASE_URL -c "SELECT * FROM information_schema.tables;"

# Revert migration
pnpm run migrate:down

# Verify revert worked
psql $DATABASE_URL -c "SELECT * FROM information_schema.tables;"

# Re-apply
pnpm run migrate
```

### 4. Handle Data Migration Carefully

If you need to migrate data, do it in the migration:

```typescript
export async function up(db: Kysely<any>): Promise<void> {
  // Add new column
  await db.schema
    .alterTable('files')
    .addColumn('full_path', 'varchar(1000)')
    .execute();

  // Populate data
  const files = await db
    .selectFrom('files')
    .innerJoin('folders', 'folders.id', 'files.folder_id')
    .select(['files.id', 'files.name', 'folders.name as folder_name'])
    .execute();

  for (const file of files) {
    await db
      .updateTable('files')
      .set({ full_path: `${file.folder_name}/${file.name}` })
      .where('id', '=', file.id)
      .execute();
  }

  // Make column not null after populating
  await db.schema
    .alterTable('files')
    .alterColumn('full_path', (col) => col.setNotNull())
    .execute();
}
```

### 5. Keep Migrations Small and Focused
One logical change per migration file.

### 6. Never Modify Existing Migrations
Once a migration is applied in any environment, never modify it. Create a new migration instead.

## Checking Migration Status

Use the Kysely migration API or query directly:

```sql
SELECT * FROM kysely_migration ORDER BY name;
```

Or create a status script:

```typescript
import { Kysely, Migrator, FileMigrationProvider } from 'kysely';
import { createDatabase } from './client.js';

const db = createDatabase(process.env.DATABASE_URL);
const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({...}),
});

const migrations = await migrator.getMigrations();
console.table(migrations);
```

## Troubleshooting

### Migration Fails Mid-way
Kysely automatically wraps migrations in transactions. If a migration fails, it rolls back completely.

### Conflicting Migrations
If two developers create the same migration number, merge them sequentially and rename one.

### Database Connection Issues
Verify:
1. PostgreSQL is running
2. DATABASE_URL is correct
3. User has necessary permissions
4. Database exists

```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"
```

### Migration Already Applied
If you need to re-run a migration:

```sql
-- Remove from migration tracking
DELETE FROM kysely_migration WHERE name = '001_initial_schema';
```

Then run migration again.

## Production Considerations

### 1. Backup First
Always backup production database before migrations:

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Test on Staging
Run migrations on staging environment first.

### 3. Zero-Downtime Migrations
For critical changes, consider:
- Adding columns as nullable first, then backfilling, then adding NOT NULL
- Creating new tables before dropping old ones
- Using database views for gradual transitions

### 4. Monitor Performance
Large data migrations can lock tables. Consider:
- Running during low-traffic periods
- Batching updates
- Using `CREATE INDEX CONCURRENTLY` (requires manual SQL)

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
- name: Run migrations
  run: |
    pnpm --filter @sharedrepo/db run migrate
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## Current Migrations

### 001_initial_schema.ts
Creates core tables:
- repos
- folders
- files
- file_contents
- yjs_persistence

Includes all indexes and constraints.

### 002_add_logs_table.ts
Adds logging table:
- logs

Includes timestamp and repo_id indexes.

## Future Migration Ideas

Potential future migrations based on roadmap:
- `003_add_repo_tokens.ts` - Read-only access tokens
- `004_add_snapshots.ts` - Point-in-time repo snapshots
- `005_add_comments.ts` - Inline code comments
- `006_add_presence.ts` - User session tracking

These maintain the no-account, ephemeral design.
