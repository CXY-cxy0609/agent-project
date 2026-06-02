---
name: orchestrator-task
requiredVars:
  - userMessage
optionalVars:
  subjectHint: ""
  availableSubjectsHint: ""
  imageSemanticHint: ""
---

## 任务要求

分析用户消息，识别意图类型，提取关键信息（科目、问题类型），输出结构化路由决策。
并补充 `video_required` 字段：仅当用户明确要求“生成讲解视频/动画演示/修复视频渲染”时置为 true，其他场景一律 false。

## 上下文信息

### 用户消息

{{userMessage}}

{{subjectHint}}

{{availableSubjectsHint}}

{{imageSemanticHint}}
