---
name: generate-report-task
requiredVars:
  - userId
  - subject
  - records
---

根据学生的学习记录，生成个性化学情报告：

用户 ID：{{userId}}
科目：{{subject}}

历史学习记录（最近 30 条）：
{{records}}

请生成：
1. 整体学情评估（2-3 句话）
2. 常问知识点 TOP 5
3. 薄弱知识点分析（重点需加强的）
4. 个性化复习建议（3-5 条）

语言简洁，面向考研备考。
