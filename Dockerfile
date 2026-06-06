FROM node:20-bookworm-slim AS ops-web-builder

WORKDIR /workspace/apps/ops-web

COPY apps/ops-web/package*.json ./
RUN npm ci

COPY apps/ops-web ./
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build

FROM node:20-bookworm-slim AS mobile-web-builder

WORKDIR /workspace/apps/mobile

COPY apps/mobile/package*.json ./
RUN npm ci

COPY apps/mobile ./
ENV EXPO_PUBLIC_API_BASE_URL=https://dongli-meituan-ai-hackathon.hf.space/api/v1
RUN npx expo export --platform web --output-dir dist \
    && node scripts/rewrite-web-dist.js

FROM node:24-bookworm-slim AS openclaw-runtime
RUN npm install -g openclaw@2026.5.7

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    APP_PORT=7860 \
    DATABASE_URL=sqlite:////data/nail_ai.db \
    REDIS_URL=redis://127.0.0.1:6379/0 \
    OPENCLAW_ENABLED=true \
    OPENCLAW_BASE_URL=http://127.0.0.1:18798 \
    OPENCLAW_MODEL=openclaw/default \
    OPENCLAW_CONFIG_PATH=/workspace/.openclaw/openclaw.json \
    OPENCLAW_STATE_DIR=/workspace/.openclaw/state \
    UPLOAD_DIR=/data/uploads \
    TRYON_RESULT_DIR=/data/tryon_results \
    TRYON_ARTIFACT_DIR=/data/tryon_artifacts \
    SEED_DIR=/data/seed \
    REPORT_DIR=/data/reports \
    XHS_CRAWLER_ASSETS_DIR=/data/xhs-popular-nail-posts-crawler/assets \
    XHS_DAILY_REPORT_ASSETS_DIR=/data/xhs-daily-nail-report/assets \
    HF_BUCKET_URI=hf://buckets/dongli/meituan-ai-hackathon-storage \
    OPS_WEB_DIST=/workspace/apps/ops-web/dist \
    MOBILE_WEB_DIST=/workspace/apps/mobile/dist

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=openclaw-runtime /usr/local /usr/local

RUN useradd -m -u 1000 user

WORKDIR /workspace

COPY services/api /workspace/services/api
COPY xhs_weekly_nail_report.html /workspace/xhs_weekly_nail_report.html
COPY data/seed /workspace/data/seed
COPY --from=ops-web-builder /workspace/apps/ops-web/dist /workspace/apps/ops-web/dist
COPY --from=mobile-web-builder /workspace/apps/mobile/dist /workspace/apps/mobile/dist
COPY deploy/hf-openclaw/openclaw.json /workspace/.openclaw/openclaw.json
COPY deploy/hf-openclaw/workspace /workspace/.openclaw/workspace
COPY deploy/hf-openclaw/skills /workspace/.openclaw/workspace/skills
COPY scripts/start-hf-space.sh /workspace/start-hf-space.sh

RUN mkdir -p /data/uploads /data/tryon_results /data/tryon_artifacts /data/seed /data/reports /data/xhs-popular-nail-posts-crawler/assets /data/xhs-daily-nail-report/assets /workspace/data /workspace/.openclaw/state /workspace/.openclaw/logs \
    && chmod +x /workspace/start-hf-space.sh \
    && chown -R user:user /data /workspace

USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /workspace/services/api
RUN pip install --no-cache-dir --user --upgrade pip \
    && pip install --no-cache-dir --user . \
    && pip install --no-cache-dir --user --upgrade "huggingface_hub[hf_transfer]>=1.0"

EXPOSE 7860

CMD ["/workspace/start-hf-space.sh"]
