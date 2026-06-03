"""Formula helper for Chinese-friendly LaTeX rendering in Manim."""

from __future__ import annotations

import shutil
import re

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
    font_size: int = 32,
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
        _ensure_math_delimiters(latex_text),
        tex_template=template,
        font_size=font_size,
        color=color,
    )


def create_math_formula(
    expression: str,
    *,
    font_size: int = 32,
    color=WHITE,
) -> MathTex | Tex:
    r"""
    Render math formulas.

    Pure math uses Manim's faster MathTex path. Formulas containing CJK text,
    such as r"2H_2O \xrightarrow{\text{通电}} 2H_2 + O_2", automatically use
    the Chinese-friendly XeLaTeX template.
    """
    if _contains_cjk(expression):
        return create_chinese_formula(expression, font_size=font_size, color=color)
    return MathTex(expression, font_size=font_size, color=color)


def _ensure_math_delimiters(latex_text: str) -> str:
    """Wrap bare math expressions for Tex, which otherwise runs in text mode."""
    stripped = latex_text.strip()
    if "$" in stripped or r"\(" in stripped or r"\[" in stripped:
        return latex_text
    if _looks_like_math_expression(stripped):
        return f"${stripped}$"
    return latex_text


def _looks_like_math_expression(text: str) -> bool:
    math_markers = (
        "_",
        "^",
        r"\frac",
        r"\sqrt",
        r"\sum",
        r"\int",
        r"\stackrel",
        r"\rightarrow",
        r"\uparrow",
        r"\downarrow",
    )
    return any(marker in text for marker in math_markers) or bool(
        re.search(r"[A-Za-z]\s*[=+\-*/]\s*[A-Za-z0-9]", text)
    )


def _contains_cjk(text: str) -> bool:
    """Return True when text contains common CJK ideographs or punctuation."""
    return bool(
        re.search(
            r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]",
            text,
        )
    )
