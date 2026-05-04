---
name: xhs_nail_seed_crawler
description: 使用 xiaohongshu-cli 的 xhs 命令只读抓取小红书美甲笔记，尤其是“手 美甲 女”相关真实款式图，生成焕甲 MVP 可审核的本地 JSONL/XLSX 种子候选数据；不要使用 xhs user、search-user 或 user-posts。
---

# xhs_nail_seed_crawler

## 目标

为焕甲 MVP 采集小红书上的真实美甲款式候选，默认关键词为 `手 美甲 女`。产物只作为种子导入前的审核数据，不直接改数据库，不生成虚构款式，不暴露手图测试资产。

## 上游 CLI

`xiaohongshu-cli` 暴露的入口是 `xhs`，安装后常见命令分组如下：

- 账号：`login`、`login --qrcode`、`status`、`whoami`、`logout`
- 搜索/发现：`search`、`topics`、`feed`、`hot`
- 读取：`read`、`comments`、`comments --all`、`sub-comments`
- 用户相关：`search-user`、`user`、`user-posts`
- 互动/社交：`like`、`favorite`、`unfavorite`、`comment`、`reply`、`delete-comment`、`follow`、`unfollow`、`favorites`、`likes`
- 创作者/通知：`post`、`my-notes`、`delete`、`unread`、`notifications`

本 skill 只允许用账号检查、搜索/发现和读取类命令。`xhs user` 暂时不可用；同时不要调用 `xhs search-user`、`xhs user-posts` 这类用户流命令。不要点赞、收藏、评论、关注、发布或删除。

## 准备

```bash
command -v xhs >/dev/null || uv tool install xiaohongshu-cli
uv tool upgrade xiaohongshu-cli
```

执行任何抓取前先确认认证状态：

```bash
xhs status --json
```

如果未登录，优先使用本机浏览器 cookie 或扫码登录：

```bash
xhs login
xhs login --qrcode
xhs status --json
```

不要要求用户在对话里粘贴 cookie。遇到验证码、IP 限制或会话过期时，暂停抓取，让用户在浏览器完成验证或重新登录后再继续。

## 抓取流程

1. 创建批次目录，建议格式为 `data/xhs/raw/YYYYMMDD_HHMMSS/`。
2. 先抓默认关键词 `手 美甲 女`，再按需要扩展到 `女生 美甲 手`、`显手白 美甲`、`手部 美甲 款式`、`短甲 女生`。
3. 每个关键词优先跑 `popular`、`general`、`latest` 三种排序；默认只抓图片型笔记，可按需要补 `all`。
4. 每页搜索结果落盘为原始 JSON，不覆盖历史批次。
5. 从搜索结果里提取 note id、URL、xsec token、标题、封面图、互动计数等字段；再逐条 `read` 获取详情。
6. 每次详情读取之间 sleep 2 到 5 秒。不要并发请求，避免触发风控。
7. 保存候选前读取 `data/xhs/processed/xhs_dedupe_registry.json`，命中已有 note id、规范化 note URL、图片 URL 指纹或内容指纹时跳过，不重复写入候选文件。
8. 只保留真实美甲/手部款式相关笔记；剔除无图、非美甲、纯广告、教程无款式图、AI 生成图、明显重复和低清图片。
9. 输出审核用 JSONL 和可选 XLSX，不直接写入 `nail_styles`。

推荐搜索命令：

```bash
RUN_DIR="data/xhs/raw/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RUN_DIR"

xhs search "手 美甲 女" --sort popular --type image --page 1 --json > "$RUN_DIR/search_hand_nail_woman_popular_p1.json"
xhs search "手 美甲 女" --sort general --type image --page 1 --json > "$RUN_DIR/search_hand_nail_woman_general_p1.json"
xhs search "手 美甲 女" --sort latest --type image --page 1 --json > "$RUN_DIR/search_hand_nail_woman_latest_p1.json"
```

读取详情时优先使用搜索结果中的 URL；如果没有 URL，再使用 note id：

```bash
xhs read "<note_url_with_xsec_token>" --json > "$RUN_DIR/read_<note_id>.json"
xhs read "<note_id>" --json > "$RUN_DIR/read_<note_id>.json"
```

评论只在需要判断热度或用户偏好时少量读取：

```bash
xhs comments "<note_url_with_xsec_token>" --json > "$RUN_DIR/comments_<note_id>.json"
```

## 输出格式

标准产物：

- `data/xhs/raw/<batch>/search_*.json`：搜索原始输出
- `data/xhs/raw/<batch>/read_*.json`：详情原始输出
- `data/xhs/processed/xhs_nail_candidates_<batch>.jsonl`：审核候选
- `data/xhs/processed/xhs_nail_seed_<batch>.xlsx`：可选，贴近现有 xlsx 种子导入格式
- `data/xhs/processed/xhs_dedupe_registry.json`：跨批次去重登记表，保存前读取，保存后更新

JSONL 每行保留这些字段：

```json
{
  "source": "xiaohongshu",
  "query": "手 美甲 女",
  "sort": "popular",
  "page": 1,
  "note_id": "",
  "note_url": "",
  "title": "",
  "description": "",
  "image_urls": [],
  "cover_url": "",
  "tags": [],
  "liked_count": 0,
  "collected_count": 0,
  "comment_count": 0,
  "share_count": 0,
  "author_nickname": "",
  "crawled_at": "2026-05-04T00:00:00+08:00",
  "raw_detail_path": ""
}
```

XLSX 如需喂给现有 `scripts/seed_from_xlsx.py`，至少包含：

- `手图` sheet：保留表头 `手图URL`、`增强后款式图URL`，默认不填手图测试资产
- `款式图` sheet：表头 `序号`、`原始款式图URL`、`增强后款式图URL`

对于小红书原图，`原始款式图URL` 填候选图片 URL，`增强后款式图URL` 可先填同一个 URL；后续如有增强流程再替换。

## 去重登记表

`xhs_dedupe_registry.json` 是防止重复保存的单一事实来源。每次开始处理候选前加载它；文件不存在时初始化；每成功写入一条 JSONL/XLSX 候选后立即更新。

推荐结构：

```json
{
  "schema_version": 1,
  "updated_at": "2026-05-04T00:00:00+08:00",
  "notes": {
    "<note_id>": {
      "first_seen_batch": "20260504_000000",
      "note_url": "",
      "title": "",
      "raw_detail_path": ""
    }
  },
  "note_url_hashes": {
    "<sha256_normalized_note_url>": "<note_id>"
  },
  "image_url_hashes": {
    "<sha256_normalized_image_url>": "<note_id>"
  },
  "content_fingerprints": {
    "<sha256_title_description_first_image>": "<note_id>"
  }
}
```

去重键规则：

- `note_id` 是主键，命中则跳过。
- `note_url_hashes` 用规范化 URL 计算，去掉 `xsec_token`、时间戳、追踪参数等易变 query。
- `image_url_hashes` 对每张图片 URL 计算，去掉 query 后再 hash；任一图片已存在时默认跳过，除非人工确认是同款不同图。
- `content_fingerprints` 使用规范化标题、正文前 120 字、第一张图片规范化 URL 拼接后 hash，用于兜底识别换 URL 的重复笔记。
- 更新 registry 时先写临时文件再原子替换，避免中断造成 JSON 损坏。

## 质量门槛

- 每条候选必须至少有 1 张可访问图片，优先手部上手图或清晰款式图。
- 标题、正文或标签至少命中 `美甲`、`指甲`、`甲片`、`显白`、`法式`、`猫眼`、`裸粉`、`短甲`、`手` 中的一个美甲相关词。
- 同一 note id、规范化 note URL、图片 URL 指纹或内容指纹只保留一次。
- 候选数量少时先增加页数；不要转向用户主页批量抓取。
- 保存原始响应，方便排查字段变动和复跑。

## 完成检查

交付前汇总：

- 使用的关键词、排序、页数
- 搜索原始条数、详情读取条数、最终候选条数、剔除原因数量
- JSONL/XLSX 文件路径和 `xhs_dedupe_registry.json` 更新数量
- 是否出现认证、验证码、IP 限制或字段解析异常

如果需要进入应用数据流，再单独实现或调用仓库内的导入脚本，保持 provider / service / router 分层，不把抓取逻辑塞进移动端或路由层。
