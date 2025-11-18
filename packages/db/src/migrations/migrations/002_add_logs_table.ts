import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create logs table
  await db.schema
    .createTable('logs')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('timestamp', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('route', 'varchar(255)', (col) => col.notNull())
    .addColumn('repo_id', 'integer', (col) =>
      col.references('repos.id').onDelete('set null')
    )
    .addColumn('ip_hash', 'varchar(64)', (col) => col.notNull())
    .addColumn('status_code', 'integer', (col) => col.notNull())
    .addColumn('error_code', 'varchar(50)')
    .execute();

  // Create index on timestamp for log queries and cleanup
  await db.schema
    .createIndex('logs_timestamp_idx')
    .on('logs')
    .column('timestamp')
    .execute();

  // Create index on repo_id for repo-specific log queries
  await db.schema
    .createIndex('logs_repo_id_idx')
    .on('logs')
    .column('repo_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('logs').execute();
}
