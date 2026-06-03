---
name: storyboard-output
fields:
  - name: scenes
    type: array
    required: true
    description: 场景列表，每个场景必须包含 scene_index、title、layout、description、animation_notes、narration、subtitles
---

## 分镜脚本输出 Schema

用于 `VideoAgent` 的分镜生成节点（`generateStoryboard`），输出结构化分镜以供 Manim 脚本生成节点使用。

每个 `scenes` 数组元素的内部结构（约定格式）：

```yaml
scenes:
  - scene_index: 1
    title: 导数的直观起点
    layout: center
    geometry_render_mode: none
    description: |
      画面中央先出现标题“导数是瞬时变化率”，下方出现函数 f(x)=x^2。
      紧接着在 x=1 附近显示两点 A(1,1)、B(1.4,1.96)，并标注“平均变化率”。
      画面文字必须逐字给出，禁止只写“展示定义”这类概括语句。
    animation_notes: |
      标题从透明到不透明淡入，停留在屏幕中央上方。
      坐标轴从左下向右上绘制，函数曲线按路径动画出现。
      点 B 沿曲线向点 A 缓慢移动，同时割线实时旋转逼近切线。
      出现文字“h->0 时，平均变化率->瞬时变化率”。
    narration: |
      我们先从直观图像理解导数。
      当点 B 不断靠近点 A，割线的斜率就逼近切线斜率。
      这个极限过程，描述的就是瞬时变化率。
    subtitles:
      - 我们先看导数的直观意义
      - 点B靠近点A时割线会变化
      - 割线斜率最终逼近切线斜率
      - 这就是瞬时变化率的核心含义
```


| 顶层字段 | 类型 | 必填 | 说明 |
|---------|------|:----:|------|
| `scenes` | array | ✓ | 场景列表 |

| 场景子字段 | 类型 | 说明 |
|-----------|------|------|
| `scene_index` | number | 场景序号，从 1 开始 |
| `title` | string | 场景标题，需可直接用于镜头标识 |
| `layout` | string | 布局方式，仅允许 `left_right` 或 `center` |
| `description` | string | 场景内容描述 |
| `animation_notes` | string | 动画制作说明（需包含时序、对象、位置与运动细节） |
| `narration` | string | 旁白文案 |
| `subtitles` | array[string] | 字幕行列表；每行不超过 25 个字；每行最后一个字不能是标点 |
| `geometry_render_mode` | string | 可选；立体几何使用 `oblique_projection`，非立体几何使用 `none` 或省略 |
| `solid_figure` | object | 可选；立体几何结构化信息，用于脚本生成 2D 伪投影图 |

## 立体几何场景示例

涉及棱柱、棱锥、长方体、二面角、空间向量时，必须使用以下风格表达。注意：这是 2D 斜二测教材示意图，不是 Manim 3D 渲染。

```yaml
scenes:
  - scene_index: 2
    title: 原题几何图形
    layout: left_right
    geometry_render_mode: oblique_projection
    solid_figure:
      type: prism
      projection:
        kind: oblique
        depth_direction: right_up
        height_direction: up
      vertices:
        D: [0, 0, 0]
        A: [2, 0, 0]
        B: [1, 1.732, 0]
        C: [-1, 1.732, 0]
        D1: [0, 0, 4]
        A1: [2, 0, 4]
        B1: [1, 1.732, 4]
        C1: [-1, 1.732, 4]
        E: [0, 1.732, 0]
        M: [1, 1.732, 2]
        N: [1, 0, 2]
      edges:
        visible: [AB, BC, AA1, BB1, CC1, A1B1, B1C1, C1D1]
        hidden: [CD, DA, DD1, D1A1, A1D]
      highlights: [E, M, N, MN, C1DE]
    description: |
      左侧显示完整题干。右侧采用 2D 斜二测教材示意图绘制直四棱柱 ABCD-A1B1C1D1，不使用 3D 旋转镜头。
      底面 ABCD 为菱形，AB=2，angle BAD=60°，侧棱 AA1=4。
      可见边为实线，后侧或被遮挡边 CD、DA、DD1、D1A1、A1D 为虚线。
      E、M、N 分别标在 BC、BB1、A1D 的中点，用彩色点突出。
    animation_notes: |
      题干先在左侧淡入。右侧线框按底面、侧棱、顶面的顺序描边出现。
      隐藏边以虚线出现，E、M、N 三点依次放大高亮。
      不使用相机旋转、ThreeDAxes 或 3D mobject。
    narration: |
      我们先还原题目中的直四棱柱结构。
      图中三个特殊点分别是对应线段的中点。
    subtitles:
      - 我们先还原几何图形
      - 底面是六十度菱形
      - 三个点都是中点
```
