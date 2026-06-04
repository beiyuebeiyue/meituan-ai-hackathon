#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

API_ORIGIN="${API_ORIGIN:-http://127.0.0.1:8000}"
API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-${API_ORIGIN}/api/v1}"
MOBILE_PORT="${MOBILE_PORT:-8081}"
OPS_PORT="${OPS_PORT:-4173}"

child_pids=()

cleanup() {
  if ((${#child_pids[@]})); then
    echo
    echo "Stopping frontend dev servers..."
    kill "${child_pids[@]}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

wait_for_api() {
  echo "Waiting for API at ${API_ORIGIN} ..."
  for _ in $(seq 1 90); do
    if curl -fsS "${API_ORIGIN}/docs" >/dev/null 2>&1; then
      echo "API is ready: ${API_ORIGIN}"
      return
    fi
    sleep 1
  done
  echo "API did not become ready in time. Check: docker compose logs -f api" >&2
  exit 1
}

require_command docker
require_command npm
require_command curl

echo "Starting backend services..."
docker compose up -d --build postgres redis openclaw api
wait_for_api

echo "Starting mobile web on http://localhost:${MOBILE_PORT}"
(
  cd "$ROOT_DIR/apps/mobile"
  EXPO_PUBLIC_API_BASE_URL="$API_BASE_URL" npx expo start --web --host localhost --port "$MOBILE_PORT"
) &
child_pids+=("$!")

echo "Starting ops web on http://localhost:${OPS_PORT}"
(
  cd "$ROOT_DIR/apps/ops-web"
  VITE_API_PROXY_TARGET="$API_ORIGIN" npx vite --host 0.0.0.0 --port "$OPS_PORT"
) &
child_pids+=("$!")

cat <<EOF

Started:
  API:          ${API_ORIGIN}
  API docs:     ${API_ORIGIN}/docs
  Mobile web:   http://localhost:${MOBILE_PORT}
  Ops web:      http://localhost:${OPS_PORT}

Environment:
  EXPO_PUBLIC_API_BASE_URL=${API_BASE_URL}
  VITE_API_PROXY_TARGET=${API_ORIGIN}

Press Ctrl+C to stop the frontend dev servers.
Docker backend services will keep running; stop them with:
  docker compose stop api openclaw redis postgres

EOF

wait
