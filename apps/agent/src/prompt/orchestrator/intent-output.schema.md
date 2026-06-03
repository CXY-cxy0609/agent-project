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
    description: 识别到的科目 ID；必须是“可选科目”列表里的真实 id，无法匹配则留空
  - name: confidence
    type: number
    required: true
    description: 置信度，0.0 到 1.0
  - name: video_required
    type: boolean
    required: false
    description: 是否需要执行视频生成子图。仅在用户明确要求视频时为 true
  - name: title
    type: string
    required: false
    description: 当前对话首轮可用的简短标题，概括用户本轮学习主题，建议 6 到 12 个中文字符
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
| `subject_id` | string | | 科目 ID；必须来自“可选科目”列表中的真实 `id`，无法匹配时留空 |
| `confidence` | number | ✓ | 模型判断置信度，范围 0.0–1.0 |
| `video_required` | boolean | | 是否明确需要视频生成；仅明确要求视频时返回 `true` |
| `title` | string | | 首轮对话标题，简短概括学习主题，如“卢沟桥事变”“电解水原理” |
| `reasoning` | string | | 一句话判断理由，便于 debug |
