#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="18798"

scripts/setup_openclaw_ops.sh
GATEWAY_TOKEN="$(awk -F= '$1 == "OPENCLAW_GATEWAY_TOKEN" {print substr($0, length($1) + 2)}' .env | tail -n 1)"

gateway_ready() {
  curl -fsS -m 2 \
    -H "Authorization: Bearer $GATEWAY_TOKEN" \
    "http://127.0.0.1:$PORT/v1/models" >/dev/null 2>&1
}

docker compose up -d --build postgres redis openclaw

for _ in $(seq 1 60); do
  if gateway_ready; then
    break
  fi
  sleep 1
done

gateway_ready
docker compose up -d --force-recreate api ops-web

echo "Ops web: http://127.0.0.1:4173"
