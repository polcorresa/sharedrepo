# Database Package (`@sharedrepo/db`)

Type-safe database layer using Kysely SQL builder for PostgreSQL.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set DATABASE_URL environment variable in root `.env`:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sharedrepo
```

3. Run migrations:
```bash
pnpm run migrate
```

## Available Scripts

- `pnpm run typecheck` - Type check without building
- `pnpm run migrate` - Run all pending migrations
- `pnpm run migrate:latest` - Alias for migrate
- `pnpm run migrate:down` - Revert last migration

## Usage

```typescript
import { 
  createDatabase, 
  closeDatabase,
  RepoRepository,
  FolderRepository,
  FileRepository,
  FileContentRepository,
  LogsRepository,
} from '@sharedrepo/db';

const db = createDatabase(process.env.DATABASE_URL);

// Create repository instances
const repos = {
  repo: new RepoRepository(db),
  folder: new FolderRepository(db),
  file: new FileRepository(db),
  content: new FileContentRepository(db),
  logs: new LogsRepository(db),
};

// Use repositories
const repo = await repos.repo.create({
  slug: 'myproject',
  password_hash: hashedPassword,
});

const folder = await repos.folder.create({
  repo_id: repo.id,
  parent_folder_id: null,
  name: 'src',
});

const file = await repos.file.create({
  repo_id: repo.id,
  folder_id: folder.id,
  name: 'index.ts', // language_hint auto-detected as 'typescript'
});

await repos.content.set({
  file_id: file.id,
  repo_id: repo.id,
  text: 'console.log("Hello");',
});

// Close when done
await closeDatabase(db);
```

## Repository Layer

Type-safe data access layer with:
- **RepoRepository** - Repo CRUD, expiry checks, slug availability
- **FolderRepository** - Tree operations with cycle detection
- **FileRepository** - File management with auto language detection
- **FileContentRepository** - Content storage with size tracking
- **LogsRepository** - Privacy-preserving logs with IP hashing

See `REPOSITORIES.md` for complete documentation.

## Schema

See `src/types.ts` for complete type definitions.

### Tables

#### repos
Represents a collaborative repository under a slug.
- `id` (serial, PK)
- `slug` (varchar(20), unique) - Normalized slug (lowercase, letters+digits only)
- `password_hash` (varchar(255)) - Bcrypt/argon2 hashed password
- `created_at` (timestamp)
- `last_accessed_at` (timestamp) - Updated on successful password entry; used for expiration
- `approx_size_bytes` (bigint) - Approximate total size of all file contents

**Indexes:**
- `repos_slug_idx` on `slug`
- `repos_last_accessed_at_idx` on `last_accessed_at` (for expiry queries)

**Expiration:** Repos are deleted 7 days after `last_accessed_at`.

#### folders
Represents folder nodes in the tree structure.
- `id` (serial, PK)
- `repo_id` (integer, FK → repos.id, CASCADE)
- `parent_folder_id` (integer, nullable, FK → folders.id, CASCADE) - NULL for root folder
- `name` (varchar(255)) - Folder name (no slashes)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `version` (integer) - Optimistic concurrency control

**Constraints:**
- Unique index on `(repo_id, parent_folder_id, name)` - Prevents duplicate names per parent

#### files
Represents file nodes in the tree structure.
- `id` (serial, PK)
- `repo_id` (integer, FK → repos.id, CASCADE)
- `folder_id` (integer, FK → folders.id, CASCADE)
- `name` (varchar(255)) - File name with extension
- `language_hint` (varchar(50), nullable) - Language for syntax highlighting
- `size_bytes` (bigint) - Current saved file size
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `version` (integer) - Optimistic concurrency control

**Constraints:**
- Unique index on `(repo_id, folder_id, name)` - Prevents duplicate names per folder

#### file_contents
Stores the saved text content of files.
- `file_id` (integer, PK, FK → files.id, CASCADE)
- `repo_id` (integer, FK → repos.id, CASCADE)
- `text` (text) - Full file content as text
- `updated_at` (timestamp)

**Notes:** Only saved state appears here; used for archive generation.

#### yjs_persistence
Optional CRDT persistence for Yjs documents.
- `document_key` (varchar(255), PK) - Format: `repo:<repo_id>:file:<file_id>`
- `data` (bytea) - Encoded Yjs snapshot or updates
- `updated_at` (timestamp)

**Notes:** Enables server restart resilience and future offline support.

#### logs
Minimal logging for debugging and security.
- `id` (serial, PK)
- `timestamp` (timestamp)
- `route` (varchar(255)) - API route
- `repo_id` (integer, nullable, FK → repos.id, SET NULL)
- `ip_hash` (varchar(64)) - Hashed + salted IP address
- `status_code` (integer) - HTTP status code
- `error_code` (varchar(50), nullable) - Optional error identifier

**Indexes:**
- `logs_timestamp_idx` on `timestamp` (for queries and cleanup)
- `logs_repo_id_idx` on `repo_id` (for repo-specific queries)

**Privacy:** No personal data stored; IPs are hashed and anonymized.
