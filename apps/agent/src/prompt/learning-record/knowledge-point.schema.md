---
name: knowledge-point
fields:
  - name: knowledge_points
    type: array
    required: true
    description: 知识点列表，每项包含 subject、chapter、point、difficulty
---

## 知识点提取 Schema

用于 `LearningRecordAgent` 从 QA 对话中结构化提取知识点，写入结构化记忆。

每个 `knowledge_points` 数组元素的内部结构（约定格式）：

```yaml
knowledge_points:
  - subject: 高等数学
    chapter: 第三章 导数与微分
    point: 洛必达法则
    difficulty: medium
```

| 子字段 | 类型 | 说明 |
|--------|------|------|
| `subject` | string | 规范化科目名，如"高等数学"、"英语" |
| `chapter` | string | 章节名，不确定时留空字符串 |
| `point` | string | 具体知识点名称，必须是可量化的学习单元 |
| `difficulty` | string | `easy` / `medium` / `hard`，基于题型客观判断 |
