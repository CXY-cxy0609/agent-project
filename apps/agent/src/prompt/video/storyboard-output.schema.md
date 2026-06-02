---
name: storyboard-output
fields:
  - name: scenes
    type: array
    required: true
    description: 场景列表，每个场景必须包含 scene_index、title、layout、description、animation_notes、narration、subtitles、duration_seconds
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
    title: 导数的直观起点
    layout: center
    description: |
      画面中央先出现标题“导数是瞬时变化率”，下方出现函数 f(x)=x^2。
      紧接着在 x=1 附近显示两点 A(1,1)、B(1.4,1.96)，并标注“平均变化率”。
      画面文字必须逐字给出，禁止只写“展示定义”这类概括语句。
    animation_notes: |
      0-2秒：标题从透明到不透明淡入，停留在屏幕中央上方。
      2-6秒：坐标轴从左下向右上绘制，函数曲线按路径动画出现。
      6-12秒：点 B 沿曲线向点 A 缓慢移动，同时割线实时旋转逼近切线。
      12-18秒：出现文字“h->0 时，平均变化率->瞬时变化率”。
    narration: |
      我们先从直观图像理解导数。
      当点 B 不断靠近点 A，割线的斜率就逼近切线斜率。
      这个极限过程，描述的就是瞬时变化率。
    subtitles:
      - 我们先看导数的直观意义
      - 点B靠近点A时割线会变化
      - 割线斜率最终逼近切线斜率
      - 这就是瞬时变化率的核心含义
    duration_seconds: 25
total_duration_seconds: 120
```

| 顶层字段 | 类型 | 必填 | 说明 |
|---------|------|:----:|------|
| `scenes` | array | ✓ | 场景列表 |
| `total_duration_seconds` | number | ✓ | 全片总时长（秒），不超过 180 |

| 场景子字段 | 类型 | 说明 |
|-----------|------|------|
| `scene_index` | number | 场景序号，从 1 开始 |
| `title` | string | 场景标题，需可直接用于镜头标识 |
| `layout` | string | 布局方式，仅允许 `left_right` 或 `center` |
| `description` | string | 场景内容描述 |
| `animation_notes` | string | 动画制作说明（需包含时序、对象、位置与运动细节） |
| `narration` | string | 旁白文案 |
| `subtitles` | array[string] | 字幕行列表；每行不超过 25 个字；每行最后一个字不能是标点 |
| `duration_seconds` | number | 该场景预计时长（15–30 秒） |
