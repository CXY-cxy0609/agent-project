---
name: storyboard-output
fields:
  - name: scenes
    type: array
    required: true
    description: 场景列表，每个场景包含 scene_index、description、animation_notes、narration、duration_seconds
  - name: total_duration_seconds
    type: number
    required: true
    description: 视频总时长（秒）
---

## 分镜脚本输出 Schema

用于 `VideoAgent` 的分镜生成节点（`generateStoryboard`），输出结构化分镜以供 Manim 脚本生成节点使用。

每个 `scenes` 数组元素的内部结构（约定格式）：

```yaml
scenes:
  - scene_index: 1
    description: 介绍导数定义
    animation_notes: 在坐标轴上展示割线逼近切线的过程
    narration: 导数其实就是函数在某点的瞬时变化率...
    duration_seconds: 25
total_duration_seconds: 120
```

| 顶层字段 | 类型 | 必填 | 说明 |
|---------|------|:----:|------|
| `scenes` | array | ✓ | 场景列表，3–6 个 |
| `total_duration_seconds` | number | ✓ | 全片总时长（秒），不超过 180 |

| 场景子字段 | 类型 | 说明 |
|-----------|------|------|
| `scene_index` | number | 场景序号，从 1 开始 |
| `description` | string | 场景内容描述 |
| `animation_notes` | string | 动画制作说明（供 Manim 生成节点使用） |
| `narration` | string | 旁白文案 |
| `duration_seconds` | number | 该场景预计时长（15–30 秒） |
