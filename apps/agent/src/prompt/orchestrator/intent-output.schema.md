---
name: intent-output
fields:
  - name: intent
    type: string
    required: true
    description: 意图类型
    enum:
      - qa
      - video_request
      - knowledge_query
      - learning_report
      - unknown
  - name: subject_id
    type: string
    required: false
    description: 识别到的科目标识（math/english/politics/history 等），无法识别则留空
  - name: confidence
    type: number
    required: true
    description: 置信度，0.0 到 1.0
  - name: reasoning
    type: string
    required: false
    description: 简短的判断理由（一句话）
---

## 意图分类输出 Schema

用于 `OrchestratorAgent` 将用户消息分类为可路由的意图。

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `intent` | string | ✓ | 意图枚举：`qa` / `video_request` / `knowledge_query` / `learning_report` / `unknown` |
| `subject_id` | string | | 科目标识，如 `math` / `english` / `politics`，无法识别时留空 |
| `confidence` | number | ✓ | 模型判断置信度，范围 0.0–1.0 |
| `reasoning` | string | | 一句话判断理由，便于 debug |
