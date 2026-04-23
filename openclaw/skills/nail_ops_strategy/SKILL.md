# nail_ops_strategy

## 目标

生成 NailTry AI 的每日运营策略报告。

## 输入

- 可选日期，默认为当天
- 后端 API 地址

## 调用流程

1. 调用 `POST /api/v1/ops/reports/generate`
2. 获取结构化 JSON 与 markdown 草稿
3. 调用 `POST /api/v1/ops/reports/save`
4. 将结果反馈给运营后台或调度器

## 推荐请求

### 生成报告

```http
POST /api/v1/ops/reports/generate
```

### 保存报告

```http
POST /api/v1/ops/reports/save
Content-Type: application/json
```

```json
{
  "report_date": "2026-04-23",
  "markdown_content": "# NailTry AI 运营日报",
  "summary_text": "今日裸粉与法式热度上升。",
  "report_json": {}
}
```

## 约束

- 不要修改业务数据库结构
- 不要依赖真实 OpenClaw 运行时才能完成报告生成
- 默认以 API 为单一事实来源
