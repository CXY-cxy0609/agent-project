---
name: orchestrator-image-semantic-task
requiredVars:
  - userMessage
---

## 任务要求

你将看到一张题目相关图片与用户文本。请做“语义重建”而非 OCR 抄录：

1. 还原题目核心语义与问题目标
2. 详细描述图形结构、几何关系、坐标关系、标注信息
3. 提取已知条件、约束、单位、边界条件
4. 给出可直接供后续问答/视频生成复用的语义摘要

要求：

- 输出必须结构化，严格遵守输出 schema
- 若图片信息不完整，请在 `known_conditions` 中明确写出不确定项
- 不要输出与题目无关的推断

## 上下文信息

### 用户文本

{{userMessage}}
