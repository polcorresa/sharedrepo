# GitHub Copilot Instructions for `sharedrepo.com`

These rules describe how code should be generated for this project.  
Follow them consistently for all suggestions.

## 0. About the project
`sharedrepo.com` is an ephemeral collaborative code editor where users can create temporary code repositories protected by shared passwords. Users can collaboratively edit code files in real-time using Yjs and WebSockets, without any user accounts or personal data storage. Repositories expire after a period of inactivity.

When having doubts, refer to the /.github/project-context.pdf file for more details.

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
