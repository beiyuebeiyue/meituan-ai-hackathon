# 焕甲

焕甲是一个面向美团 AI 黑客松的 MVP 系统，包含：

- `apps/mobile`：React Native + Expo 用户侧 App
- `apps/ops-web`：React + Vite 运营后台
- `services/api`：FastAPI 后端
- `scripts/`：种子导入、元数据增强、demo 指标、日报生成
- `openclaw/skills/nail_ops_strategy`：OpenClaw skill 模板

## 仓库结构

```text
apps/
  mobile/
  ops-web/
services/
  api/
openclaw/
  skills/nail_ops_strategy/
scripts/
data/
```

## 1. 环境准备

复制环境变量：

```bash
cp .env.example .env
```

关键变量：

- `OPENAI_API_KEY`：试戴图像编辑接口
- `DATABASE_URL`：PostgreSQL 连接
- `REDIS_URL`：Redis 连接
- `SEED_XLSX_PATH`：xlsx 种子文件路径

## 2. 启动后端与后台

```bash
docker compose up --build
```

启动后可访问：

- API: `http://127.0.0.1:8000`
- Ops Web: `http://127.0.0.1:4173`

## 3. 启动移动端

```bash
cd apps/mobile
npm install
npx expo start
```

默认读 `.env` 中的 `EXPO_PUBLIC_API_BASE_URL`。

## 4. 初始化数据

导入 xlsx 种子：

```bash
python3 scripts/seed_from_xlsx.py --xlsx ./命题三美甲评测数据（对外版）.xlsx
```

增强样式元数据：

```bash
python3 scripts/enrich_style_metadata.py
```

生成 7 天 demo 指标：

```bash
python3 scripts/generate_demo_metrics.py --days 7
```

生成并保存今日运营报告：

```bash
python3 scripts/generate_ops_report.py
```

## 5. 核心 API

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/nails/hot`
- `GET /api/v1/nails/latest`
- `POST /api/v1/ai/recommend`
- `POST /api/v1/tryon/jobs`
- `GET /api/v1/tryon/jobs/{job_id}`
- `POST /api/v1/ops/reports/generate`
- `POST /api/v1/ops/reports/save`
- `GET /api/v1/ops/metrics/overview`
- `POST /api/v1/events/styles`

## 6. 测试

后端测试：

```bash
cd services/api
pip install -e .[dev]
pytest
```

## 7. 演示建议顺序

1. 导入种子图与测试手图
2. 增强元数据
3. 生成 demo 指标
4. 生成今日报告
5. 打开 mobile 演示浏览、收藏、发布、Ask AI、试戴
6. 打开 ops-web 演示总览、报告、表现分析、任务日志
