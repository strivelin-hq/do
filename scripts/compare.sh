#!/bin/bash
# Exit immediately on errors, but save comparison exit code at the end
set -e

# Detect correct Docker Compose command
if command -v docker-compose &> /dev/null; then
  COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
else
  echo "Error: Docker Compose is not installed."
  exit 1
fi

echo "=== Starting dual staging comparison databases ==="
$COMPOSE_CMD -f docker-compose.compare.yml up -d

echo "=== Waiting for fresh database to be ready ==="
until $COMPOSE_CMD -f docker-compose.compare.yml exec db_fresh pg_isready -U postgres -d postgres_fresh > /dev/null 2>&1; do
  echo "Fresh database starting... waiting 1s"
  sleep 1
done

echo "=== Waiting for migrated database to be ready ==="
until $COMPOSE_CMD -f docker-compose.compare.yml exec db_migrated pg_isready -U postgres -d postgres_migrated > /dev/null 2>&1; do
  echo "Migrated database starting... waiting 1s"
  sleep 1
done

echo "=== Both databases are online ==="

echo "=== Running migrations on Fresh Database ==="
DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres_fresh node scripts/migrate.js

echo "=== Running migrations on Migrated Database ==="
DATABASE_URL=postgres://postgres:postgres@localhost:5434/postgres_migrated node scripts/migrate.js

echo "=== Running schema comparison test ==="
# Allow exit code from compare-schemas.js to be caught so we can clean up containers
set +e
DATABASE_URL_A=postgres://postgres:postgres@localhost:5433/postgres_fresh \
DATABASE_URL_B=postgres://postgres:postgres@localhost:5434/postgres_migrated \
node scripts/compare-schemas.js
COMPARE_EXIT_CODE=$?
set -e

echo "=== Shutting down comparison environment ==="
$COMPOSE_CMD -f docker-compose.compare.yml down -v

if [ $COMPARE_EXIT_CODE -eq 0 ]; then
  echo "=== Schema parity test PASSED! ==="
  exit 0
else
  echo "=== Schema parity test FAILED! ==="
  exit $COMPARE_EXIT_CODE
fi
