"""Example scene that only designs middle content via BaseScene inheritance."""

from __future__ import annotations

import shutil
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import ModuleType

from manim import DOWN, FadeIn, Text

from BaseScene import BaseScene


def _load_formula_tools() -> ModuleType:
    module_path = Path(__file__).parent / "function-tools" / "create_formula.py"
    spec = spec_from_file_location("create_formula", module_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load formula tools from {module_path}")

    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class LessonPageDemo(BaseScene):
    def construct(self) -> None:
        self.quick_show(
            title="二次函数基础",
            subtitle="标准形与图像性质",
            layout="two_columns",
            left_text="定义：\nf(x)=ax^2+bx+c",
            right_text="性质：\na>0 开口向上\n对称轴 x=-b/(2a)",
            page=1,
            total=3,
        )

        center_note = self.show_center_text("后续只需在这里编排中间内容即可。", font_size=40)
        self.play(FadeIn(center_note), run_time=0.4)

        has_latex = shutil.which("latex") is not None
        has_xelatex = shutil.which("xelatex") is not None
        if has_latex and has_xelatex:
            formula_tools = _load_formula_tools()
            formula = formula_tools.create_math_formula(r"\left(-\frac{b}{2a},\frac{4ac-b^2}{4a}\right)")
            formula.move_to(self.content_rect.get_center())
            self.play(FadeIn(formula), run_time=0.5)
            chinese_formula = formula_tools.create_chinese_formula(r"顶点坐标：$x=-\frac{b}{2a}$")
            chinese_formula.next_to(formula, DOWN, buff=0.5)
            self.play(FadeIn(chinese_formula), run_time=0.5)
        else:
            # Fallback preview when TeX is unavailable in the system.
            formula = Text(
                "(-b/2a, (4ac-b^2)/(4a))",
                font=self.default_font,
                color=self.default_color,
                font_size=40,
            ).move_to(self.content_rect.get_center())
            chinese_formula = Text(
                "顶点坐标：x = -b/(2a)",
                font=self.default_font,
                color=self.default_color,
                font_size=34,
            ).next_to(formula, DOWN, buff=0.5)
            self.play(FadeIn(formula), FadeIn(chinese_formula), run_time=0.5)

        # Optional TTS demo; enable after providing valid API credentials.
        self.add_voiceover("这是二次函数顶点坐标公式。")

        self.wait(1.5)
