---
name: orchestrator-task
requiredVars:
  - userMessage
optionalVars:
  subjectHint: ""
---

## 任务要求

分析用户消息，识别意图类型，提取关键信息（科目、问题类型），输出结构化路由决策。

## 上下文信息

### 用户消息

{{userMessage}}

{{subjectHint}}
