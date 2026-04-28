---
name: orchestrator-task
requiredVars:
  - userMessage
optionalVars:
  subjectHint: ""
---

用户消息：{{userMessage}}
{{subjectHint}}

请分析用户意图，输出结构化路由决策。
