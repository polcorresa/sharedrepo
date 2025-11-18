# GitHub Copilot Instructions for `sharedrepo.com`

These rules describe how code should be generated for this project.  
Follow them consistently for all suggestions.

## 0. About the project
`sharedrepo.com` is an ephemeral collaborative code editor where users can create temporary code repositories protected by shared passwords. Users can collaboratively edit code files in real-time using Yjs and WebSockets, without any user accounts or personal data storage. Repositories expire after a period of inactivity.



## 1. Global project rules

- This project is an **ephemeral collaborative code editor**:
  - No user accounts or personal data.
  - Only per-repo shared passwords.
  - Repos expire after 7 days without successful password entry.
- **Do NOT introduce user authentication systems**:
  - No sign up / login / logout for users.
  - No email/password accounts, OAuth, social login, or JWT-based user auth.
  - Only implement per-repo password + access tokens as specified.
- **Do NOT add paid or external SaaS dependencies** (Auth0, Firebase, Supabase, Pusher, etc.).
- **Languages & tools**:
  - TypeScript everywhere (frontend & backend).
  - React on the frontend.
  - Node.js + Fastify (or Express) on the backend.
  - PostgreSQL as the database.
  - Yjs + y-websocket for collaborative editing.
- **Code style and quality**:
  - Use **TypeScript strict mode** patterns. Avoid `any`, `unknown`, `@ts-ignore` and untyped values unless absolutely necessary.
  - Prefer small, pure, well-named functions and clear separation of concerns.
  - Keep files focused and not excessively long.
  - Follow **Prettier** style, **print width 80**, and standard TS/JS conventions.
  - Never leave unused variables, dead code, or commented-out blocks in final suggestions.

When in doubt, prefer **clarity**, **testability**, and **explicit typing** over cleverness.

---

## 2. Backend TypeScript (Node.js + Fastify)

When generating backend code:

- **Framework & structure**
  - Use Node.js with **TypeScript** and either **Fastify** or minimal **Express** (Fastify preferred).
  - Organize code into layers:
    - **Route layer** (HTTP endpoints and request/response mapping).
    - **Service layer** (business logic: repo lifecycle, tree operations, etc.).
    - **Data access layer** (repository/DAO abstractions for Postgres).
  - Do not mix HTTP logic, DB queries, and business logic inside a single large function.

- **Type safety**
  - Define types/interfaces for:
    - DTOs (request/response shapes).
    - Database entities (Repo, Folder, File, FileContent, etc.).
    - Service input and output parameters.
  - Avoid `any`. If you must use it, refactor to a proper type.

- **Validation**
  - Validate all incoming data at **the edge** (route level):
    - Use schema validation (Fastify’s schema, Zod, or similar).
    - Reject malformed or unexpected payloads with clear error responses.
  - Never trust client input; always validate slug, password, IDs, and operation parameters.

- **Async patterns & error handling**
  - Use **async/await** exclusively.
  - Use centralized error handling (Fastify error handler or middleware).
  - Never swallow errors silently; log them and return appropriate HTTP status codes.
  - For structural/validation errors, return 4xx; for unexpected issues, return 5xx.

- **Database access (PostgreSQL)**
  - Use a typed ORM/SQL builder (e.g. **Kysely**, **Drizzle**, or **Prisma**).
  - Never build SQL via string concatenation:
    - Always use parameterized queries to avoid SQL injection.
  - Keep DB access in a dedicated data access layer:
    - RepoRepository, FolderRepository, FileRepository, etc.
  - Use transactions where needed (e.g., complex tree operations with multiple updates).

- **Repo lifecycle rules**
  - Slug rules:
    - Allowed chars: letters + digits only.
    - Max length: 20.
    - Case-insensitive → store as lowercase.
  - Repo expiration:
    - Repos expire 7 days after last successful password entry.
    - Expiration is enforced by a background job that deletes:
      - Repo row.
      - Folders, files, file contents, Yjs persistence records.
  - Ensure **business rules** are enforced in services, not just in controllers.

- **Security**
  - Hash repo passwords using **bcrypt** or **argon2**.
  - Never log raw passwords or sensitive tokens.
  - Implement repo **access tokens**:
    - Signed tokens (HMAC/JWT-like) scoped to a single repo.
    - Stored as httpOnly cookies.
  - Do not implement user auth, account creation, or identity systems.

- **Logging & metrics**
  - Implement a simple, structured logger.
  - Log:
    - Route.
    - Status.
    - Repo ID (if applicable).
    - Hashed/anonymized IP.
  - Never log full request bodies containing secrets.
  - Provide a Prometheus-compatible `/metrics` endpoint when implementing metrics.

---

## 3. Frontend TypeScript (React)

When generating frontend code:

- **Architecture**
  - Use **React function components** and hooks.
  - Do NOT use class components.
  - Separate concerns:
    - Presentational components vs. container/logic components.
    - Hooks for reusable logic (e.g., useRepoStatus, useTreeOperations, useFileEditor).
  - Keep components small and focused; avoid massive components with too many responsibilities.

- **State management**
  - Prefer:
    - Local component state for UI details.
    - **React Query / TanStack Query** for remote data (API calls).
  - Do NOT introduce large, heavy global state libraries (Redux, MobX, etc.) unless explicitly requested.
  - Store collaborative state (file text, cursors) in **Yjs**, not in React global state.

- **Typing**
  - Define explicit `Props` and `State` interfaces/types for components.
  - Do not leave props implicitly `any`.
  - Type hooks return values and parameters.

- **Side effects & data fetching**
  - Encapsulate data fetching logic in hooks that use React Query or fetch wrappers.
  - Avoid calling `fetch` directly in components all over the place.
  - Always handle loading and error states explicitly.

- **UI & patterns**
  - Use semantic HTML where possible.
  - Avoid unnecessary re-renders:
    - Use `React.memo`, `useCallback`, and `useMemo` appropriately for expensive operations.
  - For layout:
    - Keep a clean, minimal UI aligned with the description:
      - Landing page.
      - Repo gate (create/login).
      - Editor layout with sidebar + main panel.

- **Monaco & collaboration**
  - When integrating Monaco:
    - Use a dedicated `CodeEditor` component.
    - Bind Monaco to Yjs via **y-monaco** (or equivalent).
    - Do NOT mutate the editor model directly without going through Yjs.
  - Support syntax highlighting for major languages (TS, JS, Python, Java, C++) via Monaco language configuration.
  - Implement theme switching between light and dark modes; map UI theme to Monaco theme.

- **Security**
  - Do not expose secrets or tokens.
  - Do not store passwords in localStorage.
  - Access tokens should be handled by cookies; the frontend may only track that a repo is “authenticated” via a boolean or minimal metadata.

---

## 4. Yjs, WebSockets, and realtime

When generating realtime/collaboration code:

- **Yjs usage**
  - Do NOT reimplement CRDT logic manually.
  - Use Yjs for:
    - File contents (one Y.Doc or Y.Text per file).
    - Awareness for cursors and presence (color + positions).
  - Treat Yjs document state as authoritative for collaboration; avoid double sources of truth.

- **Per-file docs**
  - Each file should have its own Yjs document/key: e.g. `repo:<repo_id>:file:<file_id>`.
  - Only connect to a file’s Yjs doc when that file is open in the editor.

- **Awareness**
  - Use Yjs awareness API to track:
    - Each client’s cursor position and selection.
    - A random color per client.
  - Use awareness data to render remote cursors; no usernames or identity.

- **WebSocket handling**
  - Use y-websocket for Yjs sync.
  - For tree updates, use an additional WebSocket channel or event stream:
    - Send small, structured events for tree changes (create/rename/move/delete).
  - Implement robust connection handling:
    - Reconnect with backoff on failure.
    - Clean up event listeners on unmount/tear-down.

- **Error handling**
  - Check access tokens on WebSocket connect.
  - Handle unauthorized connections by closing the socket with clear reason codes.
  - Handle network errors gracefully on the client.

---

## 5. Postgres, SQL, and data model

When generating data access code:

- **Schema**
  - Follow the conceptual schema:
    - `Repo` with slug, password_hash, timestamps.
    - `Folder` with repo_id, parent_folder_id, name, version.
    - `File` with repo_id, folder_id, name, language_hint, size_bytes, version.
    - `FileContent` with file_id, text, updated_at.
    - Optional `YjsPersistence` for document snapshots/updates.
  - Enforce constraints at the DB level where appropriate (unique slug, unique names per folder, foreign keys).

- **Queries**
  - Use typed ORM or SQL builder.
  - Always use parameterized queries.
  - Avoid building SQL via string concatenation.
  - Wrap multi-step operations (e.g., moving or deleting tree nodes) in transactions.

- **Repo expiry**
  - Implement a scheduled/background job that:
    - Selects repos where `last_accessed_at < now - 7 days`.
    - Deletes repos and all associated data.
  - Do not rely only on API checks; ensure actual DB cleanup.

---

## 6. Tree operations & conflict prevention

When generating code for tree operations:

- **Server-authoritative model**
  - All tree modifications (create/rename/move/delete) must be performed on the server.
  - Clients may not mutate the tree locally and assume success; always wait for server confirmation or events.

- **Optimistic concurrency**
  - Each node in the tree (file/folder) should have a `version` or similar field.
  - Client must send `expected_version` when performing operations.
  - Server compares current version vs expected:
    - If mismatch: return a “conflict” error.
    - If match: apply operation and increment version.

- **Conflict handling**
  - On conflict:
    - Do not silently overwrite.
    - Return a specific error allowing the client to refresh the tree and notify the user.
  - On success:
    - Broadcast change to all clients via WebSocket.

- **Validation**
  - Validate all tree operations:
    - Prevent duplicate names in a folder.
    - Prevent cycles when moving folders.
    - Check existence of target parent folder.

---

## 7. Testing best practices

When generating tests:

- **Types of tests**
  - Unit tests:
    - For pure logic (slug validation, expiry logic, tree validation, etc.).
  - Integration tests:
    - Backend + Postgres (repo lifecycle, tree operations, archive generation).
  - WebSocket / Yjs tests:
    - Multi-client convergence scenarios.
  - E2E tests:
    - Browser-level tests with Playwright or Cypress for main flows.

- **Patterns**
  - Keep tests deterministic; avoid relying on real external services.
  - Use test databases or schemas and clean them between tests.
  - For WebSockets:
    - Use multiple simulated clients.
    - Assert correct state convergence and error handling.

- **Code quality in tests**
  - Use clear, descriptive test names.
  - Avoid duplication via shared test helpers.
  - Do not assert on overly fragile implementation details; assert on behavior and externally observable state.

---

## 8. Infrastructure & config (YAML, JSON, etc.)

When generating configuration files:

- **Docker / docker-compose**
  - Keep services minimal:
    - App (Node).
    - Postgres.
    - Optional Prometheus/Grafana.
  - Use environment variables for secrets and DB connection details.
  - Do not hardcode passwords or tokens in the repo.

- **Prometheus / Grafana**
  - Use standard Prometheus configuration.
  - Configure scraping of the Node app metrics endpoint.
  - Keep dashboards generic and focused on:
    - Latency.
    - Error rates.
    - WebSocket connections.
    - Repo counts.

- **General config**
  - Use `.env` files for local dev only; don’t commit secrets.
  - Provide `.env.example` for documentation.

---

## 9. Things Copilot must avoid

- No user account systems (email/password, OAuth, etc.).
- No external SaaS dependencies for auth, DB, or realtime.
- No plain JavaScript for new code; always use TypeScript.
- No inline SQL concatenation; always parameterize.
- No large god-components in React; split responsibilities.
- No CRDT reimplementation; always use Yjs for collaborative text.
- No logging of raw passwords, tokens, or sensitive data.


## 10. Detailed project context
# Project Context: `sharedrepo.com` – Ephemeral Collaborative Code Repo
## 0. Goals, constraints, and core idea
### Product
`sharedrepo.com` is a **no-auth**, **ephemeral**, collaborative code editor with a 
**repo-style file tree**:
- Users visit `sharedrepo.com/xxx`, where `xxx` is a slug they choose.
- Each slug corresponds to a **shared repo** with:
 - A shared password.
 - A folder/file structure.
 - Real-time collaborative editing of text files (code).
- Repos are **ephemeral**:
 - If a repo does not receive a **successful password entry** for 7 days, it is **deleted**.
 - After deletion, the slug can be reused and acts as a new repo.
- No user accounts, no personal data, minimal logging only for debugging/security.
### Hard constraints
- **No user authentication** (no accounts, no emails).
- **Never store personal data** (beyond what’s technically necessary for logs).
- Only **text files** for now (code, markdown, etc). No binary uploads yet.
- Avoid paid/proprietary tools; prefer open source and low cost.
- Maximum repo size: **1 GB** (soft limit for now).
- Realtime collaboration:
 - **Max ~10 concurrent users per repo**, typical 2–3.
 - Users **must be online** to edit; no offline mode for now.
### Behavior recap
- `GET /` → landing page (“How it works” + basic info).
- `GET /:slug`:
 - If slug has no active repo (or expired):
 - Ask user to set a **password**.
 - Create a new repo with that password.
 - If an active repo exists:
 - Ask user for password (unless they have a valid token).
 - On success, open the existing repo.
Inside a repo:
- Left: repo structure (folders + files).
- Right: code editor (single file, with tabs for multiple open files optionally).
- Real-time sync (like Google Docs/Drive) with anonymous colored cursors.
- Download repo as `.zip` (file name like `codeshare-<slug>.zip`) using the last **saved** 
state, not unsaved edits.
---
## 1. High-level UX and flows
### 1.1 Landing page (`/`)
Simple, minimal UI with:
- Short description: “Ephemeral collaborative code repos in your browser.”
- “How it works” section (step-by-step):
 1. Choose a slug: visit `sharedrepo.com/myroom`.
 2. If it’s free (or expired), set a shared password.
 3. Share the URL + password with collaborators.
 4. Edit together in real time.
 5. Repo auto-expires 7 days after last successful access.
- “Future experiences” section:
 - Mention planned features (read-only links, snapshots, Git export, comments, etc.).
- Notes:
 - No accounts, no personal data.
 - Repos are temporary by design.
 - Approximate size limit (1 GB per repo).
### 1.2 Repo entry flow (`/:slug`)
1. Normalize slug to lowercase and validate it.
2. Call backend: `GET /api/repos/:slug/status`.
 - If `state = "available"`:
 - Show “Create repo” screen: set password (min 4 chars).
 - On submit, call `POST /api/repos` (slug + password).
 - If `state = "exists"`:
 - If this browser already has a valid repo token:
 - Skip password form; go directly to editor.
 - Else:
 - Show password form.
 - On correct password, backend issues an access token; open editor.
3. On incorrect password:
 - Show error.
 - Do not update repo activity timestamps.
### 1.3 Editor view (inside repo)
Layout:
- Top bar:
 - Slug (repo name).
 - Theme toggle (light/dark).
 - “Download .zip”.
 - “Logout” button (removes local access, returns to password form).
- Left sidebar:
 - Collapsible tree of folders/files.
 - Context menus or buttons for:
 - Create file/folder.
 - Rename file/folder.
 - Move file/folder (possibly via simple actions; drag & drop later).
 - Delete file/folder (with confirmation).
- Right content area:
 - Tabs for open files (recommended, but optional for v1).
 - Monaco editor instance for active file.
 - Status/presence indicator (e.g., “3 collaborators editing this file”).
Editor behavior:
- Syntax highlighting for common languages (TS, JS, Python, Java, C++, etc.).
- Line numbers, auto indentation, search.
- Multi-cursor disabled; focus on single main cursor per user but **remote cursors** visible 
via colored markers.
- Keyboard shortcuts (e.g. save, search, etc.).
---
## 2. Tech stack (final decisions + rationale)
### 2.1 Frontend
- **Language:** TypeScript.
- **Framework:** React (SPA).
- **Routing:** React Router or equivalent.
- **Editor:** Monaco Editor.
 - Production-proven for code editing.
 - Rich language support via Monarch grammars.
- **Collaboration binding:** Yjs + y-monaco.
 - y-monaco provides bindings between Yjs and Monaco, including shared cursors.
- **Styling:** Lightweight solution (Tailwind, CSS modules, or simple CSS).
 - Two themes: light and dark.
 - Minimalistic design.
References:
- Monaco Editor documentation and Monarch syntax highlighting.
- Yjs + Monaco integrations documented at `docs.yjs.dev` and community examples.
### 2.2 Backend
- **Runtime:** Node.js.
- **Language:** TypeScript.
- **HTTP framework:** Fastify (or Express; Fastify is preferred for performance and built-in 
validation).
- **WebSockets:** `ws` (used by y-websocket) or directly y-websocket server integration.
- **Database:** PostgreSQL.
 - Relational, strong consistency.
 - Suitable for tree structure and metadata.
- **ORM / DB toolkit:** Kysely or Drizzle (type-safe SQL builder) or Prisma.
 - Choose one; avoid raw SQL everywhere.
- **CRDT Engine:** Yjs.
 - Yjs is fast, battle-tested, and has rich bindings.
 - Research and benchmarks show Yjs as one of the most performant CRDTs in JS (e.g., 
`crdt-benchmarks` repo, Yjs docs).
- **Realtime collaboration server:** y-websocket.
 - Handles Yjs document sync and awareness over WebSockets.
### 2.3 Deployment / infrastructure
- Single VPS (Hetzner, DigitalOcean, etc.) with:
 - Nginx or Caddy as reverse proxy:
 - TLS termination.
 - Routes HTTP and WebSocket to Node.
 - Node.js process hosting:
 - Fastify HTTP API.
 - y-websocket server.
 - PostgreSQL:
 - Either on same box (for cheap v1) or managed Postgres.
Everything open source; no paid dependencies required.
---
## 3. Data model (DB-level concepts)
### 3.1 Repo
Represents a collaborative repo under a slug.
Fields (conceptually):
- `id` (primary key).
- `slug`:
 - Lowercased.
 - Max 20 characters.
 - Only letters and digits.
 - Unique.
- `password_hash`:
 - Hashed with bcrypt or argon2.
- `created_at` (timestamp).
- `last_accessed_at` (timestamp; updated on successful password entry).
- `approx_size_bytes` (optional, approximate total bytes of saved file contents).
Behavior:
- On successful password entry:
 - Update `last_accessed_at` to current time.
- Repo expiration:
 - If `last_accessed_at` is older than 7 days:
 - Repo is considered expired.
 - Background job deletes repo and all associated data.
 - Slug becomes available again; future access acts as a brand new repo.
### 3.2 Folder
Represents a folder (directory) node.
Fields:
- `id`.
- `repo_id` (foreign key).
- `name` (no slashes).
- `parent_folder_id` (nullable for root).
- `created_at`.
- `version` or `updated_at` (used for conflict detection).
Constraints:
- For each `repo_id` and `parent_folder_id`, `name` must be unique.
- Prevent cycles (a folder cannot be moved into its own descendants).
### 3.3 File
Represents a text file node.
Fields:
- `id`.
- `repo_id` (foreign key).
- `folder_id` (foreign key).
- `name` (with extension).
- `language_hint` (string, optional; from extension).
- `created_at`.
- `updated_at`.
- `size_bytes` (current saved size).
- `version` (or use `updated_at` as implicit version).
Constraints:
- For each `repo_id` and `folder_id`, file names must be unique.
- Editor and backend use `language_hint` for syntax highlighting.
### 3.4 File content
Separately store the **saved text** of each file.
Conceptual table: FileContent.
Fields:
- `file_id` (FK to File).
- `repo_id`.
- `text` (full file content as text).
- `updated_at`.
Usage:
- When user saves a file:
 - Update `FileContent.text`.
 - Update `File.size_bytes`.
- When generating `.zip`:
 - Use `FileContent.text` for each file (ensures only saved state appears in zip).
### 3.5 Yjs persistence (optional v1, recommended v2)
Later (or v1 if you want resilience):
Conceptual table: YjsPersistence.
Fields:
- `document_key` (e.g.: `repo:<repo_id>:file:<file_id>`).
- `snapshot_or_updates` (binary or base64-encoded CRDT data).
- `updated_at`.
Purpose:
- Reconstruct Yjs doc after server restarts.
- Optionally support offline work in future (not now).
For v1, you can run Yjs purely in memory and rely on `FileContent` as canonical 
persistence; add Yjs persistence once the core is stable.
### 3.6 Logs
Minimal logging for debugging/security, avoiding personal data:
Fields:
- `id`.
- `timestamp`.
- `route`.
- `repo_id` (nullable).
- `ip_hash` (salting and truncating a hash of IP).
- `status_code`.
- Optional small error code or label (not full stack trace).
Keep logs simple and rotation-friendly.
---
## 4. Collaboration model
### 4.1 Text collaboration (per-file CRDT)
For each file:
- Yjs document key: `repo:<repo_id>:file:<file_id>`.
- Structure: one `Y.Text` representing the entire file content.
- Binding:
 - Client creates a Yjs Doc for the file and a `Y.Text`.
 - y-monaco binds `Y.Text` to the Monaco model for that file.
- Real-time:
 - Yjs replicates operations via y-websocket.
 - All clients converge to the same text (CRDT property).
Based on research and benchmarks:
- Yjs is among the most efficient CRDT options for real-time text collaboration.
- Used in many production tools (see Yjs documentation and GitHub references).
### 4.2 Cursors and presence (Yjs Awareness)
Use Yjs “awareness” protocol:
- Each client has an awareness state (small shared object):
 - A randomly assigned color.
 - Current caret position and selection (line/column range).
- Awareness updates are broadcast via y-websocket.
- y-monaco renders remote cursors and selections using awareness states.
No usernames; presence is anonymous.
### 4.3 Tree sync (server-authoritative, not CRDT)
Tree = folder and file structure.
Design:
- Single source of truth: **Postgres**.
- All tree changes go through backend APIs.
- Server sends **events** over WebSocket to keep clients in sync.
No CRDT for tree, because:
- You explicitly want **conflict prevention**, not automatic resolution.
- Centralized tree logic is simpler and more predictable.
- CRDTs for trees/graphs are more complex and often overkill for this use case.
---
## 5. Tree operations and conflict prevention
### 5.1 Tree operations
Supported operations (all via server):
- Create folder.
- Create file.
- Rename folder/file.
- Move folder/file.
- Delete folder/file.
Each operation:
- Is validated on the server.
- Applied within a transaction to Postgres.
- If successful, the server emits an event to all repo clients describing the change.
### 5.2 Versioning and conflicts
Each folder/file has a `version` (or consistent `updated_at`).
Operation pattern:
- Client includes `expected_version` when modifying an item.
- Server:
 - Fetches current row.
 - If versions differ:
 - Reject with a “conflict” error (tree changed since client’s view).
 - If version matches:
 - Apply change.
 - Increment version.
This is standard optimistic concurrency control; it prevents silent conflicting edits.
Examples:
- Rename:
 - Input: `file_id`, `expected_version`, `new_name`.
 - Server checks:
 - File exists and version matches.
 - No sibling with `new_name`.
- Move:
 - Input: `node_id`, `expected_version`, `new_parent_folder_id`.
 - Server checks:
 - Node exists and version matches.
 - New parent exists.
 - No cycle (for folders).
 - No duplicate name in new parent.
On conflict:
- Server responds with error type = “conflict”.
- Client:
 - Reloads the tree from server.
 - Shows a message: e.g., “This item was changed by another collaborator. Please try 
again.”
### 5.3 Realtime tree events
After each successful tree operation:
- Server sends a small event over WebSocket like:
 - `folder_created`, `file_created`.
 - `node_renamed`.
 - `node_moved`.
 - `node_deleted`.
- Each event includes:
 - Node id.
 - Parent info.
 - Name.
 - Version.
- Clients update their local tree state accordingly.
Initial tree:
- On entering repo, client calls `GET /api/repos/:slug/tree` to load full tree.
- Then listens to tree events for incremental changes.
---
## 6. Access tokens, cookies, and security
### 6.1 Access token semantics
After successful login (correct password) or repo creation:
- Backend issues an **access token** scoped to that repo:
 - Contains: `repo_id`, `slug`, `iat`, `exp`.
 - Signed (HMAC) so it can’t be tampered with.
- Token’s purpose:
 - Authorize access to repo API endpoints.
 - Authorize WebSocket connections for that repo.
This is **not user authentication**; token only encodes permission to a specific repo, not 
user identity.
### 6.2 Storage of token
Preferred:
- Store token in an **httpOnly cookie**:
 - Safer against XSS.
 - Automatically sent with requests to your domain.
Alternative:
- localStorage:
 - Easier to inspect and manage in client code.
 - Less secure for XSS; not recommended in long term.
Logout:
- User clicks “Logout” button:
 - Client sends `POST /api/repos/:slug/logout`.
 - Backend expires/clears the cookie (set expired).
 - Client removes any local state and returns to password prompt state.
### 6.3 Password behavior
- Single password per repo (shared among collaborators).
- Minimum 4 characters; no complexity rules.
- No password change; no recovery:
 - If password forgotten, repo is effectively lost (or accessible only until expiry).
- Passwords only transmitted at:
 - Repo creation.
 - Login.
- Server:
 - Hash using bcrypt or argon2.
 - Never store raw passwords.
 - Never log password values.
### 6.4 Security notes
- No end-to-end encryption for now:
 - Data is stored in plaintext on server (in DB) and hashed passwords.
- IP logging:
 - Log only hashed IP + minimal metadata.
- No rate limiting for now (per your answer), but can add later if abuse becomes an issue.
---
## 7. API surface (REST + WebSocket)
### 7.1 REST endpoints (conceptual)
1. `GET /api/repos/:slug/status`
 - Input: slug.
 - Output:
 - `state`: `"available"` or `"exists"`.
 - Optionally, `expires_at` if repo exists.
 - Behavior:
 - If repo does not exist or is expired: treat as `available`.
 - If exists and not expired: `exists`.
2. `POST /api/repos`
 - Body: `slug`, `password` (≥4 chars).
 - Behavior:
 - Validate slug (allowed chars, length).
 - Ensure slug not in use by non-expired repo.
 - Create repo, hash password, set timestamps.
 - Create root folder (and optional initial file).
 - Issue access token (cookie).
 - Output: repo metadata.
3. `POST /api/repos/:slug/login`
 - Body: `password`.
 - Behavior:
 - Load repo by slug; ensure not expired.
 - Verify password hash.
 - On success:
 - Update `last_accessed_at`.
 - Issue access token (cookie).
 - Output: repo metadata.
 - On failure: error; no timestamp update.
4. `POST /api/repos/:slug/logout`
 - Behavior:
 - Expire the access token cookie.
5. `GET /api/repos/:slug/tree`
 - Behavior:
 - Requires valid repo access token.
 - Returns current tree:
 - Folders with parent relationships.
 - Files with folder, names, versions.
6. `POST /api/repos/:slug/folders` (or a generic `/tree` endpoint)
 - Create folder; expects parent folder id + name.
 - Returns new folder node with version.
7. `POST /api/repos/:slug/files`
 - Create file; expects folder id + name.
 - Returns new file node.
8. `PATCH /api/repos/:slug/nodes/:id`
 - Rename/move operations; specify `operation`, `expected_version`, and fields.
 - On version mismatch or invalid operation, return conflict error.
9. `DELETE /api/repos/:slug/nodes/:id`
 - Delete file/folder; includes `expected_version`.
 - For folder:
 - Recursively delete contents.
10. `GET /api/repos/:slug/archive`
 - Behavior:
 - Requires valid access token.
 - Uses `FileContent` to assemble a `.zip`.
 - Response filename: `codeshare-<slug>.zip`.
 - Contains only saved contents (no unsaved CRDT-only text).
### 7.2 WebSocket endpoints
1. Yjs synchronization
 - Path: `/ws/yjs`.
 - Query/header parameters:
 - Access token.
 - Document key / room name (e.g.: `repo:<repo_id>:file:<file_id>`).
 - Managed by y-websocket:
 - Syncs Yjs docs.
 - Propagates updates and awareness.
2. Tree events
 - Path: e.g. `/ws/repo/:slug/tree`.
 - Requires valid token.
 - Server:
 - On any tree change, sends structured events (create, rename, move, delete).
 - Client:
 - Subscribes to events and updates local tree view.
Optionally, tree events could be implemented via Yjs as a “tree doc”, but given your 
conflict-prevention requirement, a simple event channel is preferred.
---
## 8. Frontend architecture (React + TS)
### 8.1 Structure
Main routes:
- `/`
 - Landing page.
- `/:slug`
 - Repo page.
Components / responsibilities:
- `AppRouter`: defines routes.
- `LandingPage`: static content.
- `RepoGate`:
 - Handles slug normalization.
 - Calls status endpoint.
 - Shows either:
 - Create repo form.
 - Login form.
 - Or transitions directly to editor if token is present and valid.
- `RepoEditorLayout`:
 - Receives repo metadata (id, slug).
 - Manages layout:
 - Topbar (buttons and theme toggle).
 - Sidebar tree.
 - File tabs (optional).
 - Monaco editor container.
- `TreeView`:
 - Renders folders/files.
 - Handles user actions (create/rename/delete/move) by calling backend.
 - Listens to WebSocket events to keep in sync.
- `CodeEditor`:
 - Wraps Monaco.
 - Binds to Yjs doc via y-monaco.
 - Handles language selection based on file extension.
 - Handles save events.
### 8.2 State management
- Use:
 - Local component state for UI interactions.
 - React Query (TanStack Query) for REST calls (status, tree fetch, file metadata).
- Yjs documents hold collaborative state per file:
 - No need to store file contents in React global state.
- Repo-level context:
 - Provide `repoId`, `slug`, and access token info to deeper components.
---
## 9. Security, privacy, and logging (summary)
- No user accounts or PII storage.
- Store only:
 - Repo slug.
 - Hashed password.
 - Timestamps.
 - File/folder structure and contents.
- Logs:
 - Minimal analytical/debug: route, status, repo, anonymized IP.
- Access tokens:
 - Signed, scoped to repo.
 - Stored as httpOnly cookies.
- Password:
 - Single per repo.
 - Min length = 4.
 - Hash using bcrypt/argon2.
 - No reset/rotation.
End-to-end encryption is out of scope for now.
---
## 10. Testing strategy
### 10.1 Unit tests
Test pure logic:
- Slug normalization and validation.
- Password policy enforcement.
- Repo expiration logic:
 - Given `last_accessed_at` and `now`, determine expired or not.
- Tree operations:
 - Name conflict detection.
 - Cycle detection in folder moves.
 - General validation functions.
- Extension → language mapping.
### 10.2 Integration tests (backend + DB)
With a test Postgres instance:
- Repo lifecycle:
 - Create repo, login, update `last_accessed_at`.
 - Expiration job deletes repos and all child data.
- Tree operations:
 - Create nested folders and files.
 - Rename/move with valid and invalid operations.
 - Conflict scenarios (version mismatch).
- File save + zip:
 - Save content to FileContent.
 - Request archive, check included file names and content.
### 10.3 Yjs / WebSocket integration tests
Headless Node clients:
- Connect multiple clients to the same file via y-websocket.
- Simulate concurrent edits:
 - Insertions and deletions at different positions.
 - Overlapping operations.
- Confirm that all clients converge to identical text state.
This replicates standard CRDT correctness tests, leveraging Yjs’s established behavior.
### 10.4 End-to-end (E2E) tests
Using Playwright or Cypress:
1. Single-user flow:
 - Open `/myrepo`.
 - Create repo, set password.
 - Create folders/files.
 - Edit file, save.
 - Download zip, check contents.
2. Multi-user collaboration:
 - Two browser contexts.
 - Join same repo with same password.
 - Typing in one reflects in the other.
 - Remote cursors visible.
3. Tree conflict prevention:
 - Two browsers open same repo.
 - A renames folder.
 - B tries to rename same folder based on outdated view.
 - Confirm conflict message and tree refresh for B.
4. Expiration behavior (using time manipulation or test-only flags):
 - Simulate repo older than 7 days.
 - Confirm that slug becomes available and previous data is inaccessible.
---
## 11. Deployment, metrics, and operations
### 11.1 Deployment
Basic layout on a VPS:
- Reverse proxy (Nginx/Caddy):
 - `https://sharedrepo.com` → Node HTTP port.
 - `wss://sharedrepo.com/ws/...` → Node WebSocket.
- Node server:
 - Fastify HTTP API + y-websocket.
- PostgreSQL:
 - On same machine or small managed instance.
### 11.2 Background tasks
- Expiry job:
 - Cron-like task, e.g., every hour:
 - Delete repos with `last_accessed_at < now - 7 days`.
 - Cascade delete folders, files, FileContent, YjsPersistence.
- Optional maintenance job:
 - Yjs snapshot compaction (if you add persistence).
 - Clean logs.
### 11.3 Metrics (Prometheus + Grafana)
Expose a `/metrics` endpoint (Prometheus format) with:
- HTTP request count by route and status.
- Response times for key operations.
- Number of active WebSocket connections.
- Active repos count.
- Repo creation and deletion rates.
- Tree operation success vs conflict counts.
Grafana dashboards visualize health and usage trends.
This is fully open source and commonly used in production systems.
---
## 12. Roadmap and future features
Architecture is designed to allow:
- **Read-only mode**:
 - Tokens or URLs that grant view-only access.
- **Snapshots / version history**:
 - Store Yjs snapshots or copy FileContent at points in time.
- **Git export/import**:
 - Export repo state to a Git repository (on demand).
- **Comments / chat**:
 - Additional Yjs docs or WebSocket channels for inline comments or side chat.
All while respecting your constraints:
- No user accounts.
- No long-term personal data.
- Avoid paid services or tools.
---
## 13. Suggested implementation order (for VibeCoding)
When you start coding with a VibeCoding agent, follow roughly this order:
1. **Backend foundation**
 - Set up Node + Fastify.
 - Connect to PostgreSQL.
 - Implement Repo model and `status/create/login` endpoints.
 - Implement repo expiration job (delete after 7 days).
2. **Frontend shell**
 - React + TS SPA with router.
 - Landing page.
 - `/:slug` gate flow for create/login.
3. **Tree & files (non-collaborative)**
 - Data model for folders/files/FileContent.
 - REST API for tree operations.
 - React sidebar UI.
 - Basic editor using Monaco (single-user).
 - File save + zip download using saved content.
4. **Add Yjs collaboration**
 - Integrate y-websocket in backend.
 - Yjs + y-monaco for per-file collaborative editing.
 - Awareness for cursors.
5. **Tree real-time events**
 - WebSocket channel for tree events.
 - Client-side listeners for tree updates.
6. **Security & UX polish**
 - Access token as httpOnly cookie.
 - Logout flow.
 - Light/dark theme.
 - Error handling, conflict feedback.
7. **Metrics and tests**
 - Implement metrics endpoint and basic Prometheus/Grafana config.
 - Add unit, integration, and E2E tests as described.