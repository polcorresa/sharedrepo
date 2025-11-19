# SharedRepo.com

**Ephemeral, secure, and collaborative code repositories.**

SharedRepo is a real-time collaborative code editor that allows users to create temporary, password-protected repositories without user accounts. It features a file tree, Monaco editor, and Yjs-powered collaboration.

---

## 🚀 Features

-   **Ephemeral**: Repositories automatically expire after 7 days of inactivity.
-   **No Auth**: No sign-ups or emails. Just a slug and a shared password.
-   **Real-time Collaboration**: Edit code together with others using Yjs and WebSockets.
-   **Secure**: Per-repo passwords, hashed storage, and HTTP-only access tokens.
-   **Modern Stack**: Built with the latest web technologies.

## 🛠️ Tech Stack

This project is a monorepo managed by **pnpm workspaces**.

-   **Frontend (`apps/web`)**:
    -   React 18 + Vite
    -   TypeScript
    -   Monaco Editor (VS Code's editor)
    -   TanStack Query & Router
    -   Yjs (CRDTs) for collaboration

-   **Backend (`apps/server`)**:
    -   Node.js + Fastify
    -   TypeScript
    -   Kysely (Type-safe SQL builder)
    -   PostgreSQL
    -   y-websocket

-   **Shared (`packages/shared`)**:
    -   Shared TypeScript types, Zod schemas, and utility logic.

---

## 🏁 Getting Started

### Prerequisites

-   **Node.js** (v20+)
-   **pnpm** (v9+)
-   **Docker** (for local database)

### 1. Setup Environment

Copy the example environment files:

```bash
cp .env.example .env
cp apps/server/.env.example apps/server/.env
```

### 2. Start Database

Start a local PostgreSQL instance using Docker:

```bash
docker run -d \
  --name sharedrepo-db \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=sharedrepo \
  postgres:16-alpine
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Run Migrations

Initialize the database schema:

```bash
pnpm --filter @sharedrepo/db migrate
```

### 5. Start Development Server

Run both the backend and frontend in parallel:

```bash
pnpm dev
```

-   **Web**: [http://localhost:5173](http://localhost:5173)
-   **API**: [http://localhost:3001](http://localhost:3001)

---

## 🧪 Testing

We have a comprehensive testing strategy covering unit, integration, and E2E scenarios.

### Unit Tests

Fast, isolated tests for logic and components.

```bash
# Run all unit tests
pnpm test:unit

# Run web-only unit tests
pnpm --filter @sharedrepo/web test:unit
```

### Integration Tests

Tests that verify the API and Database interaction. Requires Docker.

```bash
# Spins up a test DB container, runs tests, and tears it down
pnpm test:integration
```

### E2E Tests

Browser-level tests using Playwright. Requires the app to be running locally.

```bash
# 1. Start the app
pnpm dev

# 2. Run E2E tests (in another terminal)
pnpm test:e2e
```

---

## 📂 Project Structure

```
.
├── apps/
│   ├── server/       # Fastify API & WebSocket server
│   └── web/          # React frontend
├── packages/
│   ├── db/           # Database client & migrations
│   ├── shared/       # Shared types & utils
│   └── testing/      # E2E tests (Playwright)
├── infra/            # Infrastructure configs (Grafana, etc.)
└── scripts/          # Utility scripts
```

## 📜 License

MIT
