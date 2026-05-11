---
name: xhs-daily-nail-report
description: 当用户要基于 xhs-popular-nail-posts-crawler 的 digest 数据生成小红书热门美甲日报、周趋势、月趋势或大模型运营策略 Markdown 报告时使用该 skill。它只统计有 standard_nail_image 的笔记，读取 crawler assets 下的 xhs_note_digest.json，并把 Top 5 日报和运营策略写入本 skill 的 assets/<YYYYmmdd>/。
---

# xhs-daily-nail-report

该 skill 用于生成焕甲小红书热门美甲运营日报。报告读取 `xhs-popular-nail-posts-crawler` 已采集的 digest 数据，输出 Markdown 文件到本 skill 的 `assets/` 目录。

## 目标数据结构

```text
.openclaw/skills/xhs-daily-nail-report/
└── assets/
    └── 20260510/
        ├── xhs_daily_nail_report.md
        └── xhs_ops_strategy.md
```

- 日期按北京/上海时间计算，使用 `Asia/Shanghai`。
- run 目录必须是 `%Y%m%d`，例如 `20260510`。
- 报告文件名固定为 `xhs_daily_nail_report.md`。
- 大模型运营策略文件名固定为 `xhs_ops_strategy.md`。

## 数据源

只读取：

```text
.openclaw/skills/xhs-popular-nail-posts-crawler/assets/<YYYYmmdd>/xhs_note_digest.json
```

不要读取 raw search、read 详情或重新调用小红书 CLI。

## Workflow

### Step 1: 生成报告

从该 skill 目录执行：

```bash
python3 -m scripts.generate_report
```

脚本会：

- 找到北京/上海时间当天日期。
- 读取 crawler assets 中当天及之前已存在的 digest。
- 按 `note_id` 去重，保留采集日期最新的一条。
- 只统计 `standard_nail_image` 非空的笔记，代表图片使用 `standard_nail_image`。
- 用每条笔记的 `publish_date` 计算近 1 天、7 天、30 天窗口。
- 计算热门度：`liked_count + collected_count + share_count`。
- 每个时间窗口只取热门度 Top 5。
- 输出 Markdown 到 `assets/<YYYYmmdd>/xhs_daily_nail_report.md`。

### Step 2: 检查输出

如需生成运营策略，在日报生成后继续执行：

```bash
python3 -m scripts.generate_strategy
```

脚本会读取 `.env` 中的 `LONGCAT_API_KEY`、`LONGCAT_BASE_URL` 和 `LONGCAT_MODEL`，把当天 `xhs_daily_nail_report.md` 的趋势部分发送给 LongCat OpenAI 兼容接口，输出 `assets/<YYYYmmdd>/xhs_ops_strategy.md`，并把策略追加回 `assets/<YYYYmmdd>/xhs_daily_nail_report.md`。

### Step 3: 检查输出

确认报告文件存在，并告诉用户路径：

```text
assets/<YYYYmmdd>/xhs_daily_nail_report.md
assets/<YYYYmmdd>/xhs_ops_strategy.md
```

如果缺少某些日期的 digest，不要编造数据。

## 报告内容

Markdown 报告包含：

- 标题。
- 近 1 天热门款式：按 `publish_date` 过滤后的 Top 5。
- 近 7 天趋势：按 `publish_date` 过滤后的 Top 5。
- 近 30 天趋势：按 `publish_date` 过滤后的 Top 5。
- 运营策略：执行 `scripts.generate_strategy` 后追加，由大模型基于趋势日报生成。

不输出“数据范围”“运营建议”“数据缺口”段落，也不额外输出热门标签或稳定标签摘要。

报告表格只展示标签、一张代表图片、like、collect、share，不展示笔记标题或正文。代表图片区使用 40px 小图展示。

## 约束

- 不修改业务数据库。
- 不调用小红书 CLI。
- 不重新爬取数据。
- 不读取或输出 `xsec_token`。
- 不使用 digest 之外的数据作为热门款式依据。
- 生成运营策略时，只把日报 Markdown 作为大模型输入，不额外读取 raw 数据。
