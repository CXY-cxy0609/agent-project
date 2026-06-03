---
name: manim-script-task
requiredVars:
  - storyboard
---

## 任务要求

根据以下分镜脚本，生成完整可运行的 Manim Python 代码：

1. 使用 Manim Community Edition（manim v0.20+）语法
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
- `geometryRenderMode`：可选，立体几何渲染模式；出现 `oblique_projection` 时必须按 2D 伪投影绘图
- `solidFigure`：可选，立体几何结构化信息；包含几何体类型、顶点、边、遮挡关系、投影参数等

不要依赖或生成 `durationSeconds`、`duration_seconds`、`total_duration_seconds` 等固定时长字段。动画和 `wait` 时长应按画面内容与旁白自然安排，禁止为了填满预设时长插入大段空白等待。

## BaseScene 使用规范（必须遵守）

{{baseSceneUsageRules}}

## 立体几何脚本生成规范（必须遵守）

当分镜包含 `geometryRenderMode: "oblique_projection"`，或题目涉及立体几何、空间向量、二面角、棱柱、棱锥、长方体时：

1. 不得导入或使用任何 Manim 3D API，包括 `ThreeDScene`、`ThreeDAxes`、`Dot3D`、`Arrow3D`、`Surface`、`Cube`、相机旋转 API。
2. 不得直接把三维坐标数组传给 `Line`、`Polygon`、`Dot`、`Text.next_to`；必须先投影为二维坐标。
3. 推荐在脚本内定义纯 Python 投影函数，不依赖 `numpy`：

```python
def _project_3d_to_2d(self, point, origin=ORIGIN):
    x, y, z = point
    depth = 0.45 * RIGHT + 0.28 * UP
    return origin + x * RIGHT + y * depth + z * UP
```

4. 推荐定义 `_create_solid_diagram(...) -> tuple[VGroup, dict[str, Mobject], dict[str, Mobject]]`，统一返回主体图、边对象、点对象，便于后续高亮复用。
5. 可见边使用 `Line`，隐藏边使用 `DashedLine`。点使用 `Dot`，标签使用 `Text(...).next_to(projected_point, direction)`。
6. 平面高亮使用投影后的 `Polygon(..., fill_opacity=0.18)`；向量高亮使用投影后的 `Line` 或 `Arrow`。
7. 需要后续高亮或逐步出现的点、线、面，必须在主体图 `VGroup` 注册到布局前创建并加入主体图，可先 `set_opacity(0)` 隐藏；禁止在 `self.add_animation(..., side="right")` 之后再向主体图追加新对象。
8. 题目给出中点、交点、垂足等特殊点时，优先通过端点关系计算，例如 `midpoint(p, q)`，不要手写与端点脱离的近似坐标。
9. 若需要更稳定的标准线框，可从 `function-tools/create_geometry_diagram.py` 导入 `project_oblique`、`create_wireframe_diagram` 等 helper。

## 上下文信息

### 分镜脚本

{{storyboard}}
