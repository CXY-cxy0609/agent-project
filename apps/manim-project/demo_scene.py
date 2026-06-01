"""Electrolysis of water lesson demo scene (under 3 minutes)."""

from __future__ import annotations

import sys
from pathlib import Path

from manim import (
    Arrow,
    BLUE,
    Circle,
    Create,
    DOWN,
    FadeIn,
    Flash,
    GREEN,
    Indicate,
    LEFT,
    Line,
    ORANGE,
    RED,
    Rectangle,
    RIGHT,
    ShowPassingFlash,
    Text,
    UP,
    VGroup,
    YELLOW,
    there_and_back,
)

from BaseScene import BaseScene

FORMULA_TOOL_DIR = Path(__file__).resolve().parent / "function-tools"
if str(FORMULA_TOOL_DIR) not in sys.path:
    sys.path.append(str(FORMULA_TOOL_DIR))

from create_formula import create_math_formula


class LessonPageDemo(BaseScene):
    """A compact electrolysis-of-water lesson based on BaseScene."""

    show_layout_guides = False
    subtitle_rect_down_shift = 0.12
    content_subtitle_gap = 0.16

    def construct(self) -> None:
        total_pages = 5

        self._page_1_intro(total_pages)
        self._page_2_device_and_reaction(total_pages)
        self._page_3_charge_transfer(total_pages)
        self._page_4_key_factors(total_pages)
        self._page_5_summary(total_pages)

    def _page_1_intro(self, total_pages: int) -> None:
        self.start_page(layout="center", transition=False)
        self.set_title("电解水原理三分钟速学")
        self.set_subtitle("装置、反应、电子与离子迁移")
        self.set_page_number(1, total_pages)

        self.add_text("电解水：用直流电把水分解为氢气和氧气。", font_size=33)
        self.add_text("阴极产氢，阳极产氧，体积比约为 2:1。", font_size=33)
        self.add_text("它是绿氢技术与储能体系的重要基础。", font_size=33)

        lines = [
            "这一节我们用三分钟，讲清电解水的核心机制。",
            "简单说，就是给水分子输入电能，把它拆成氢气和氧气。",
            "你只要记住三个关键词：电极反应、电子流动、离子迁移。",
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.08)

    def _page_2_device_and_reaction(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:2")
        self.set_title("1) 装置与总反应")
        self.set_subtitle("电源 + 两个电极 + 电解液")
        self.set_page_number(2, total_pages)

        self.create_parent(
            "left_notes",
            side="left",
            width_ratio=0.92,
            height_ratio=0.95,
            align="left",
            overflow="auto",
        )
        self.create_parent(
            "right_canvas",
            side="right",
            width_ratio=0.98,
            height_ratio=0.95,
            align="center",
            overflow="scale",
        )

        self.add_text("直流电源提供能量", parent="left_notes", font_size=30)
        self.add_text("阴极(-): 2H2O + 2e- -> H2 + 2OH-", parent="left_notes", font_size=30)
        self.add_text("阳极(+): 4OH- -> O2 + 2H2O + 4e-", parent="left_notes", font_size=30)
        self.add_text("总反应: 2H2O -> 2H2 + O2", parent="left_notes", font_size=30)

        tank = Rectangle(width=5.6, height=2.8, color=BLUE, stroke_opacity=0.7)
        water_line = Line(tank.get_left() + UP * 0.35, tank.get_right() + UP * 0.35, color=BLUE)
        cathode = Line(tank.get_left() + RIGHT * 1.4 + UP * 1.0, tank.get_left() + RIGHT * 1.4 + DOWN * 1.0, color=GREEN)
        anode = Line(tank.get_right() + LEFT * 1.4 + UP * 1.0, tank.get_right() + LEFT * 1.4 + DOWN * 1.0, color=ORANGE)
        neg_label = Text("阴极(-)", font=self.default_font, font_size=24, color=GREEN).next_to(cathode, DOWN, buff=0.15)
        pos_label = Text("阳极(+)", font=self.default_font, font_size=24, color=ORANGE).next_to(anode, DOWN, buff=0.15)

        h2_bubbles = VGroup(
            Circle(radius=0.06, color=GREEN),
            Circle(radius=0.05, color=GREEN),
            Circle(radius=0.04, color=GREEN),
        ).arrange(UP, buff=0.08).next_to(cathode, UP, buff=0.1)
        o2_bubbles = VGroup(
            Circle(radius=0.05, color=ORANGE),
            Circle(radius=0.04, color=ORANGE),
        ).arrange(UP, buff=0.08).next_to(anode, UP, buff=0.1)

        reaction = create_math_formula(
            r"2H_2O \rightarrow 2H_2 + O_2",
            font_size=48,
        ).scale(0.85).next_to(tank, UP, buff=0.28)
        visual_group = VGroup(tank, water_line, cathode, anode, neg_label, pos_label, h2_bubbles, o2_bubbles, reaction)
        self.add_animation(
            visual_group,
            parent="right_canvas",
            animation=Create(tank),
            animate=True,
            run_time=0.9,
        )
        self.add_animation(
            visual_group,
            animation=[Create(cathode), Create(anode)],
            animate=True,
            run_time=0.9,
        )
        self.add_animation(
            visual_group,
            animation=[Create(water_line), FadeIn(neg_label), FadeIn(pos_label)],
            animate=True,
            run_time=0.7,
        )
        self.add_animation(
            h2_bubbles,
            animation=[FadeIn(h2_bubbles), FadeIn(o2_bubbles), FadeIn(reaction)],
            animate=True,
            run_time=0.9,
        )
        self.add_animation(
            visual_group,
            animation=[
                h2_bubbles.animate.shift(UP * 0.08),
                o2_bubbles.animate.shift(UP * 0.06),
            ],
            animate=True,
            run_time=0.55,
            play_kwargs={"rate_func": there_and_back},
        )
        self.add_animation(
            visual_group,
            animation=[
                Indicate(reaction, color=YELLOW, scale_factor=1.04),
                Flash(cathode.get_top(), color=GREEN, flash_radius=0.18),
                Flash(anode.get_top(), color=ORANGE, flash_radius=0.18),
            ],
            animate=True,
            run_time=0.75,
        )

        lines = [
            "标准装置包括直流电源、两个电极和导电介质。",
            "阴极得到电子并放出氢气，阳极失去电子并放出氧气。",
            "总反应可以写成二个水分子分解为二个氢分子和一个氧分子。",
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.08)

    def _page_3_charge_transfer(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:2")
        self.set_title("2) 电子和离子怎么走")
        self.set_subtitle("外电路走电子，电解液走离子")
        self.set_page_number(3, total_pages)

        self.create_parent(
            "left_notes",
            side="left",
            width_ratio=0.92,
            height_ratio=0.95,
            align="left",
            overflow="auto",
        )
        self.create_parent(
            "right_canvas",
            side="right",
            width_ratio=0.98,
            height_ratio=0.95,
            align="center",
            overflow="scale",
        )

        self.add_text("电子: 阳极 -> 电源 -> 阴极", parent="left_notes", font_size=30)
        self.add_text("OH- 在液相迁移到阳极参与放氧", parent="left_notes", font_size=30)
        self.add_text("H+ / H2O 在阴极附近得电子产氢", parent="left_notes", font_size=30)
        self.add_text("电子与离子闭合回路，反应持续进行", parent="left_notes", font_size=30)

        cell = Rectangle(width=5.6, height=2.8, color=BLUE, stroke_opacity=0.7)
        cth = Line(cell.get_left() + RIGHT * 1.3 + UP * 1.0, cell.get_left() + RIGHT * 1.3 + DOWN * 1.0, color=GREEN)
        ano = Line(cell.get_right() + LEFT * 1.3 + UP * 1.0, cell.get_right() + LEFT * 1.3 + DOWN * 1.0, color=ORANGE)
        e_arrow = Arrow(ano.get_top() + UP * 0.6 + LEFT * 0.2, cth.get_top() + UP * 0.6 + RIGHT * 0.2, buff=0.1, color=YELLOW)
        ion_arrow_1 = Arrow(cth.get_bottom() + RIGHT * 0.2, ano.get_bottom() + LEFT * 0.2, buff=0.1, color=BLUE)
        ion_arrow_2 = Arrow(ano.get_bottom() + LEFT * 0.2, cth.get_bottom() + RIGHT * 0.2, buff=0.1, color=RED)
        e_label = Text("电子流", font=self.default_font, font_size=24, color=YELLOW).next_to(e_arrow, UP, buff=0.1)
        ion_label = Text("离子迁移", font=self.default_font, font_size=24, color=BLUE).next_to(ion_arrow_1, DOWN, buff=0.12)

        flow_group = VGroup(cell, cth, ano, e_arrow, ion_arrow_1, ion_arrow_2, e_label, ion_label)
        self.add_animation(
            flow_group,
            parent="right_canvas",
            animation=[Create(cell), Create(cth), Create(ano)],
            animate=True,
            run_time=1.0,
        )
        self.add_animation(flow_group, animation=[Create(e_arrow), FadeIn(e_label)], animate=True, run_time=0.8)
        self.add_animation(
            flow_group,
            animation=[Create(ion_arrow_1), Create(ion_arrow_2), FadeIn(ion_label)],
            animate=True,
            run_time=0.9,
        )
        self.add_animation(
            e_arrow,
            animation=[e_arrow.animate.shift(RIGHT * 0.25), ion_arrow_1.animate.shift(LEFT * 0.2)],
            animate=True,
            run_time=0.8,
        )
        self.add_animation(
            e_arrow,
            animation=[e_arrow.animate.shift(LEFT * 0.25), ion_arrow_1.animate.shift(RIGHT * 0.2)],
            animate=True,
            run_time=0.8,
        )
        self.add_animation(
            flow_group,
            animation=[
                ShowPassingFlash(e_arrow.copy().set_color(YELLOW), time_width=0.35),
                ShowPassingFlash(ion_arrow_1.copy().set_color(BLUE), time_width=0.35),
                ShowPassingFlash(ion_arrow_2.copy().set_color(RED), time_width=0.35),
            ],
            animate=True,
            run_time=0.9,
        )
        self.add_animation(
            flow_group,
            animation=[Indicate(e_label, color=YELLOW), Indicate(ion_label, color=BLUE)],
            animate=True,
            run_time=0.55,
        )

        lines = [
            "外电路中，电子从阳极回到阴极，这是电流闭环的一部分。",
            "电解液内部不能走电子，主要通过离子迁移来传导电荷。",
            "电子通道和离子通道同时成立，电解反应才会持续发生。",
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.08)

    def _page_4_key_factors(self, total_pages: int) -> None:
        self.next_page(layout="center")
        self.set_title("3) 影响效率的关键因素")
        self.set_subtitle("电压、电极材料、温度与气泡覆盖")
        self.set_page_number(4, total_pages)

        self.add_text("理想分解电压约 1.23V，实际需要更高。", font_size=31)
        self.add_text("催化剂可降低过电位，提高产气效率。", font_size=31)
        self.add_text("温度和电解液浓度会影响导电性。", font_size=31)
        self.add_text("气泡附着过多会抬高阻抗，降低效率。", font_size=31)

        formula_1 = create_math_formula(r"Q = I t", font_size=50).scale(0.9).shift(UP * 0.1)
        formula_2 = create_math_formula(r"n = \frac{I t}{z F}", font_size=50).scale(0.9).next_to(formula_1, DOWN, buff=0.35)
        formula_group = VGroup(formula_1, formula_2).shift(DOWN * 1.0)
        self.add_animation(formula_group, animation=FadeIn(formula_group), animate=True, run_time=0.8)
        self.add_animation(
            formula_group,
            animation=[Indicate(formula_1, color=YELLOW), Indicate(formula_2, color=YELLOW)],
            animate=True,
            run_time=0.75,
        )

        lines = [
            "实际电解槽电压通常高于一 point 二三伏，因为存在过电位和欧姆损耗。",
            "根据法拉第定律，通电量越大，理论产气量越高。",
            "工程上要通过材料和结构设计，把电耗降下来，把产氢效率提上去。",
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.08)

    def _page_5_summary(self, total_pages: int) -> None:
        self.next_page(layout="center")
        self.set_title("4) 小结与应用")
        self.set_subtitle("从原理到场景")
        self.set_page_number(5, total_pages)

        self.add_text("原理: 电能驱动氧化还原，把水拆成氢和氧。", font_size=31)
        self.add_text("结构: 电极 + 隔膜/电解液 + 电源 + 流道。", font_size=31)
        self.add_text("应用: 绿氢制备、储能调峰、化工原料供给。", font_size=31)
        self.add_text("核心目标: 更低电耗、更高效率、更长寿命。", font_size=31)

        lines = [
            "现在你可以用一句话概括电解水。",
            "它本质上是把电能转成氢气化学能的过程。",
            "理解了反应路径和损耗来源，就抓住了电解槽优化的核心。",
            "到这里，电解水原理的三分钟讲解就完成了。",
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.08)
