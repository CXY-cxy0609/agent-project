"""Three-minute Taylor formula lecture demo scene."""

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
    def _show_center_block(self, text: str, *, font_size: int = 34) -> Text:
        block = Text(
            text,
            font=self.default_font,
            color=self.default_color,
            font_size=font_size,
            line_spacing=0.8,
        ).move_to(self.content_rect.get_center())
        block.width = min(block.width, self.content_rect.width * 0.9)
        self.play(FadeIn(block), run_time=0.35)
        return block

    def construct(self) -> None:
        self.set_title("泰勒公式三分钟速讲")
        self.set_subtitle("定义、展开、误差与应用")
        self.set_page_number(1, 5)
        intro = self._show_center_block("从局部信息，近似还原函数整体。", font_size=40)

        self.speak_with_subtitles(
            [
                "这一节我们用大约三分钟，建立对泰勒公式的完整直觉。",
                "核心问题是：已知函数在某一点附近的导数信息，能否重建函数值。",
                "答案是可以，我们用多项式逐阶逼近原函数。",
                "阶数越高，局部近似通常越精确。",
            ],
            subtitle_font_size=28,
        )
        self.remove(intro)

        self.set_page_number(2, 5)
        section_1 = self._show_center_block(
            "一、泰勒展开基本形式\n\n"
            "f(x)=f(a)+f'(a)(x-a)+f''(a)/2!(x-a)^2+...+R_n(x)",
            font_size=34,
        )
        self.speak_with_subtitles(
            [
                "泰勒展开围绕展开点 a 展开。",
                "常数项是 f 在 a 点的函数值。",
                "一次项由一阶导数决定，描述切线方向。",
                "二次项由二阶导数决定，描述弯曲程度。",
                "一直加到 n 次项后，再加一个余项 R n，表示尚未展开的部分。",
            ],
            subtitle_font_size=28,
        )

        self.set_page_number(3, 5)
        self.remove(section_1)
        has_latex = shutil.which("latex") is not None
        has_xelatex = shutil.which("xelatex") is not None
        if not has_latex or not has_xelatex:
            missing_bins = []
            if not has_latex:
                missing_bins.append("latex")
            if not has_xelatex:
                missing_bins.append("xelatex")
            raise RuntimeError(
                "TeX rendering is required for this scene, but missing executables: "
                f"{', '.join(missing_bins)}. "
                "Please install TeX (e.g. brew install --cask mactex-no-gui)."
            )

        section_2_nodes = []
        formula_tools = _load_formula_tools()
        formula = formula_tools.create_math_formula(r"e^x=1+x+\frac{x^2}{2!}+\frac{x^3}{3!}+\cdots")
        formula.move_to(self.content_rect.get_center())
        self.play(FadeIn(formula), run_time=0.5)
        section_2_nodes.append(formula)
        chinese_formula = formula_tools.create_chinese_formula(r"在 $a=0$ 时这就是麦克劳林展开")
        chinese_formula.next_to(formula, DOWN, buff=0.45)
        self.play(FadeIn(chinese_formula), run_time=0.35)
        section_2_nodes.append(chinese_formula)
        section_2_text = Text(
            "示例：e^x 的每阶导数仍是 e^x，所以在 0 点都等于 1",
            font=self.default_font,
            color=self.default_color,
            font_size=28,
        ).next_to(chinese_formula, DOWN, buff=0.3)
        self.play(FadeIn(section_2_text), run_time=0.3)
        section_2_nodes.append(section_2_text)

        self.speak_with_subtitles(
            [
                "最经典例子是指数函数 e 的 x 次方。",
                "在 a 等于零时，它的展开是 1 加 x 加 x 平方除以二的阶乘，再往后类推。",
                "这个例子说明：导数信息可以直接转成多项式系数。",
                "实际计算里，我们常常只保留前几项就能获得很高精度。",
            ],
            subtitle_font_size=28,
        )

        self.set_page_number(4, 5)
        self.remove(*section_2_nodes)
        section_3 = self._show_center_block(
            "二、余项与误差\n\n"
            "R_n(x)=f^(n+1)(ξ)/(n+1)! · (x-a)^(n+1)\n"
            "其中 ξ 在 a 与 x 之间",
            font_size=32,
        )
        self.speak_with_subtitles(
            [
                "很多同学会问，截断后误差到底有多大。",
                "答案就在余项。",
                "拉格朗日余项告诉我们，误差量级与下一阶导数和 x 减 a 的 n 加一次方相关。",
                "这意味着 x 离展开点越近，误差通常越小。",
                "所以泰勒公式本质上是一个局部近似工具。",
            ],
            subtitle_font_size=28,
        )

        self.set_page_number(5, 5)
        self.remove(section_3)
        summary = self._show_center_block(
            "三、应用与总结\n\n"
            "1) 数值计算：快速近似 sin, cos, e^x\n"
            "2) 机器学习：优化算法中的局部线性/二次近似\n"
            "3) 物理建模：小量展开与线性化",
            font_size=30,
        )
        self.speak_with_subtitles(
            [
                "最后做一个总结。",
                "第一，泰勒公式把函数值问题转化成导数系数问题。",
                "第二，截断阶数决定近似精度，余项负责误差控制。",
                "第三，在数学分析、工程计算和机器学习中，它都是基础工具。",
                "如果你记住一句话：泰勒公式就是用有限项多项式，近似无限复杂的函数。",
                "到这里，三分钟泰勒公式讲解就完成了。",
            ],
            subtitle_font_size=28,
        )
