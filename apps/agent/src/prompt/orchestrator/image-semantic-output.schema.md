---
name: image-semantic-output
fields:
  - name: problem_text
    type: string
    required: true
    description: 基于图片语义重建后的完整题干或任务描述
  - name: visual_description
    type: string
    required: true
    description: 图像中的结构化视觉描述（图形、位置、标注、关系）
  - name: known_conditions
    type: array
    required: true
    description: 已知条件与约束列表，元素为 string
  - name: target_question
    type: string
    required: true
    description: 最终求解目标或用户真正问题
  - name: semantic_summary
    type: string
    required: true
    description: 供下游流程直接复用的紧凑语义摘要
---

## 图片语义输出 Schema

用于意图阶段将图片一次性转化为文本语义，供后续 QA / Video 子图复用，避免重复传图。
