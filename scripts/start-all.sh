#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_DIR="$(cd "$FRONTEND_DIR/../heluo-history-famous-figures" && pwd)"

echo "启动 Docker 服务..."
docker compose -f "$COMPOSE_DIR/docker-compose.yml" up -d

echo "启动前后端服务..."
cd "$FRONTEND_DIR"
npx concurrently -n "server,frontend" -c "blue,green" \
  "npm run dev:server" \
  "npm run dev:frontend"
