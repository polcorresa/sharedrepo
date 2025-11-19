#!/bin/bash
set -e

DB_CONTAINER_NAME="sharedrepo-db"
DB_PORT="5432"

echo "🐳 Starting local database container..."

# Check if container exists
if [ "$(docker ps -a -q -f name=$DB_CONTAINER_NAME)" ]; then
    if [ "$(docker ps -q -f name=$DB_CONTAINER_NAME)" ]; then
        echo "✅ Database container is already running."
    else
        echo "🔄 Restarting existing database container..."
        docker start $DB_CONTAINER_NAME
    fi
else
    echo "🆕 Creating and starting new database container..."
    docker run -d \
      --name $DB_CONTAINER_NAME \
      -p $DB_PORT:5432 \
      -e POSTGRES_USER=postgres \
      -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=sharedrepo \
      postgres:16-alpine
fi

echo "⏳ Waiting for database to be ready..."
until docker exec $DB_CONTAINER_NAME pg_isready -U postgres >/dev/null 2>&1; do
  echo "   Waiting for postgres..."
  sleep 1
done
echo "✅ Database is ready!"
