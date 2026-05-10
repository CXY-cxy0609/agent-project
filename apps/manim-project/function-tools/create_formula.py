"""Formula helper for Chinese-friendly LaTeX rendering in Manim."""

from __future__ import annotations

import shutil

from manim import MathTex, Tex, TexTemplate, WHITE


def build_chinese_tex_template(font_family: str = "PingFang SC") -> TexTemplate:
    """
    Build a XeLaTeX template that supports Chinese and math mixed rendering.
    """
    template = TexTemplate(tex_compiler="xelatex", output_format=".xdv")
    template.add_to_preamble(r"\usepackage{amsmath,amssymb}")
    template.add_to_preamble(r"\usepackage{xeCJK}")
    template.add_to_preamble(
        r"\IfFontExistsTF{" + font_family + r"}"
        r"{\setCJKmainfont{" + font_family + r"}}"
        r"{"
        r"\IfFontExistsTF{PingFang SC}{\setCJKmainfont{PingFang SC}}{"
        r"\IfFontExistsTF{Songti SC}{\setCJKmainfont{Songti SC}}{"
        r"\IfFontExistsTF{Noto Sans CJK SC}{\setCJKmainfont{Noto Sans CJK SC}}{"
        r"\setCJKmainfont{FandolSong-Regular}"
        r"}}}"
        r"}"
    )
    return template


def _ensure_xelatex_installed() -> None:
    if shutil.which("xelatex") is None:
        raise RuntimeError(
            "xelatex is required for Chinese LaTeX. "
            "Please install TeX first, e.g. `brew install --cask mactex-no-gui`, "
            "then ensure your CJK font (default: Noto Sans CJK SC) is installed."
        )


def create_chinese_formula(
    latex_text: str,
    *,
    font_size: int = 52,
    color=WHITE,
    cjk_font: str = "PingFang SC",
) -> Tex:
    """
    Render Chinese + formula text through `Tex` with XeLaTeX.

    Example:
        create_chinese_formula(r"设函数为：$f(x)=x^2+1$")
    """
    _ensure_xelatex_installed()
    template = build_chinese_tex_template(cjk_font)
    return Tex(
        latex_text,
        tex_template=template,
        font_size=font_size,
        color=color,
    )


def create_math_formula(
    expression: str,
    *,
    font_size: int = 56,
    color=WHITE,
) -> MathTex:
    """
    Fast path for pure math formulas (without Chinese text).
    """
    return MathTex(expression, font_size=font_size, color=color)
