#!/bin/bash
set -e

# Detect correct Docker Compose command
if command -v docker-compose &> /dev/null; then
  COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
else
  echo "Error: Docker Compose is not installed. Please run: brew install docker-compose"
  exit 1
fi

echo "=== Starting local Supabase stack ==="
npx supabase start

echo "=== Syncing environment variables ==="
node scripts/update-env.js

echo "=== Starting local Next.js web application container ==="
$COMPOSE_CMD up -d --force-recreate

echo "=== Application is running! ==="
echo "URL: http://localhost:3000"
