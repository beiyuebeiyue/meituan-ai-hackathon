# AGENTS

## 仓库目标

本仓库只聚焦 NailTry AI MVP：

- 种子导入
- 浏览 feed
- Ask AI 推荐
- AI 试戴
- 运营日报和运营后台

不要优先实现非 MVP 功能，例如复杂抓取器、评论系统、聚类去重流水线、电商闭环。

## 启动方式

### API

```bash
docker compose up --build api postgres redis
```

### Mobile

```bash
cd apps/mobile
npm install
npx expo start
```

### Ops Web

```bash
docker compose up --build ops-web
```

## 常用脚本

导入种子：

```bash
python3 scripts/seed_from_xlsx.py --xlsx ./命题三美甲评测数据（对外版）.xlsx
```

增强元数据：

```bash
python3 scripts/enrich_style_metadata.py
```

生成 demo 指标：

```bash
python3 scripts/generate_demo_metrics.py --days 7
```

生成运营报告：

```bash
python3 scripts/generate_ops_report.py
```

## 完成定义

MVP 至少满足：

- 用户可浏览热门 / 最新
- 用户可登录、收藏、发布
- Ask AI 返回约 5 张真实款式图
- 试戴任务异步创建并可查询状态
- 运营侧能查看概览、历史报告、表现分析、任务日志
- 报告保存到数据库和本地文件

## 禁止事项

- 不要把手图测试资产暴露到用户流
- 不要把推荐结果改成现场生成的虚构款式
- 不要绕过 provider / service / router 分层
- 不要把 OpenAI API Key 放进移动端
