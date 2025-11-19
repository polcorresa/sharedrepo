# Manual Testing Guide

This guide explains how to run the `sharedrepo` project locally for manual testing.

## Prerequisites

Ensure you have the following installed:
- **Node.js** (v20+ recommended)
- **pnpm** (Package manager)
- **Docker** (For the PostgreSQL database)

## 1. Start the Database

The project uses a local PostgreSQL database running in a Docker container.

```bash
pnpm db:start
```
*Or directly via script:*
```bash
./scripts/start-db.sh
```

This will:
- Start a Docker container named `sharedrepo-db`.
- Expose Postgres on port `5432`.
- Create a default database `sharedrepo` with user `postgres` and password `postgres`.

## 2. Install Dependencies

If you haven't already, install the project dependencies:

```bash
pnpm install
```

## 3. Run the Application

You can run both the backend and frontend concurrently with a single command:

```bash
pnpm dev
```

Alternatively, you can run them in separate terminals:

### Backend (API)
```bash
pnpm dev:api
```
- Runs on: `http://localhost:4000` (default)
- Swagger/OpenAPI docs (if enabled): `http://localhost:4000/documentation`

### Frontend (Web)
```bash
pnpm dev:web
```
- Runs on: `http://localhost:5173` (default)

## 4. Testing Flow

1.  **Open the Web App**: Navigate to `http://localhost:5173`.
2.  **Create a Repo**:
    *   Enter a slug (e.g., `test-repo`) in the URL: `http://localhost:5173/test-repo`.
    *   You should be prompted to create a password.
    *   Enter a password (min 4 chars) and submit.
3.  **Explore the Editor**:
    *   **File Tree**: Create folders and files using the sidebar.
    *   **Editor**: Click a file to open it. Type some code.
    *   **Collaboration**: Open the same URL in a second browser window (or Incognito mode). Enter the password. You should see real-time updates and cursors.
4.  **Theme**: Toggle the Light/Dark mode using the button in the header.
5.  **Download**: Click "Download .zip" to get a snapshot of the repo.

## Troubleshooting

- **Database Connection Errors**: Ensure Docker is running and the `sharedrepo-db` container is up (`docker ps`).
- **Port Conflicts**:
    - If port `4000` is in use, the API won't start. Kill the process or change the port in `.env`.
    - If port `5173` is in use, Vite will usually try the next available port (e.g., `5174`).
- **"Response doesn't match schema"**: This usually indicates a mismatch between the API response and the Zod schema in the shared package. Ensure you have the latest fixes.
