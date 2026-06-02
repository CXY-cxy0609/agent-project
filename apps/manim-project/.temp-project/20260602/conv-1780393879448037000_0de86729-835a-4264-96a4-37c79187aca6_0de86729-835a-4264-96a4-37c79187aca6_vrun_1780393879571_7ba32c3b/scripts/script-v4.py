from __future__ import annotations

import sys
from pathlib import Path
import random
import numpy as np

from manim import (
    VGroup, Circle, Rectangle, Line, Text, FadeIn, Create, Write,
    Succession, AnimationGroup, FadeOut, ApplyMethod, UP, DOWN, LEFT, RIGHT,
    ORIGIN, YELLOW, BLUE, RED, GREEN, WHITE, GRAY, LIGHT_GRAY, BLUE_C,
    Indicate, TAU
)

BASE_DIR = Path(__file__).resolve().parents[4]
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))
if str(BASE_DIR / "function-tools") not in sys.path:
    sys.path.append(str(BASE_DIR / "function-tools"))

from BaseScene import BaseScene
from create_formula import create_math_formula


class ElectrolysisOfWaterScene(BaseScene):
    show_layout_guides = False
    subtitle_rect_down_shift = 0.12
    default_font = "PingFang SC"
    default_color = WHITE

    def construct(self) -> None:
        total_pages = 4
        self._page_1(total_pages)
        self._page_2(total_pages)
        self._page_3(total_pages)
        self._page_4(total_pages)

    def _page_1(self, total_pages: int) -> None:
        self.start_page(layout="left_right", column_ratio="1:1", transition=False)
        self.set_title("电解水实验装置展示")
        self.set_page_number(1, total_pages)

        # 右侧内容
        right_title = self.add_text("电解水实验", font_size=40, side="right", animate=False)
        self.add_animation(right_title, animation=FadeIn(right_title), run_time=1)

        right_desc = self.add_text("实验条件：直流电 水加少量电解质增强导电性", font_size=30, side="right", animate=False)
        self.add_animation(right_desc, animation=FadeIn(right_desc), run_time=1)

        # 左侧装置图
        left_container = self.create_parent(name="left_container", side="left", show_boundary=False)
        left_group = VGroup()

        # 电源
        power = VGroup(
            Rectangle(width=2, height=0.8, color=GRAY, fill_opacity=0.8),
            Text("+", font_size=32, color=RED).shift(RIGHT * 0.7),
            Text("-", font_size=32, color=BLUE).shift(LEFT * 0.7)
        )
        power.shift(UP * 2.5)
        left_group.add(power)

        # 导线
        wire_left = Line(power.get_left() + DOWN * 0.4, ORIGIN + LEFT * 2.5 + UP * 1.5, color=GRAY)
        wire_right = Line(power.get_right() + DOWN * 0.4, ORIGIN + RIGHT * 2.5 + UP * 1.5, color=GRAY)
        left_group.add(wire_left, wire_right)

        # 玻璃管
        tube_left = Rectangle(width=0.8, height=3, color=GRAY, fill_opacity=0.3).shift(LEFT * 2.5 + DOWN * 0.5)
        tube_right = tube_left.copy().shift(RIGHT * 5)
        left_group.add(tube_left, tube_right)

        # 刻度
        for i in range(1, 6):
            scale_left = Line(tube_left.get_left() + UP * 0.3 + UP * i * 0.5, tube_left.get_left() + UP * 0.3 + UP * i * 0.5 + RIGHT * 0.15, color=GRAY)
            scale_right = scale_left.copy().shift(RIGHT * 5)
            left_group.add(scale_left, scale_right)

        # 水槽
        tank = Rectangle(width=6, height=2, color=LIGHT_GRAY, fill_opacity=0.6).shift(DOWN * 2)
        water = Rectangle(width=5.8, height=1.8, color=BLUE_C, fill_opacity=0.4).move_to(tank.get_center())
        left_group.add(tank, water)

        # 标注
        label_power_pos = Text("电源正极", font_size=20, color=RED).next_to(power[1], RIGHT)
        label_power_neg = Text("电源负极", font_size=20, color=BLUE).next_to(power[2], LEFT)
        label_tube_pos = Text("正极管", font_size=20).next_to(tube_right, RIGHT)
        label_tube_neg = Text("负极管", font_size=20).next_to(tube_left, LEFT)
        label_water = Text("水", font_size=20).next_to(water, DOWN)
        labels = VGroup(label_power_pos, label_power_neg, label_tube_neg, label_tube_pos, label_water)

        left_group.move_to(left_container.get_center())
        labels.move_to(left_container.get_center())

        # 左侧淡入，标注依次弹出
        self.add_animation(left_group, animation=FadeIn(left_group), run_time=2, parent=left_container)
        self.add_animation(labels, animation=Succession(*[Create(label, run_time=0.5) for label in labels]), run_time=2.5, parent=left_container)

        # 字幕
        self.speak_with_subtitles([
            "同学们好今天我们学习电解水的原理",
            "首先来看电解水的实验装置",
            "我们需要用到直流电源和玻璃管",
            "水里加少量电解质增强导电性"
        ], subtitle_font_size=28, pause_between=0.1)

    def _page_2(self, total_pages: int) -> None:
        self.next_page(layout="center", transition=True)
        self.set_title("通电前后水分子运动变化")
        self.set_page_number(2, total_pages)

        # 创建水分子模型
        def create_water_molecule():
            o = Circle(radius=0.12, color=RED, fill_opacity=0.9)
            h1 = Circle(radius=0.08, color=WHITE, fill_opacity=0.9).shift(UP * 0.15 + LEFT * 0.12)
            h2 = h1.copy().shift(RIGHT * 0.24)
            bond1 = Line(o.get_center(), h1.get_center(), color=GRAY, stroke_width=2)
            bond2 = Line(o.get_center(), h2.get_center(), color=GRAY, stroke_width=2)
            return VGroup(o, h1, h2, bond1, bond2)

        # 12个水分子初始位置在四周
        water_molecules = VGroup()
        initial_positions = []
        target_positions = []
        for _ in range(12):
            mol = create_water_molecule()
            angle = random.uniform(0, TAU)
            dist = random.uniform(4, 5)
            initial_pos = ORIGIN + dist * np.cos(angle) * RIGHT + dist * np.sin(angle) * UP
            mol.move_to(initial_pos)
            initial_positions.append(initial_pos)
            target_pos = ORIGIN + random.uniform(-2, 2) * RIGHT + random.uniform(-2, 2) * UP
            target_positions.append(target_pos)
            water_molecules.add(mol)

        # 上方文字
        title_before = self.add_text("通电前：水分子无序运动", font_size=28, animate=False)
        title_before.to_edge(UP, buff=0.8)
        self.add_animation(title_before, animation=FadeIn(title_before), run_time=0.5)

        # 飞入动画
        fly_anims = [FadeIn(mol) for mol in water_molecules]
        self.add_animation(water_molecules, animation=AnimationGroup(*fly_anims, run_time=2.5), run_time=2.5)

        # 简单无序漂浮动画
        float_anims = []
        for _ in range(10):
            step_anims = []
            for mol in water_molecules:
                step_anims.append(ApplyMethod(mol.shift, RIGHT * random.uniform(-0.1, 0.1) + UP * random.uniform(-0.1, 0.1)))
            float_anims.append(AnimationGroup(*step_anims, run_time=0.3))
        self.add_animation(water_molecules, animation=Succession(*float_anims), run_time=3)

        # 电源符号淡入闪烁
        power_symbol = VGroup(
            Text("+", font_size=36, color=RED).to_edge(UP).shift(RIGHT * 1.5),
            Text("-", font_size=36, color=BLUE).to_edge(UP).shift(LEFT * 1.5),
            Line(LEFT * 1.5 + UP * 3.2, RIGHT * 1.5 + UP * 3.2, color=GRAY, stroke_width=3)
        )
        self.add_animation(power_symbol, animation=FadeIn(power_symbol), run_time=1)
        self.add_animation(power_symbol[:2], animation=Succession(
            AnimationGroup(*[Indicate(p, scale_factor=1.2, color=YELLOW) for p in power_symbol[:2]]),
            AnimationGroup(*[Indicate(p, scale_factor=1.2, color=YELLOW) for p in power_symbol[:2]]),
            run_time=1
        ), run_time=1)

        # 水分子朝向两极移动
        move_anims = []
        for i, mol in enumerate(water_molecules):
            target_x = random.uniform(-3, 3)
            target_y = random.uniform(-2, 2)
            move_anims.append(ApplyMethod(mol.move_to, ORIGIN + target_x * RIGHT + target_y * UP))
            move_anims.append(ApplyMethod(mol.rotate, random.uniform(-0.5, 0.5)))
        self.add_animation(water_molecules, animation=AnimationGroup(*move_anims, run_time=4), run_time=4)

        # 字幕
        self.speak_with_subtitles([
            "通电前水分子在做无序自由运动",
            "接通直流电后水分子受电场影响",
            "开始向电源的两极移动"
        ], subtitle_font_size=28, pause_between=0.1)

    def _page_3(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1", transition=True)
        self.set_title("两极反应过程演示")
        self.set_page_number(3, total_pages)

        # 左侧负极区域
        left_container = self.create_parent(name="left_container", side="left", show_boundary=False)
        left_title = Text("负极（阴极）反应", font_size=32, color=BLUE)
        left_title.move_to(left_container.get_top() + DOWN * 0.5)
        self.add_animation(left_title, animation=FadeIn(left_title), run_time=1, parent=left_container)

        neg_formula = create_math_formula(r"2H_2O + 2e^- = H_2 \uparrow + 2OH^-", font_size=36, color=BLUE)
        neg_formula.next_to(left_title, DOWN, buff=0.5)
        self.add_animation(neg_formula, animation=Write(neg_formula), run_time=3, parent=left_container)

        # 负极简单反应动画
        neg_mol = VGroup(
            Circle(radius=0.12, color=RED, fill_opacity=0.9),
            Circle(radius=0.08, color=WHITE, fill_opacity=0.9).shift(UP * 0.15 + LEFT * 0.12),
            Circle(radius=0.08, color=WHITE, fill_opacity=0.9).shift(UP * 0.15 + RIGHT * 0.12),
            Line(ORIGIN, UP * 0.15 + LEFT * 0.12, color=GRAY),
            Line(ORIGIN, UP * 0.15 + RIGHT * 0.12, color=GRAY)
        ).shift(neg_formula.get_right() + RIGHT * 0.8 + DOWN * 0.8)
        h2 = VGroup(
            Circle(radius=0.08, color=WHITE, fill_opacity=0.9),
            Circle(radius=0.08, color=WHITE, fill_opacity=0.9).shift(RIGHT * 0.12),
            Line(ORIGIN, RIGHT * 0.12, color=GRAY)
        ).move_to(neg_mol.get_center() + UP * 0.3)
        neg_reaction_group = VGroup(neg_mol, h2)
        neg_reaction_group.move_to(left_container.get_center() + DOWN * 0.5)
        self.add_animation(neg_mol, animation=FadeIn(neg_mol), run_time=1, parent=left_container)
        self.add_animation(neg_reaction_group, animation=Succession(
            FadeOut(neg_mol[3:]),
            FadeIn(h2),
            ApplyMethod(h2.shift, UP * 1.5),
            run_time=3
        ), run_time=3, parent=left_container)

        # 右侧正极区域
        right_container = self.create_parent(name="right_container", side="right", show_boundary=False)
        right_title = Text("正极（阳极）反应", font_size=32, color=RED)
        right_title.move_to(right_container.get_top() + DOWN * 0.5)
        self.add_animation(right_title, animation=FadeIn(right_title), run_time=1, parent=right_container)

        pos_formula = create_math_formula(r"2H_2O - 4e^- = O_2 \uparrow + 4H^+", font_size=36, color=RED)
        pos_formula.next_to(right_title, DOWN, buff=0.5)
        self.add_animation(pos_formula, animation=Write(pos_formula), run_time=3, parent=right_container)

        # 正极简单反应动画
        pos_mol = VGroup(
            Circle(radius=0.12, color=RED, fill_opacity=0.9),
            Circle(radius=0.08, color=WHITE, fill_opacity=0.9).shift(UP * 0.15 + LEFT * 0.12),
            Circle(radius=0.08, color=WHITE, fill_opacity=0.9).shift(UP * 0.15 + RIGHT * 0.12),
            Line(ORIGIN, UP * 0.15 + LEFT * 0.12, color=GRAY),
            Line(ORIGIN, UP * 0.15 + RIGHT * 0.12, color=GRAY)
        ).shift(pos_formula.get_left() + LEFT * 0.8 + DOWN * 0.8)
        o2 = VGroup(
            Circle(radius=0.12, color=RED, fill_opacity=0.9),
            Circle(radius=0.12, color=RED, fill_opacity=0.9).shift(RIGHT * 0.18),
            Line(ORIGIN, RIGHT * 0.18, color=GRAY, stroke_width=3)
        ).move_to(pos_mol.get_center() + UP * 0.3)
        pos_reaction_group = VGroup(pos_mol, o2)
        pos_reaction_group.move_to(right_container.get_center() + DOWN * 0.5)
        self.add_animation(pos_mol, animation=FadeIn(pos_mol), run_time=1, parent=right_container)
        self.add_animation(pos_reaction_group, animation=Succession(
            FadeOut(pos_mol[3:]),
            FadeIn(o2),
            ApplyMethod(o2.shift, UP * 1.5),
            run_time=3
        ), run_time=3, parent=right_container)

        # 体积比2:1
        ratio_label = Text("2:1", font_size=48, color=YELLOW)
        ratio_label.to_edge(DOWN).shift(UP * 0.8)
        self.add_animation(ratio_label, animation=ApplyMethod(ratio_label.scale, 1.5), run_time=1)
        self.add_animation(ratio_label, animation=ApplyMethod(ratio_label.scale, 1/1.5), run_time=0.5)

        # 字幕
        self.speak_with_subtitles([
            "负极水分子得到电子分解生成氢气",
            "正极水分子失去电子分解生成氧气",
            "生成氢气体积是氧气体积的两倍"
        ], subtitle_font_size=28, pause_between=0.1)

    def _page_4(self, total_pages: int) -> None:
        self.next_page(layout="center", transition=True)
        self.set_title("总反应与实验结论")
        self.set_page_number(4, total_pages)

        # 总反应公式
        total_formula = create_math_formula(r"2H_2O \xlongequal{通电} 2H_2 \uparrow + O_2 \uparrow", font_size=48, color=GREEN)
        self.add_animation(total_formula, animation=ApplyMethod(total_formula.scale, 1.3), run_time=2)
        self.add_animation(total_formula, animation=ApplyMethod(total_formula.scale, 1/1.3), run_time=0.5)

        # 三条结论
        conclusion_texts = [
            "1 水由氢元素和氧元素组成",
            "2 水分子中氢原子和氧原子个数比为2:1",
            "3 化学变化中分子可分原子不可分"
        ]
        conclusions = VGroup()
        for text in conclusion_texts:
            conc = Text(text, font_size=30)
            conclusions.add(conc)
        conclusions.arrange(DOWN, buff=0.5, aligned_edge=LEFT).next_to(total_formula, DOWN, buff=1)

        for i, conc in enumerate(conclusions):
            conc.shift(DOWN * 1)
            self.add_animation(conc, animation=ApplyMethod(conc.shift, UP * 1), run_time=1)
            if i < 2:
                self.wait(0.5)

        # 字幕
        self.speak_with_subtitles([
            "电解水总反应是水通电生成氢气和氧气",
            "水由氢元素和氧元素组成",
            "水分子中氢氧原子个数比为2比1",
            "化学变化中分子可分原子不可分"
        ], subtitle_font_size=28, pause_between=0.1)
