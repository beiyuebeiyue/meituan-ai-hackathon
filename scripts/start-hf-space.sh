#!/usr/bin/env bash
set -euo pipefail

mkdir -p /workspace/.openclaw/state /workspace/.openclaw/logs
mkdir -p \
  /data/xhs-popular-nail-posts-crawler/assets \
  /data/xhs-daily-nail-report/assets

sync_bucket_prefix() {
  local source="$1"
  local destination="$2"
  if [ -z "${HF_TOKEN:-}" ]; then
    echo "HF_TOKEN is not set; skipping bucket sync for ${source}" >&2
    return 0
  fi
  hf sync "${source}" "${destination}" --ignore-existing --token "${HF_TOKEN}" || {
    echo "Bucket sync failed for ${source}; continuing startup" >&2
  }
}

HF_BUCKET_URI="${HF_BUCKET_URI:-hf://buckets/dongli/meituan-ai-hackathon-storage}"

{
  sync_bucket_prefix "${HF_BUCKET_URI}/xhs-popular-nail-posts-crawler/assets" /data/xhs-popular-nail-posts-crawler/assets
  sync_bucket_prefix "${HF_BUCKET_URI}/xhs-daily-nail-report/assets" /data/xhs-daily-nail-report/assets
} > /workspace/.openclaw/logs/bucket-sync.log 2>&1 &

openclaw gateway --allow-unconfigured --bind loopback --port 18798 --auth none run \
  > /workspace/.openclaw/logs/gateway.log \
  2> /workspace/.openclaw/logs/gateway.err.log &

exec uvicorn app.main:app --host 0.0.0.0 --port 7860 --ws websockets
