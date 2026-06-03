# BaseScene 使用规范

场景类应继承 `BaseScene`，并严格按以下约束组织代码。

## 1) 强约束（必须遵守）

### 代码要求

1. 每页开始必须调用 `self.next_page(...)` 或 `self.start_page(...)`，禁止跨页堆叠残留元素。
2. **严禁定义或调用 `_play()`**（含任何 `play` 包装器）。
3. 动画播放统一走 `self.add_animation(...)`，纯文字统一`self.add_text(...)`，公式统一`create_math_formula`
4. **字幕区域内容只允许通过 `self.speak_with_subtitles(...)` 生成。**，每行字幕最后不能是逗号、句号等标点符号
5. 内容布局只使用 `layout="center"` 或 `layout="left_right"`（等价 `two_columns`）
6. 双栏比例仅允许：`"1:2"`、`"1:1"`、`"2:1"`。
7. **所有 LaTeX 公式必须通过 `apps/manim-project/function-tools/create_formula.py` 生成。**
8. **严禁直接使用 `MathTex` 或其他绕过 `create_formula.py` 的公式渲染方案。**
9. **每个页面的主体图形（动画元素）必须先组成一个稳定的 `VGroup`，并且只通过一次 `self.add_animation(...)` 注册到布局中，为左右布局时，左边使用`self.add_text()`即可，为居中布局时，如果是纯文本同理，无需 `VGroup`和`self.add_animation(...)`**
10. **后续高亮、移动、显隐等动画必须复用已注册的页面主体对象，禁止把临时 `VGroup(...)` 作为新的 `mobject` 传入 `self.add_animation(...)`。**
11. **双栏或父容器布局中，图形必须显式传 `side=...` 或 `parent=...`，禁止依赖默认右栏布局。**
12. **必须严格遵照代码模板，在模板基础上添加/修改代码**
13. 避免导入模板代码外额外的库，比如`numpy`之类的
14. manim版本：Manim Community Edition（manim v0.20+），注意不要使用废弃的属性或api
15. 注意调整讲解节奏的连贯性，避免字幕语音过长时间的停顿
16. **场景类必须继承 `BaseScene`，不得继承 `Scene`、`ThreeDScene` 或其他 Manim 场景类。**
17. **页面主体图形一旦通过 `self.add_animation(..., side=... 或 parent=...)` 注册到布局后，不得再向该 `VGroup` 追加新的 `Dot/Line/Polygon/Text` 等图形对象。** 后续动画只能复用注册前已加入主体 `VGroup` 的对象；需要稍后出现的高亮点、辅助线、平面应在注册前创建并用 `set_opacity(0)` 隐藏。

### 立体几何渲染要求

`BaseScene` 是 2D 视频管线。遇到立体几何、空间几何、棱柱、棱锥、长方体、二面角、空间向量等内容时，必须使用 **2D 伪投影教材示意图**，禁止使用 Manim 真 3D 渲染。

1. 禁止导入或调用：`ThreeDScene`、`ThreeDAxes`、`Dot3D`、`Arrow3D`、`Surface`、`Cube`、`set_camera_orientation`、`move_camera`、`begin_ambient_camera_rotation`。
2. 禁止把 `[x, y, z]` 三维坐标直接传给 `Line`、`Polygon`、`Text.next_to` 等 2D 图元；必须先投影成 `[screen_x, screen_y, 0]`。
3. 画面绘制只使用 2D 图元：`Line`、`DashedLine`、`Polygon`、`Circle`、`Dot`、`Arrow`、`Text`、`VGroup`。
4. 数学推导可以在文字和旁白中使用三维坐标、空间向量、法向量；右侧图形只展示投影后的 2D 示意。
5. 可见边用 `Line`，被遮挡边用 `DashedLine`，关键点用 `Dot` 或小 `Circle` 标记。
6. 推荐斜二测投影：一个轴横向、一个轴斜向后方、竖直高度向上。常见实现为 `screen = origin + x * RIGHT + y * depth_vector + z * UP`。
7. 每个立体几何页面应封装 `_project_3d_to_2d(...)` 和 `_create_solid_diagram(...)` 一类 helper，返回稳定 `VGroup` 后再注册到布局。
8. 后续高亮线段、平面、向量时，必须复用同一批投影点创建 2D 线段或多边形，禁止切换到 3D 坐标轴或相机旋转。
9. 题目明确给出“中点、交点、垂足、平行线段端点”等依赖关系时，不要手写孤立近似坐标；应由相关端点计算得到（如 midpoint），再投影绘制，保证特殊点随图形一致移动。

### 样式要求

- 字体大小
  - 标题：32
  - 一般正文：28
  - 最小正文：20
  - 字幕：28
- 配色要求
  - 现代化
  - 必须初始化新的背景色
  - 字体颜色、动画元素颜色不得与背景色相同或相似

## 2) BaseScene 可配置类属性（全量）

以下类属性可根据需要在子类中覆盖：

1. `default_font = "PingFang SC"`：默认字体。
2. `default_color = WHITE`：默认文字颜色。
3. `background_color = "#0B1020"`：默认背景色，支持 Manim 颜色常量或十六进制颜色字符串。
4. `show_layout_guides = True`：是否显示布局辅助框。
5. `subtitle_rect_down_shift = 0.08`：字幕区域下移量。
6. `content_subtitle_gap = 0.12`：内容区与字幕区最小间隔。
7. `two_column_ratio = "1:1"`：双栏默认比例。

## 3) BaseScene 对外 API（非内部私有，完整声明）

> 说明：以下均为可直接在子类脚本中使用的 API。`_` 前缀方法属于内部实现，不应直接调用。

### 3.1 生命周期与页面管理

1. `setup() -> None`
   - 场景初始化钩子，通常不在业务场景中重写；如重写必须先 `super().setup()`。
2. `start_page(layout="center", column_ratio=None, clear_title=True, clear_subtitle=True, clear_page_number=True, show_column_guides=True, transition=False, transition_run_time=0.28) -> None`
   - 开始新页并清理旧页；适合首屏。
3. `next_page(layout="center", column_ratio=None, clear_title=True, clear_subtitle=True, clear_page_number=True, show_column_guides=True, transition=True, transition_run_time=0.28) -> None`
   - 语义化翻页 API；默认带过渡。
4. `clear_page(clear_title=True, clear_subtitle=True, clear_page_number=True, transition=False, transition_run_time=0.28) -> None`
   - 手动清页；一般由 `start_page/next_page` 间接调用。

### 3.2 版头与页码

1. `set_title(title: str, font_size: int = 44) -> Text`
   - 设置页标题。
2. `set_page_number(page: int, total: Optional[int] = None) -> Text`
   - 设置页码（如 `2/5`）。

### 3.3 布局与容器

1. `set_content_layout(layout="center", column_ratio=None, clear_existing=True, show_column_guides=True) -> None`
   - 切换内容布局模式。
2. `clear_content_items() -> None`
   - 清空当前布局中的内容对象。
3. `create_parent(name: str, side=None, width_ratio=1.0, height_ratio=1.0, align="center", overflow="auto", offset=ORIGIN, show_boundary=False) -> Rectangle`
   - 创建命名父容器，用于局部布局。
   - `align` 仅允许 `left/right/center`。
   - `overflow` 仅允许 `auto/scale/trim`。

### 3.4 内容添加与动画

1. `add_text(text: str, font_size=34, side=None, parent=None, line_spacing=0.75, animate=True, run_time=0.35) -> Text`
   - 文本添加主入口，自动换行与布局。
   - **只能通过该方法在页面中添加文字**。
2. `add_animation(mobject: Mobject, animation=None, side=None, parent=None, animate=True, run_time=0.45, play_kwargs=None) -> Mobject`
   - 图形与动画统一入口。
   - `animation` 支持单个动画或动画列表（并行）。
   - 对已布局对象可重复调用做后续动画。
   - **只能通过该方法在页面中添加动画元素，当为左右布局的左边区域时，不得使用**。
3. `show_center_text(text: str, font_size: int = 42) -> Text`
   - 快捷 API：切到居中布局并显示文本。
4. `show_two_columns(left_text: str, right_text: str, font_size: int = 34, column_ratio=None) -> VGroup`
   - 快捷 API：双栏文本展示。

### 3.5 语音与字幕

1. `speak_with_subtitles(lines: list[str], subtitle_font_size=30, speaker=None, api_key=None, endpoint=None, resource_id=None, sample_rate=24000, pause_between=0.12) -> None`
   - **字幕区唯一合法入口**：逐句播报并同步字幕。
2. `generate_tts_bytedance(text: str, output_file=None, speaker=None, api_key=None, endpoint=None, resource_id=None, sample_rate=24000) -> str`
   - 生成 TTS 音频文件路径。
3. `add_voiceover(text: str, **kwargs) -> str`
   - 单句语音便捷入口（仅加音频，不负责字幕逐句同步）。
   - 若需要字幕展示，仍应优先使用 `speak_with_subtitles`。

### 3.6 latex公式渲染（强约束）

1. 公式工具文件：`apps/manim-project/function-tools/create_formula.py`
2. 可用函数：
   - `create_math_formula(expression, font_size=56, color=WHITE)`：数学公式入口；纯数学走 `MathTex`，包含中文时自动走 XeLaTeX/CJK 模板。
   - `create_chinese_formula(latex_text, font_size=52, color=WHITE, cjk_font="PingFang SC")`：中英混排公式。
3. 规则：
   - latex公式对象创建必须调用上述函数。
   - 禁止直接写 `MathTex(...)`。
   - 纯数学、化学方程式、公式内含中文说明（如 `\text{通电}`）均优先使用 `create_math_formula(...)`。
   - 公式外包含中文说明时使用 `create_chinese_formula(...)`，公式部分必须写在 `$...$` 内，例如 `r"电解方程：$2H_2O \\rightarrow 2H_2 + O_2$"`。
   - 禁止为了规避中文 LaTeX 报错，把中文公式拆成普通 `Text` + 公式；应修复或使用 `create_formula.py` 的中文公式能力。
4. 示例：
   - `formula = create_math_formula(r"n = \frac{I t}{z F}", font_size=52)`
   - `equation = create_math_formula(r"2H_2O \rightarrow 2H_2 \uparrow + O_2 \uparrow", font_size=42)`
   - `equation = create_math_formula(r"2H_2O \xrightarrow{\text{通电}} 2H_2 \uparrow + O_2 \uparrow", font_size=42)`
   - `mixed = create_chinese_formula(r"电解方程：$2H_2O \rightarrow 2H_2 + O_2$", font_size=36)`
   - `self.add_animation(formula, animation=FadeIn(formula), run_time=0.8)`

## 4) 规范化调用顺序（推荐）

1. `self.next_page(...)` / `self.start_page(...)`
2. `self.set_title(...)` + `self.set_page_number(...)`
3. `self.create_parent(...)`（按需）
4. 构造当前页所有主体元素，合并为稳定的 `VGroup`
5. `self.add_text(...)` / `self.add_animation(page_group, side=... 或 parent=...)`
6. 后续动画继续调用 `self.add_animation(page_group, animation=...)`，不要注册新的临时组
7. `self.speak_with_subtitles([...])`（字幕区内容）
8. `self.wait(...)`（按需）

## 5) 模板展示

```python
from __future__ import annotations  #无需改动

import sys  # 无需改动
from pathlib import Path  # 无需改动

from manim import ()  # 根据场景需求从manim库中引入对应内容即可

BASE_DIR = Path(__file__).resolve().parents[4]  # 无需改动
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))
if str(BASE_DIR / "function-tools") not in sys.path:
    sys.path.append(str(BASE_DIR / "function-tools"))

from BaseScene import BaseScene  # 无需改动
from create_formula import create_math_formula, create_chinese_formula  # 无需改动


class SceneName(BaseScene):  # 根据需求定义场景名字

    show_layout_guides = False  # 必须是False
    subtitle_rect_down_shift = 0.12  # 根据需求定义修改默认参数
    background_color = "#0B1020"  # 根据需要修改，最好不要选择默认的颜色

    def construct(self) -> None:
        total_pages = 5  # 根据需要修改页数
        self._page_1(total_pages)
        self._page_2(total_pages)

    def _page_1(self, total_pages: int) -> None:
        self.start_page(layout="center", transition=False)  # 必须调用start_page
        self.set_title("开普勒三定律速学")  # 必须调用set_title
        self.set_page_number(1, total_pages)  # 必须调用

        self.add_text("开普勒用行星观测数据，总结出轨道运动三条规律。", font_size=33)

        sun = Circle(radius=0.18, color=YELLOW, fill_opacity=0.9).shift(DOWN * 1.0)
        orbit = Circle(radius=1.8, color=BLUE, stroke_opacity=0.8).shift(DOWN * 1.0)
        visual_group = VGroup(
            sun,
            orbit,
        )

        self.add_animation(visual_group, side="right", animation=[FadeIn(sun), Create(orbit)], run_time=0.7)
        self.add_animation(visual_group, animation=Indicate(sun, color=YELLOW), run_time=0.6)

        lines = [
            "开普勒三定律描述了行星绕太阳运动的几何与时间规律"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.08)
```