---
name: qa-task
requiredVars:
  - question
optionalVars:
  conversationContext: ""
  ragContext: ""
---

## 任务要求

解答以下学生问题，步骤逐一展示，禁止跳步，知识点准确，公式使用 LaTeX 格式。

## 对话上下文

{{conversationContext}}

## 上下文信息

{{ragContext}}

### 学生问题

{{question}}
