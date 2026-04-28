---
name: qa-output
fields:
  - name: answer
    type: string
    required: true
    description: 完整的解答内容，支持 Markdown 格式和 LaTeX 公式
  - name: knowledge_points
    type: array
    required: true
    description: 本题涉及的知识点列表，如 ["极限的定义", "洛必达法则"]
  - name: needs_video
    type: boolean
    required: true
    description: 是否建议生成讲解视频（复杂数学推导或几何问题建议生成）
  - name: difficulty
    type: string
    required: true
    description: 题目难度
    enum:
      - easy
      - medium
      - hard
  - name: subject
    type: string
    required: true
    description: 所属科目（规范化名称，如 高等数学、线性代数、英语等）
---

## QA 输出 Schema

用于 `QAAgent` 生成结构化的问答结果，同时供 `LearningRecordAgent` 提取知识点。

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `answer` | string | ✓ | 完整解答，支持 Markdown 和 LaTeX |
| `knowledge_points` | array | ✓ | 本题知识点列表，用于学情记录 |
| `needs_video` | boolean | ✓ | 是否需要视频讲解（触发 VideoAgent） |
| `difficulty` | string | ✓ | 难度：`easy` / `medium` / `hard` |
| `subject` | string | ✓ | 规范化科目名（高等数学、英语等） |
