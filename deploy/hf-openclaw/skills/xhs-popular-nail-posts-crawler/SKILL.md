---
name: xhs-popular-nail-posts-crawler
description: 当用户要爬取、采集、归档或补全小红书/Xiaohongshu/XHS 热门美甲图片笔记时使用该 skill。它用 xiaohongshu-cli 按关键词搜索热门 image 笔记，所有产物都写入该 skill 的 assets 目录：search raw JSON、run summary、全局笔记 id registry、笔记详情、digest JSON 和图片。registry 绝不能保存 xsec_token。
---

# xhs-popular-nail-posts-crawler

该 skill 用于端到端采集小红书热门美甲图片笔记：先搜索笔记概览，再读取笔记详情和图片，并维护全局笔记 id registry。所有产物都写入该 skill 的 `assets/` 目录；一次 run 必须产出 summary、registry、笔记详情、digest JSON 和图片。

因为小红书存在风控风险，建议每次爬取不超过 100 个笔记；如果用户要求超过 100 条，先提示风险并确认。

## 目标数据结构

所有产物都放在该 skill 的 `assets/` 目录下。run 目录必须按 `%Y%m%d` 创建，只能是 8 位日期，不要添加 `_sample`、时间戳或其他后缀。

```text
.openclaw/skills/xhs-popular-nail-posts-crawler/
└── assets/
    ├── xhs_note_registry.json
    └── 20260501/
        ├── xhs_search_summary.json
        ├── xhs_note_digest.json
        ├── search/
        │   ├── 0/
        │   │   ├── popular_p1.json
        │   │   └── popular_p2.json
        │   └── 1/
        │       └── popular_p1.json
        ├── read/
        │   ├── <note_id_1>.json
        │   └── <note_id_2>.json
        └── images/
            └── <note_id>/
                ├── <note_id>_01.webp
                ├── <note_id>_02.webp
                ├── result.json
                └── masks/
                    └── <note_id>_01_mask.webp
```

- `assets/` 是该 skill 的固定产物根目录。
- `xhs_note_registry.json` 保存全局唯一笔记 id。
- `search/<batch_id>/` 保存 `xhs search` 原始结果。
- `search/0`、`search/1` 这样的数字目录是 `batch_id`，分别对应不同关键词。
- `read/` 保存所有 `xhs read` 原始详情结果。
- `xhs_note_digest.json` 保存从详情结果提取出的轻量字段，便于快速查看。
- `images/<note_id>/` 保存从详情结果下载的图片。
- `images/<note_id>/result.json` 保存该笔记图片的指甲分割结果。
- `images/<note_id>/masks/` 保存该笔记图片对应的 mask 图。

## 运行前

1. 确认 CLI 可用：

```bash
xhs --version
```

如果 `xhs` 不可用，则尝试安装 `xiaohongshu-cli`：

```bash
uv tool install xiaohongshu-cli
```

安装完成后，再次运行 `xhs --version` 确认 CLI 可用。如果安装失败，提示用户手动安装 `xiaohongshu-cli`，然后停止当前流程；安装完成后再重新运行本 skill。

2. 确认登录用户：

```bash
xhs whoami --json
```

读取输出 JSON。如果 `ok` 是 `true`，从 `data.user.name` 读取用户名，并告诉用户“当前小红书登录用户：<name>”，然后进入正式运行流程。

如果 `ok` 是 `false`，运行：

```bash
xhs login
```

`xhs login` 会自动从浏览器读取 cookie，并使用该账号登录。登录后再次运行：

```bash
xhs whoami --json
```

如果这次 `ok` 是 `true`，读取 `data.user.name` 并继续。否则，提示用户打开 <https://www.xiaohongshu.com/> 先在浏览器登录小红书；用户完成浏览器登录后，再重新运行本 skill，然后停止当前流程。

## 运行变量

```bash
cd .openclaw/skills/xhs-popular-nail-posts-crawler
. scripts/init_run_env.sh
```

`. scripts/init_run_env.sh` 默认当前目录就是该 skill 根目录，并创建 `assets/%Y%m%d/`，设置 `RUN_ROOT`、`SEARCH_DIR`、`READ_DIR`、`IMAGES_DIR`、`SUMMARY_PATH` 和 `REGISTRY_PATH`。不要手动覆盖这些路径。

## 允许命令

运行本 skill 时，只允许调用以下 `xhs` 命令:

- `xhs --version`
- `xhs whoami --json`
- `xhs login`
- `xhs search <keyword> --sort popular --type image --page <n> --json`
- `xhs read <note_id_or_url> --xsec-token <xsec_token> --json`

不要调用其他 `xhs` 命令，也不要给上述命令添加未列出的额外参数。

## Workflow

### Step 1: 选择关键词

默认使用 `手 美甲 女` 进行搜索。如果用户提供了关键词，则使用用户提供的关键词进行搜索。需要扩大覆盖面时，可使用我们提供的备选关键词。

### Step 2: 逐页搜索笔记

为每个 keyword 分配一个 `batch_id`，例如 `0`、`1`、`2`。该 keyword 的搜索结果保存到 `$SEARCH_DIR/<batch_id>/`。

逐页执行 `xhs search`，通常每页约 20 个笔记。通常每搜索 10 页换一个关键词，避免同一个关键词搜索过深。每保存一页 raw JSON 后，立即更新 `$SUMMARY_PATH`。请求下一页前先检查当前 summary 计数；达到本次计划采集量后，进入 registry 合并和详情读取流程。

```bash
BATCH_ID="0"
KEYWORD="手 美甲 女"
PAGE="1"
RUN_DIR="$SEARCH_DIR/$BATCH_ID"

mkdir -p "$RUN_DIR"

xhs search "$KEYWORD" --sort popular --type image --page "$PAGE" --json \
  > "$RUN_DIR/popular_p${PAGE}.json"

python3 -m scripts.generate_summary \
  --batch-id "$BATCH_ID" \
  --keyword "$KEYWORD"
```

### Step 3: 合并 Registry

搜索完成后，必须将 run summary 合并到全局 registry：

```bash
python3 -m scripts.build_xhs_note_registry
```

registry 是跨 run 的全局索引，保存所有已采集笔记的唯一 id。不要因为测试或小样本运行跳过这一步。

### Step 4: 读取笔记详情

合并 registry 后，读取当前 run 的笔记详情。

```bash
python3 -m scripts.read_note_details
```

`read_note_details` 会通过 `$SUMMARY_PATH` 定位当前 run 的 `search/` raw JSON，从 raw JSON 读取笔记 id 与 token，并覆盖当前 run 已存在的笔记详情。详情读取完成后，生成 `$RUN_ROOT/xhs_note_digest.json`。

### Step 5: 下载笔记图片

读取详情后，从 `$RUN_ROOT/read/` 里的详情 JSON 下载图片到 `$IMAGES_DIR/<note_id>/`，并把 `$RUN_ROOT/xhs_note_digest.json` 里的 `image_list` 更新为本地图片路径。

```bash
python3 -m scripts.download_note_images
```

如果任一笔记图片下载失败，立即停止并报告失败项，不要静默跳过。

### Step 6: 指甲分割

图片下载完成后，使用本地 `spaces/nail_yolo26/best.pt` 对 `$IMAGES_DIR/<note_id>/` 下的图片做 batch 指甲分割。

```bash
NAIL_SEG_BATCH_SIZE=8 ../../../.venv/bin/python -m scripts.segment_nail_images
```

每个 note 文件夹会生成 `result.json`。如果任一图片识别到指甲，`has_nail` 写为 `yes`，并列出每张图片的文件名和指甲数量；如果所有图片都没有识别到指甲，`has_nail` 写为 `no`。`standard_nail_image` 保存最后一张 `nail_count == 5` 的图片文件名，没有则为空字符串。同一文件夹下还会创建 `masks/`，保存识别到指甲的图片 mask。分割完成后，同步把 `standard_nail_image` 写入 `$RUN_ROOT/xhs_note_digest.json`；digest 中保存本地图片路径，没有则为空字符串。

### Step 7: 提取美甲检索 Features

分割完成后，直接调用 feature 分析脚本。该脚本以全局 registry 的唯一笔记 id 为准，自动扫描 `assets/<YYYYMMDD>/xhs_note_digest.json`，优先使用 `standard_nail_image`，否则使用第一张本地存在的 `image_list` 图片。脚本支持续跑：已有成功项会跳过，失败或缺失项会继续处理。

```bash
../../../.venv/bin/python scripts/analyze_image_features.py
```

输出写入：

```text
assets/xhs_image_features.json
```

不要在 workflow 中手写或复制 feature prompt；prompt 已内置在 `scripts/analyze_image_features.py`。如需审查或修改 prompt，见本文档末尾的 `Feature Analysis Prompt`。

## Helper Scripts

可执行 Python helper 从 skill 目录以 `python3 -m scripts.<module>` 调用。

- `scripts/init_run_env.sh`: 创建固定日期 run 目录，并设置本次 run 必需的环境变量。
- `scripts.generate_summary`: 根据 `batch_id` 读取 `$SEARCH_DIR/<batch_id>`，并按 `references/schemas.md` 生成或更新 `$SUMMARY_PATH`。
- `scripts.build_xhs_note_registry`: 将当前 summary 合并到 `$REGISTRY_PATH`。
- `scripts.read_note_details`: 通过当前 run summary 定位 raw JSON，读取笔记 id 与 token，将笔记详情 JSON 写到 `$RUN_ROOT/read/`，并生成 `$RUN_ROOT/xhs_note_digest.json`。
- `scripts.download_note_images`: 从 `$RUN_ROOT/read/` 提取图片 URL，下载到 `$IMAGES_DIR/<note_id>/`，并更新 digest 的 `image_list`。
- `scripts.segment_nail_images`: 使用本地 clone 的 `spaces/nail_yolo26/best.pt` 做 batch 分割，生成 `result.json`、mask 图，并更新 digest 的 `standard_nail_image`。
- `scripts.analyze_image_features`: 以全局 registry 的唯一笔记 id 为准，使用 LongCat/OpenAI-compatible API 分析本地美甲图片，并把可检索 features 续跑写入 `assets/xhs_image_features.json`。
- `scripts.import_digest_standard_posts`: 输入日期，从 `assets/<YYYYmmdd>/xhs_note_digest.json` 创建/复用用户，并把存在的 `standard_nail_image` 以该用户身份导入为平台发布内容。
- `scripts.generate_demo_bookings`: 输入日期，给当前 digest 对应的平台用户随机生成 `completed` 和 `rejected` 预约，用于运营后台演示。
- `scripts.utils`: 共享 JSON 读写、原子写入和笔记 id 提取函数。

## Schemas

`xhs_search_summary.json`、`xhs_note_registry.json` 和 `xhs_note_digest.json` 的格式见 `references/schemas.md`。这些文件都由 Python helper function 生成。

## Outputs

标准产物：

- `$SEARCH_DIR/<batch_id>/popular_p*.json`: `xhs search` raw JSON。
- `$RUN_ROOT/xhs_search_summary.json`: run-level summary。
- `$REGISTRY_PATH`: 全局去重笔记 id registry。
- `$RUN_ROOT/read/<note_id>.json`: `xhs read` raw 笔记详情 JSON。
- `$RUN_ROOT/xhs_note_digest.json`: 从详情结果提取出的轻量笔记 JSON；图片下载完成后，`image_list` 为本地图片路径；分割完成后，`standard_nail_image` 为本地图片路径。
- `$IMAGES_DIR/<note_id>/*`: 从笔记详情下载的图片文件。
- `$IMAGES_DIR/<note_id>/result.json`: 当前笔记图片的指甲识别结果。
- `$IMAGES_DIR/<note_id>/masks/*`: 当前笔记图片的指甲 mask 图。
- `assets/xhs_image_features.json`: 全局笔记图片 feature 分析结果，按 registry 顺序保存，支持续跑。

## Resume and Failure Handling

复用同一个 `RUN_ROOT` 可以恢复中断的 run。summary 可以从已保存 raw JSON 重新生成。笔记详情可能更新，补跑详情时可以重新读取当前 run 的笔记详情。

常见认证问题：

| Symptom | Agent action |
| --- | --- |
| `NoCookieError: No 'a1' cookie found` | 引导用户在浏览器打开 <https://www.xiaohongshu.com/> 并登录小红书。 |
| `NeedVerifyError: Captcha required` | 让用户打开浏览器完成验证码，然后重试。 |
| `IpBlockedError: IP blocked` | 建议用户切换网络，例如热点或 VPN。 |
| `SessionExpiredError` | 运行 `xhs login` 刷新浏览器 cookie。 |
