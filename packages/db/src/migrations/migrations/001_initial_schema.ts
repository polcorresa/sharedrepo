import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create repos table
  await db.schema
    .createTable('repos')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('slug', 'varchar(20)', (col) => col.notNull().unique())
    .addColumn('password_hash', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('last_accessed_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('approx_size_bytes', 'bigint', (col) => col.defaultTo(0).notNull())
    .execute();

  // Create index on slug for fast lookups
  await db.schema
    .createIndex('repos_slug_idx')
    .on('repos')
    .column('slug')
    .execute();

  // Create index on last_accessed_at for expiry queries
  await db.schema
    .createIndex('repos_last_accessed_at_idx')
    .on('repos')
    .column('last_accessed_at')
    .execute();

  // Create folders table
  await db.schema
    .createTable('folders')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('repo_id', 'integer', (col) =>
      col.references('repos.id').onDelete('cascade').notNull()
    )
    .addColumn('parent_folder_id', 'integer', (col) =>
      col.references('folders.id').onDelete('cascade')
    )
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('version', 'integer', (col) => col.defaultTo(1).notNull())
    .execute();

  // Unique constraint: repo_id + parent_folder_id + name
  await db.schema
    .createIndex('folders_unique_name_idx')
    .unique()
    .on('folders')
    .columns(['repo_id', 'parent_folder_id', 'name'])
    .execute();

  // Create files table
  await db.schema
    .createTable('files')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('repo_id', 'integer', (col) =>
      col.references('repos.id').onDelete('cascade').notNull()
    )
    .addColumn('folder_id', 'integer', (col) =>
      col.references('folders.id').onDelete('cascade').notNull()
    )
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('language_hint', 'varchar(50)')
    .addColumn('size_bytes', 'bigint', (col) => col.defaultTo(0).notNull())
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('version', 'integer', (col) => col.defaultTo(1).notNull())
    .execute();

  // Unique constraint: repo_id + folder_id + name
  await db.schema
    .createIndex('files_unique_name_idx')
    .unique()
    .on('files')
    .columns(['repo_id', 'folder_id', 'name'])
    .execute();

  // Create file_contents table
  await db.schema
    .createTable('file_contents')
    .addColumn('file_id', 'integer', (col) =>
      col.references('files.id').onDelete('cascade').primaryKey()
    )
    .addColumn('repo_id', 'integer', (col) =>
      col.references('repos.id').onDelete('cascade').notNull()
    )
    .addColumn('text', 'text', (col) => col.notNull().defaultTo(''))
    .addColumn('updated_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute();

  // Create yjs_persistence table
  await db.schema
    .createTable('yjs_persistence')
    .addColumn('document_key', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('data', 'bytea', (col) => col.notNull())
    .addColumn('updated_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('yjs_persistence').execute();
  await db.schema.dropTable('file_contents').execute();
  await db.schema.dropTable('files').execute();
  await db.schema.dropTable('folders').execute();
  await db.schema.dropTable('repos').execute();
}
