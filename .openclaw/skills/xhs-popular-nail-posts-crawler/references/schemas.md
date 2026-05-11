# Schemas

## xhs_search_summary.json

Run 级别 summary。位于 `$SUMMARY_PATH`，默认 `$RUN_ROOT/xhs_search_summary.json`。

这个文件由 `scripts.generate_summary` 生成。正常运行时不要手写 summary；如果需要调整 schema，同步修改 `scripts.generate_summary` 和本文件。

```json
{
  "run_dir": "<YYYYmmdd>",
  "sort": "popular",
  "type": "image",
  "count": 20,
  "batch": {
    "0": {
      "keyword": "手 美甲 女",
      "count": 20,
      "files": [
        {
          "page": 1,
          "raw_path": "assets/<YYYYmmdd>/search/0/popular_p1.json",
          "count": 20,
          "note_ids": ["note_id_1", "note_id_2"]
        }
      ]
    }
  }
}
```

字段：

- `run_dir`: 当前 run 日期，必须是 `<YYYYmmdd>`。
- `sort`: summary 对应的搜索排序。
- `type`: summary 对应的搜索类型。
- `count`: 当前 run 所有 batch 的笔记总数。
- `batch`: 以 `batch_id` 为 key 的对象。
- `batch.<batch_id>.keyword`: 当前 batch 对应的原始搜索关键词。
- `batch.<batch_id>.count`: 当前 batch 的笔记数量。
- `batch.<batch_id>.files`: 当前 batch 包含的 search raw JSON 文件。
- `batch.<batch_id>.files[].page`: `xhs search` 页码。
- `batch.<batch_id>.files[].raw_path`: search raw JSON 文件路径。
- `batch.<batch_id>.files[].count`: 当前 raw 文件里的笔记数量。
- `batch.<batch_id>.files[].note_ids`: 从当前 raw 文件提取出的笔记 id。

## xhs_note_registry.json

全局去重笔记 id registry。位于 `$REGISTRY_PATH`，默认 `assets/xhs_note_registry.json`。

这个文件由 `scripts.build_xhs_note_registry` 生成。正常运行时不要手写 registry；如果需要调整 schema，同步修改 `scripts.build_xhs_note_registry` 和本文件。

```json
{
  "runs": {
    "20260509": {
      "count": 20
    }
  },
  "unique_count": 2,
  "note_ids": [
    "note_id_1",
    "note_id_2"
  ]
}
```

字段：

- `runs`: 以日期为 key 的对象，key 必须是 `<YYYYmmdd>`。
- `runs.<YYYYmmdd>.count`: 当前 run 的笔记总数。
- `unique_count`: 全局唯一笔记 id 数量。
- `note_ids`: 全局唯一笔记 id 列表。

## xhs_note_digest.json

当前 run 的轻量笔记详情。位于 `$RUN_ROOT/xhs_note_digest.json`。

这个文件由 `scripts.read_note_details` 在读取完笔记详情后生成，并由 `scripts.download_note_images` 在下载图片后更新 `image_list`。正常运行时不要手写；如果需要调整 schema，同步修改相关脚本和本文件。

```json
{
  "run_dir": "assets/<YYYYmmdd>",
  "count": 1,
  "notes": [
    {
      "note_id": "note_id_1",
      "keyword": "手 美甲 女",
      "time": 1777117351000,
      "publish_date": "2026-04-25",
      "user_name": "小红书用户昵称",
      "title": "美甲标题",
      "desc": "笔记正文",
      "tag_list": ["美甲", "短甲"],
      "image_list": ["assets/<YYYYmmdd>/images/note_id_1/note_id_1_01.webp"],
      "standard_nail_image": "assets/<YYYYmmdd>/images/note_id_1/note_id_1_01.webp",
      "liked_count": 1000,
      "collected_count": 100,
      "share_count": 10
    }
  ]
}
```

字段：

- `run_dir`: 当前 run 日期，必须是 `<YYYYmmdd>`。
- `count`: 当前 digest JSON 里的笔记数量。
- `notes`: 从当前 run 详情结果提取出的笔记列表。
- `notes[].note_id`: 笔记 id。
- `notes[].keyword`: 该笔记来自的搜索关键词。
- `notes[].time`: 笔记发布时间，对应原始详情里的 `note_card.time`，单位为毫秒时间戳。
- `notes[].publish_date`: 笔记发布日期，由 `notes[].time` 按 `Asia/Shanghai` 转为 `YYYY-MM-DD`。
- `notes[].user_name`: 笔记作者昵称，对应原始详情里的 `note_card.user.nickname`。
- `notes[].title`: 笔记标题。
- `notes[].desc`: 笔记正文，对应原始详情里的 `note_card.desc`。
- `notes[].tag_list`: 笔记标签名称列表。
- `notes[].image_list`: 本地图片路径列表。
- `notes[].standard_nail_image`: 最后一张 `nail_count == 5` 的本地图片路径；没有则为空字符串。
- `notes[].liked_count`: 点赞数，对应原始详情里的 `note_card.interact_info.liked_count`，`万` 按 10000 换算为整数。
- `notes[].collected_count`: 收藏数，对应原始详情里的 `note_card.interact_info.collected_count`，`万` 按 10000 换算为整数。
- `notes[].share_count`: 转发数，对应原始详情里的 `note_card.interact_info.share_count`，`万` 按 10000 换算为整数。

## images/<note_id>/result.json

单个笔记图片文件夹的指甲分割结果。位于 `$IMAGES_DIR/<note_id>/result.json`。

这个文件由 `scripts.segment_nail_images` 生成。正常运行时不要手写。

如果至少一张图片识别到指甲：

```json
{
  "has_nail": "yes",
  "standard_nail_image": "note_id_01.webp",
  "images": [
    {
      "image": "note_id_01.webp",
      "nail_count": 5
    }
  ]
}
```

如果所有图片都没有识别到指甲：

```json
{
  "has_nail": "no",
  "standard_nail_image": ""
}
```

字段：

- `has_nail`: 字符串，`yes` 表示该笔记图片中至少一张包含指甲，`no` 表示没有识别到指甲。
- `standard_nail_image`: 当前 note 中最后一张 `nail_count == 5` 的图片文件名；没有则为空字符串。
- `images[].image`: 当前图片文件名。
- `images[].nail_count`: 当前图片识别出的指甲数量。
