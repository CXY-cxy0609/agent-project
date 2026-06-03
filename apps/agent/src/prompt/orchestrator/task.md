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
只要用户在询问课程知识、概念解释、题目解答、学习方法或学情报告，都属于学习场景；历史事件、政治常识、通识知识等课程相关问题应归为 `qa`。
科目列表只用于选择 `subject_id`：能匹配时必须输出列表中的真实 `id`，不能输出 math/english 等泛化学科代码；不能匹配时可省略 `subject_id`，不要因此把学习问题判为 `unknown`。
补充 `title` 字段：用 6 到 12 个中文字符概括当前对话主题，不要包含“请讲解”“帮我”等泛化动词；例如“卢沟桥事变”“电解水原理”“开普勒三定律”。

## 上下文信息

### 用户消息

{{userMessage}}

{{subjectHint}}

{{availableSubjectsHint}}

{{imageSemanticHint}}
