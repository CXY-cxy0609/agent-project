# BaseScene 使用规范

场景类应继承 `BaseScene`，并严格按以下约束组织代码。

## 1) 强约束（必须遵守）

1. 每页开始必须调用 `self.next_page(...)` 或 `self.start_page(...)`，禁止跨页堆叠残留元素。
2. **严禁定义或调用 `_play()`**（含任何 `play` 包装器）。
3. 动画播放统一走 `self.add_animation(...)`。
4. **字幕区域内容只允许通过 `self.speak_with_subtitles(...)` 生成。**，每行字幕最后不能是逗号、句号等标点符号
5. 内容布局只使用 `layout="center"` 或 `layout="left_right"`（等价 `two_columns`）。
6. 双栏比例仅允许：`"1:2"`、`"1:1"`、`"2:1"`。
7. **所有 LaTeX 公式必须通过 `apps/manim-project/function-tools/create_formula.py` 生成。**
8. **严禁直接使用 `MathTex` 或其他绕过 `create_formula.py` 的公式渲染方案。**
9. **必须严格遵照代码模板，在模板基础上添加/修改代码**

## 2) BaseScene 可配置类属性（全量）

以下类属性可在子类中覆盖：

1. `default_font = "PingFang SC"`：默认字体。
2. `default_color = WHITE`：默认文字颜色。
3. `show_layout_guides = True`：是否显示布局辅助框。
4. `subtitle_rect_down_shift = 0.08`：字幕区域下移量。
5. `content_subtitle_gap = 0.12`：内容区与字幕区最小间隔。
6. `two_column_ratio = "1:1"`：双栏默认比例。
7. `BYTEDANCE_TTS_API_KEY`：TTS API Key。
8. `BYTEDANCE_TTS_ENDPOINT`：TTS 接口地址。
9. `BYTEDANCE_TTS_RESOURCE_ID`：TTS 资源标识。
10. `BYTEDANCE_TTS_SPEAKER`：TTS 默认音色。

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
   - **只能通过该方法在页面中添加动画元素**。
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
   - `create_math_formula(expression, font_size=56, color=WHITE)`：纯数学公式。
   - `create_chinese_formula(latex_text, font_size=52, color=WHITE, cjk_font="PingFang SC")`：中英混排公式。
3. 规则：
   - latex公式对象创建必须调用上述函数。
   - 禁止直接写 `MathTex(...)`。
4. 示例：
   - `formula = create_math_formula(r"n = \frac{I t}{z F}", font_size=52)`
   - `self.add_animation(formula, animation=FadeIn(formula), run_time=0.8)`

## 4) 规范化调用顺序（推荐）

1. `self.next_page(...)` / `self.start_page(...)`
2. `self.set_title(...)` + `self.set_page_number(...)`
3. `self.create_parent(...)`（按需）
4. `self.add_text(...)` / `self.add_animation(...)`
5. `self.speak_with_subtitles([...])`（字幕区内容）
6. `self.wait(...)`（按需）

## 5) 模板展示

```python
from __future__ import annotations  #无需改动

import sys  # 无需改动
from pathlib import Path  # 无需改动

from manim import ()  # 根据场景需求从manim库中引入对应内容即可

BASE_DIR = Path(__file__).resolve().parents[2]  # 无需改动
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))
if str(BASE_DIR / "function-tools") not in sys.path:
    sys.path.append(str(BASE_DIR / "function-tools"))

from BaseScene import BaseScene  # 无需改动
from create_formula import create_math_formula  # 无需改动


class SceneName(BaseScene):  # 根据需求定义场景名字

    show_layout_guides = False  # 必须是False
    subtitle_rect_down_shift = 0.12  # 根据需求定义修改默认参数

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

        self.add_animation(visual_group, animation=[FadeIn(sun), Create(orbit)], run_time=0.7)

        lines = [
            "开普勒三定律描述了行星绕太阳运动的几何与时间规律"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.08)
```
