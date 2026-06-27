#!/bin/bash
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

echo "=== Staging (building Docker image) ==="
$COMPOSE_CMD build
echo "=== Staging complete: Image is ready to ship ==="
