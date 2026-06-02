---
name: storyboard-task
requiredVars:
  - knowledge
  - subject
---

## 任务要求

为以下知识点创作讲解视频的分镜脚本。请输出“可直接还原画面”的工程化分镜，不允许概括性描述。

必须严格输出结构化字段（与 schema 对齐）：

1. 每个 scene 必须包含：`scene_index`、`title`、`layout`、`description`、`animation_notes`、`narration`、`subtitles`
2. `layout` 仅允许两种：`left_right`（左右布局）或 `center`（居中布局）
3. `subtitles` 为字符串数组，每一行字幕：
   - 不能超过 25 个字
   - 最后一个字不能是标点符号（如 `，` `。` `！` `？` `；` `：` `、`）
4. `description` 必须包含完整画面文案与视觉信息（包括画面文字、公式、标签、标题、位置关系），不能写“展示概念/讲解原理”等泛化语句
5. `animation_notes` 必须包含可执行的动画细节（时间顺序、对象变化、运动轨迹、转场方式），确保仅靠文本即可还原镜头
6. `narration` 必须是完整可播报文案，不能只写摘要
7. `description`、`animation_notes`、`narration` 必须使用 YAML 多行块格式 `|` 输出；这些字段内容里经常包含冒号、比例、公式，例如 `2:1`，禁止写成未加引号的单行 YAML 值
8. `subtitles` 的每个数组项必须用引号包裹，避免冒号或公式导致 YAML 解析失败
9. 不要输出 `duration_seconds`、`total_duration_seconds` 或其他固定时长字段，避免后续脚本为了填满预设时长生成空白段

## 上下文信息

### 科目

{{subject}}

### 知识点

{{knowledge}}
