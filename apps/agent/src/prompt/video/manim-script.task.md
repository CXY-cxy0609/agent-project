---
name: manim-script-task
requiredVars:
  - storyboard
---

## 任务要求

根据以下分镜脚本，生成完整可运行的 Manim Python 代码：

1. 使用 Manim Community Edition（manim v0.18+）语法
2. 所有场景封装在一个 Scene 类中
3. 代码完整，可直接运行，包含必要的 import 语句
4. 仅返回python代码，不包含其他内容

## 分镜输入字段说明（storyboard 为 JSON 数组）

每个 scene 对象字段如下：

- `sceneIndex`：场景序号（从 0 开始）
- `title`：场景标题
- `layout`：布局方式，仅 `left_right` 或 `center`
- `description`：完整画面描述（含画面文字/公式/标签等）
- `animationNotes`：动画执行说明（含时序与运动细节）
- `narration`：该场景完整旁白
- `subtitles`：字幕行数组（每项为单行字幕）
- `durationSeconds`：该场景预计时长（秒）

## BaseScene 使用规范（必须遵守）

{{baseSceneUsageRules}}

## 上下文信息

### 分镜脚本

{{storyboard}}
