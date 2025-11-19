#!/bin/bash
set -e

DB_CONTAINER_NAME="sharedrepo-test-db"
DB_PORT="5433"

echo "🐳 Starting test database container..."
# Remove existing container if it exists (ignore error if not)
docker rm -f $DB_CONTAINER_NAME >/dev/null 2>&1 || true

# Start Postgres
docker run -d \
  --name $DB_CONTAINER_NAME \
  -p $DB_PORT:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=sharedrepo_test \
  postgres:16-alpine

echo "⏳ Waiting for database to be ready..."
# Wait for Postgres to be ready
until docker exec $DB_CONTAINER_NAME pg_isready -U postgres >/dev/null 2>&1; do
  echo "   Waiting for postgres..."
  sleep 1
done
echo "✅ Database is ready!"

# Run tests
echo "🧪 Running integration tests..."
export TEST_DATABASE_URL="postgresql://postgres:password@localhost:$DB_PORT/sharedrepo_test"

# Use a subshell or ensure cleanup happens even on failure
set +e
pnpm --filter @sharedrepo/server test:int
EXIT_CODE=$?
set -e

# Cleanup
echo "🧹 Cleaning up..."
docker stop $DB_CONTAINER_NAME >/dev/null
docker rm $DB_CONTAINER_NAME >/dev/null

exit $EXIT_CODE
