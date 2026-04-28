---
name: extract-knowledge-task
requiredVars:
  - question
  - answer
  - subject
---

从以下对话记录中提取涉及的知识点：

学生问题：{{question}}
解答内容：{{answer}}
科目：{{subject}}

请提取具体的知识点，每个知识点包含：所属科目、章节、知识点名称、难度。
