#!/usr/bin/env bash
set -euo pipefail

mkdir -p /workspace/.openclaw/state /workspace/.openclaw/logs
mkdir -p \
  /data/xhs-popular-nail-posts-crawler/assets \
  /data/xhs-daily-nail-report/assets

hydrate_packaged_seed_assets() {
  local sample="/workspace/data/seed/nails/ff31a259a83d23c8c4ce.png"
  if [ ! -f "${sample}" ] || ! head -c 32 "${sample}" | grep -q "version https://git-lfs"; then
    return 0
  fi

  if [ -z "${HF_TOKEN:-}" ]; then
    echo "HF_TOKEN is not set; packaged seed images are still LFS pointers" >&2
    return 0
  fi

  echo "Hydrating packaged seed images from Hugging Face LFS"
  python - <<'PY'
import os
from huggingface_hub import snapshot_download

snapshot_download(
    repo_id="dongli/meituan-ai-hackathon",
    repo_type="space",
    token=os.environ["HF_TOKEN"],
    allow_patterns=["data/seed/**"],
    local_dir="/workspace",
    force_download=True,
)
PY
}

hydrate_packaged_seed_assets

rm -rf /workspace/.openclaw/workspace/skills/xhs-popular-nail-posts-crawler/assets
rm -rf /workspace/.openclaw/workspace/skills/xhs-daily-nail-report/assets
ln -sfn /data/xhs-popular-nail-posts-crawler/assets /workspace/.openclaw/workspace/skills/xhs-popular-nail-posts-crawler/assets
ln -sfn /data/xhs-daily-nail-report/assets /workspace/.openclaw/workspace/skills/xhs-daily-nail-report/assets

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
XHS_WEEKLY_YEAR_DIR="/data/xhs-popular-nail-posts-crawler/assets/2026"

{
  sync_bucket_prefix "${HF_BUCKET_URI}/xhs-popular-nail-posts-crawler/assets" /data/xhs-popular-nail-posts-crawler/assets
  sync_bucket_prefix "${HF_BUCKET_URI}/xhs-daily-nail-report/assets" /data/xhs-daily-nail-report/assets
} > /workspace/.openclaw/logs/bucket-sync.log 2>&1 &

mkdir -p "${XHS_WEEKLY_YEAR_DIR}"
ln -sfn ../20260520 "${XHS_WEEKLY_YEAR_DIR}/w21"
ln -sfn ../20260520 "${XHS_WEEKLY_YEAR_DIR}/w22"

openclaw gateway --allow-unconfigured --bind loopback --port 18798 --auth none run \
  > /workspace/.openclaw/logs/gateway.log \
  2> /workspace/.openclaw/logs/gateway.err.log &

python /workspace/scripts/openclaw_scheduled_tasks.py \
  > /workspace/.openclaw/logs/scheduled-tasks.stdout.log \
  2> /workspace/.openclaw/logs/scheduled-tasks.stderr.log &

exec uvicorn app.main:app --host 0.0.0.0 --port 7860 --ws websockets
