---
name: storyboard-task
requiredVars:
  - knowledge
  - subject
---

## 任务要求

为以下知识点创作讲解视频的分镜脚本。请输出“可直接还原画面”的工程化分镜，不允许概括性描述。

必须严格输出结构化字段（与 schema 对齐）：

1. 每个 scene 必须包含：`scene_index`、`title`、`layout`、`description`、`animation_notes`、`narration`、`subtitles`、`duration_seconds`
2. `layout` 仅允许两种：`left_right`（左右布局）或 `center`（居中布局）
3. `subtitles` 为字符串数组，每一行字幕：
   - 不能超过 25 个字
   - 最后一个字不能是标点符号（如 `，` `。` `！` `？` `；` `：` `、`）
4. `description` 必须包含完整画面文案与视觉信息（包括画面文字、公式、标签、标题、位置关系），不能写“展示概念/讲解原理”等泛化语句
5. `animation_notes` 必须包含可执行的动画细节（时间顺序、对象变化、运动轨迹、转场方式、停留时长），确保仅靠文本即可还原镜头
6. `narration` 必须是完整可播报文案，不能只写摘要
7. 全片 `total_duration_seconds` 不超过 180，单 scene 的 `duration_seconds` 建议 15-30 秒

## 上下文信息

### 科目

{{subject}}

### 知识点

{{knowledge}}
