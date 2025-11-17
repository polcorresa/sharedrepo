# sharedrepo.com

Ephemeral, no-auth collaborative code repositories powered by Fastify, React, and Yjs. This monorepo hosts the backend API/y-websocket server, the React SPA, and shared TypeScript contracts.

## Structure

- `apps/server` – Fastify API + Yjs websocket host (TypeScript, Kysely, PostgreSQL).
- `apps/web` – React SPA with React Router, React Query, and Monaco editor wrappers.
- `packages/shared` – Reusable DTOs, validators, and shared utilities consumed by both apps.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+

## Quick start

```bash
npm install
npm run dev:server
npm run dev:web
```

Environment variables live in `.env` files (never commit secrets). See `config/.env.example` for required values.
