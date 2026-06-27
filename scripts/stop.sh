#!/bin/bash

# Detect correct Docker Compose command
if command -v docker-compose &> /dev/null; then
  COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
else
  echo "Error: Docker Compose is not installed."
  exit 1
fi

echo "=== Stopping local Next.js container ==="
$COMPOSE_CMD down

echo "=== Stopping local Supabase stack ==="
npx supabase stop

echo "=== Local environment stopped ==="
