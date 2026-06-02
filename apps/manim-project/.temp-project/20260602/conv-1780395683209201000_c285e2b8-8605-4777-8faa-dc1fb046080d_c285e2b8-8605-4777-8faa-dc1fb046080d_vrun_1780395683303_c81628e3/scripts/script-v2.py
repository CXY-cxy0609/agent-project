from __future__ import annotations

import sys
from pathlib import Path
import numpy as np

from manim import (
    VGroup,
    Circle,
    Rectangle,
    Line,
    Text,
    FadeIn,
    Create,
    Indicate,
    GrowFromCenter,
    UP,
    DOWN,
    LEFT,
    RIGHT,
    ORIGIN,
    YELLOW,
    BLUE,
    RED,
    WHITE,
    GRAY,
    LIGHT_GRAY,
    ORANGE,
    PINK,
    BROWN,
    Write,
    ShowPassingFlash,
    Transform,
    Polygon,
    RoundedRectangle,
    rate_functions,
)

BASE_DIR = Path(__file__).resolve().parents[4]
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))
if str(BASE_DIR / "function-tools") not in sys.path:
    sys.path.append(str(BASE_DIR / "function-tools"))

from BaseScene import BaseScene
from create_formula import create_chinese_formula


class ElectrolysisOfWaterScene(BaseScene):
    show_layout_guides = False
    subtitle_rect_down_shift = 0.12

    def construct(self) -> None:
        total_pages = 4
        self._page_0(total_pages)
        self._page_1(total_pages)
        self._page_2(total_pages)
        self._page_3(total_pages)

    def _page_0(self, total_pages: int) -> None:
        self.start_page(layout="left_right", column_ratio="1:1", transition=False)
        self.set_title("电解水实验装置展示")
        self.set_page_number(1, total_pages)

        left_parent = self.create_parent("left_device", side="left", show_boundary=False)

        water_trough = Rectangle(width=3.2, height=1.8, color=LIGHT_GRAY, fill_opacity=0.3, stroke_width=2).move_to(left_parent.get_center() + DOWN * 0.8)
        left_tube = Rectangle(width=0.8, height=3.0, color=BLUE, fill_opacity=0.2, stroke_width=2).move_to(water_trough.get_top() + UP * 1.5 + LEFT * 1.0)
        right_tube = Rectangle(width=0.8, height=3.0, color=BLUE, fill_opacity=0.2, stroke_width=2).move_to(water_trough.get_top() + UP * 1.5 + RIGHT * 1.0)
        connect_tube = Rectangle(width=2.8, height=0.4, color=BLUE, fill_opacity=0.2, stroke_width=2).move_to(water_trough.get_top() + UP * 0.2)
        left_electrode = Line(start=left_tube.get_bottom() + UP * 0.1, end=left_tube.get_top() + DOWN * 0.5, color=GRAY, stroke_width=3)
        right_electrode = Line(start=right_tube.get_bottom() + UP * 0.1, end=right_tube.get_top() + DOWN * 0.5, color=GRAY, stroke_width=3)
        power_supply = RoundedRectangle(width=2.0, height=1.0, corner_radius=0.2, color=YELLOW, fill_opacity=0.5, stroke_width=2).move_to(left_parent.get_center() + UP * 2.2)
        power_plus = Text("+", font_size=36, color=RED).move_to(power_supply.get_center() + LEFT * 0.6)
        power_minus = Text("-", font_size=36, color=BLUE).move_to(power_supply.get_center() + RIGHT * 0.6)
        wire_left = Line(start=power_supply.get_bottom() + LEFT * 0.6, end=left_electrode.get_top(), color=GRAY, stroke_width=2)
        wire_right = Line(start=power_supply.get_bottom() + RIGHT * 0.6, end=right_electrode.get_top(), color=GRAY, stroke_width=2)
        left_liquid = Rectangle(width=0.7, height=2.0, color=BLUE, fill_opacity=0.6).move_to(left_tube.get_bottom() + UP * 1.0)
        right_liquid = Rectangle(width=0.7, height=2.0, color=BLUE, fill_opacity=0.6).move_to(right_tube.get_bottom() + UP * 1.0)
        label_positive = Text("正极", font_size=20, color=RED).next_to(left_electrode, LEFT, buff=0.1)
        label_negative = Text("负极", font_size=20, color=BLUE).next_to(right_electrode, RIGHT, buff=0.1)
        label_left_tube = Text("玻璃刻度管", font_size=18, color=WHITE).next_to(left_tube, LEFT, buff=0.2)
        label_right_tube = Text("玻璃刻度管", font_size=18, color=WHITE).next_to(right_tube, RIGHT, buff=0.2)
        label_trough = Text("水槽", font_size=18, color=WHITE).next_to(water_trough, DOWN, buff=0.1)
        label_power = Text("直流电源", font_size=18, color=WHITE).next_to(power_supply, UP, buff=0.1)

        device_group = VGroup(
            water_trough, left_tube, right_tube, connect_tube,
            left_electrode, right_electrode,
            power_supply, power_plus, power_minus,
            wire_left, wire_right,
            left_liquid, right_liquid,
            label_positive, label_negative, label_left_tube, label_right_tube, label_trough, label_power
        )

        self.add_animation(device_group, animation=FadeIn(device_group), parent=left_parent, run_time=3.0)

        self.wait(0.5)
        self.add_animation(label_positive, animation=Indicate(label_positive, color=YELLOW), parent=left_parent, run_time=2.0)
        self.wait(2.0)
        self.add_animation(label_negative, animation=Indicate(label_negative, color=YELLOW), parent=left_parent, run_time=2.0)
        self.wait(2.0)
        self.add_animation(VGroup(left_liquid, right_liquid), animation=Indicate(VGroup(left_liquid, right_liquid), color=YELLOW), parent=left_parent, run_time=2.0)
        self.wait(2.0)

        right_parent = self.create_parent("right_content", side="right", show_boundary=False)
        right_title = Text("电解水实验装置", font_size=32, color=WHITE, weight="bold").move_to(right_parent.get_center() + UP * 2.0)
        self.add_animation(right_title, animation=FadeIn(right_title), parent=right_parent, run_time=0.5)
        self.wait(1.0)

        right_text1 = Text("1 正极连接阳极", font_size=26, color=WHITE).next_to(right_title, DOWN, buff=0.5)
        self.add_animation(right_text1, animation=GrowFromCenter(right_text1), parent=right_parent, run_time=0.8)
        self.wait(1.0)

        right_text2 = Text("2 负极连接阴极", font_size=26, color=WHITE).next_to(right_text1, DOWN, buff=0.3)
        self.add_animation(right_text2, animation=GrowFromCenter(right_text2), parent=right_parent, run_time=0.8)
        self.wait(1.0)

        right_text3 = Text("3 容器内为添加少量硫酸钠的纯水", font_size=26, color=WHITE).next_to(right_text2, DOWN, buff=0.3)
        self.add_animation(right_text3, animation=GrowFromCenter(right_text3), parent=right_parent, run_time=0.8)
        self.wait(2.0)

        lines = [
            "今天我们来学习电解水的原理",
            "首先认识电解水的实验装置",
            "左侧连正极做阳极右侧连负极做阴极",
            "水中加硫酸钠增强导电性"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(2.0)

    def _page_1(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1", transition=True)
        self.set_title("通电后的实验现象")
        self.set_page_number(2, total_pages)

        left_parent = self.create_parent("left_device_2", side="left", show_boundary=False)

        water_trough = Rectangle(width=3.2, height=1.8, color=LIGHT_GRAY, fill_opacity=0.3, stroke_width=2).move_to(left_parent.get_center() + DOWN * 0.8)
        left_tube = Rectangle(width=0.8, height=3.0, color=BLUE, fill_opacity=0.2, stroke_width=2).move_to(water_trough.get_top() + UP * 1.5 + LEFT * 1.0)
        right_tube = Rectangle(width=0.8, height=3.0, color=BLUE, fill_opacity=0.2, stroke_width=2).move_to(water_trough.get_top() + UP * 1.5 + RIGHT * 1.0)
        connect_tube = Rectangle(width=2.8, height=0.4, color=BLUE, fill_opacity=0.2, stroke_width=2).move_to(water_trough.get_top() + UP * 0.2)
        left_electrode = Line(start=left_tube.get_bottom() + UP * 0.1, end=left_tube.get_top() + DOWN * 0.5, color=GRAY, stroke_width=3)
        right_electrode = Line(start=right_tube.get_bottom() + UP * 0.1, end=right_tube.get_top() + DOWN * 0.5, color=GRAY, stroke_width=3)
        power_supply = RoundedRectangle(width=2.0, height=1.0, corner_radius=0.2, color=YELLOW, fill_opacity=0.8, stroke_width=2).move_to(left_parent.get_center() + UP * 2.2)
        power_plus = Text("+", font_size=36, color=RED).move_to(power_supply.get_center() + LEFT * 0.6)
        power_minus = Text("-", font_size=36, color=BLUE).move_to(power_supply.get_center() + RIGHT * 0.6)
        wire_left = Line(start=power_supply.get_bottom() + LEFT * 0.6, end=left_electrode.get_top(), color=GRAY, stroke_width=2)
        wire_right = Line(start=power_supply.get_bottom() + RIGHT * 0.6, end=right_electrode.get_top(), color=GRAY, stroke_width=2)
        left_liquid = Rectangle(width=0.7, height=2.0, color=BLUE, fill_opacity=0.6).move_to(left_tube.get_bottom() + UP * 1.0)
        right_liquid = Rectangle(width=0.7, height=2.0, color=BLUE, fill_opacity=0.6).move_to(right_tube.get_bottom() + UP * 1.0)

        device_group_2 = VGroup(
            water_trough, left_tube, right_tube, connect_tube,
            left_electrode, right_electrode,
            power_supply, power_plus, power_minus,
            wire_left, wire_right, left_liquid, right_liquid
        )
        self.add_animation(device_group_2, animation=FadeIn(device_group_2), parent=left_parent, run_time=1.0)

        flash = Circle(radius=0.3, color=YELLOW, fill_opacity=0.8).move_to(power_supply.get_center())
        self.add_animation(flash, animation=ShowPassingFlash(flash, time_width=0.5), parent=left_parent, run_time=2.0)

        left_liquid_target = Rectangle(width=0.7, height=1.5, color=BLUE, fill_opacity=0.6).move_to(left_tube.get_bottom() + UP * 0.75)
        right_liquid_target = Rectangle(width=0.7, height=1.0, color=BLUE, fill_opacity=0.6).move_to(right_tube.get_bottom() + UP * 0.5)
        self.add_animation(left_liquid, animation=Transform(left_liquid, left_liquid_target), parent=left_parent, run_time=15.0)
        self.add_animation(right_liquid, animation=Transform(right_liquid, right_liquid_target), parent=left_parent, run_time=15.0)

        for _ in range(5):
            bubble_l = Circle(radius=0.05, color=WHITE, fill_opacity=0.8).move_to(left_electrode.get_bottom() + np.random.uniform(-0.15, 0.15) * RIGHT)
            bubble_r = Circle(radius=0.05, color=WHITE, fill_opacity=0.8).move_to(right_electrode.get_bottom() + np.random.uniform(-0.15, 0.15) * RIGHT)
            self.add_animation(bubble_l, animation=bubble_l.animate.shift(UP * 2.5), parent=left_parent, run_time=3.0, rate_func=rate_functions.smooth)
            self.add_animation(bubble_r, animation=bubble_r.animate.shift(UP * 2.5), parent=left_parent, run_time=3.0, rate_func=rate_functions.smooth)
            self.wait(2.0)

        ratio_label = Text("正极气体体积:负极气体体积=1:2", font_size=20, color=YELLOW).move_to(left_parent.get_center() + DOWN * 2.2)
        self.add_animation(ratio_label, animation=GrowFromCenter(ratio_label), parent=left_parent, run_time=1.0)
        self.wait(1.0)

        right_parent = self.create_parent("right_content_2", side="right", show_boundary=False)
        right_title_2 = Text("实验现象", font_size=32, color=WHITE, weight="bold").move_to(right_parent.get_center() + UP * 2.0)
        self.add_animation(right_title_2, animation=FadeIn(right_title_2), parent=right_parent, run_time=0.5)
        self.wait(1.0)

        right_text1_2 = Text("1 两极均有气泡产生", font_size=26, color=WHITE).next_to(right_title_2, DOWN, buff=0.5)
        self.add_animation(right_text1_2, animation=GrowFromCenter(right_text1_2), parent=right_parent, run_time=0.8)
        self.wait(1.0)

        right_text2_2 = Text("2 正负极气体体积比为1:2", font_size=26, color=WHITE).next_to(right_text1_2, DOWN, buff=0.3)
        self.add_animation(right_text2_2, animation=GrowFromCenter(right_text2_2), parent=right_parent, run_time=0.8)
        self.wait(3.0)

        lines = [
            "接通直流电源后两极都产生气泡",
            "正极气体体积比负极为1比2",
            "这两种气体分别是什么呢"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(3.0)

    def _page_2(self, total_pages: int) -> None:
        self.next_page(layout="center", transition=True)
        self.set_title("微观反应过程解析")
        self.set_page_number(3, total_pages)

        anode_label = Text("阳极（+）", font_size=28, color=RED).to_corner(UL, buff=0.5)
        cathode_label = Text("阴极（-）", font_size=28, color=BLUE).to_corner(UR, buff=0.5)
        self.add_animation(VGroup(anode_label, cathode_label), animation=FadeIn(VGroup(anode_label, cathode_label)), run_time=1.0)

        water_molecules = []
        for i in range(6):
            o = Circle(radius=0.2, color=RED, fill_opacity=0.8)
            h1 = Circle(radius=0.12, color=WHITE, fill_opacity=0.8).next_to(o, DOWN+LEFT, buff=0.05)
            h2 = Circle(radius=0.12, color=WHITE, fill_opacity=0.8).next_to(o, DOWN+RIGHT, buff=0.05)
            water = VGroup(o, h1, h2)
            water.move_to(np.array([np.random.uniform(-2.5, 2.5), np.random.uniform(-1.5, 1.0), 0]))
            water_label = Text("H₂O", font_size=16, color=WHITE).next_to(water, UP, buff=0.05)
            water_group = VGroup(water, water_label)
            water_molecules.append(water_group)
        self.add_animation(VGroup(*water_molecules), animation=FadeIn(VGroup(*water_molecules)), run_time=3.0)

        power_text = Text("通电", font_size=32, color=YELLOW).to_edge(UP, buff=0.8)
        self.add_animation(power_text, animation=FadeIn(power_text), run_time=0.5)
        self.wait(1.0)
        self.add_animation(power_text, animation=Indicate(power_text, color=YELLOW), run_time=1.0)
        self.wait(1.0)

        w1 = water_molecules[0]
        w1_o = w1[0][0]
        w1_h1 = w1[0][1]
        w1_h2 = w1[0][2]
        w1_label = w1[1]
        self.add_animation(w1_label, animation=FadeOut(w1_label), run_time=0.5)
        self.add_animation(w1_o, animation=w1_o.animate.move_to(LEFT * 3.0), run_time=2.0)
        self.add_animation(w1_h1, animation=w1_h1.animate.move_to(RIGHT * 2.0), run_time=2.0)
        self.add_animation(w1_h2, animation=w1_h2.animate.move_to(RIGHT * 2.5), run_time=2.0)

        w2 = water_molecules[1]
        w2_o = w2[0][0]
        w2_h1 = w2[0][1]
        w2_h2 = w2[0][2]
        w2_label = w2[1]
        self.add_animation(w2_label, animation=FadeOut(w2_label), run_time=0.5)
        self.add_animation(w2_o, animation=w2_o.animate.move_to(LEFT * 2.5), run_time=2.0)
        self.add_animation(w2_h1, animation=w2_h1.animate.move_to(RIGHT * 3.0), run_time=2.0)
        self.add_animation(w2_h2, animation=w2_h2.animate.move_to(RIGHT * 3.5), run_time=2.0)

        h2_1 = VGroup(w1_h1, w1_h2).arrange(RIGHT, buff=0.05)
        h2_label1 = Text("H₂", font_size=18, color=WHITE).next_to(h2_1, UP, buff=0.05)
        self.add_animation(h2_1, animation=h2_1.animate.arrange(RIGHT, buff=0.05), run_time=1.0)
        self.add_animation(h2_label1, animation=FadeIn(h2_label1), run_time=0.5)
        self.add_animation(VGroup(h2_1, h2_label1), animation=VGroup(h2_1, h2_label1).animate.shift(RIGHT * 1.0), run_time=2.0)

        o2_1 = VGroup(w1_o, w2_o).arrange(RIGHT, buff=0.1)
        o2_label1 = Text("O₂", font_size=18, color=WHITE).next_to(o2_1, UP, buff=0.05)
        self.add_animation(o2_1, animation=o2_1.animate.arrange(RIGHT, buff=0.1), run_time=1.0)
        self.add_animation(o2_label1, animation=FadeIn(o2_label1), run_time=0.5)
        self.add_animation(VGroup(o2_1, o2_label1), animation=VGroup(o2_1, o2_label1).animate.shift(LEFT * 1.0), run_time=2.0)

        w3 = water_molecules[2]
        w3_o = w3[0][0]
        w3_h1 = w3[0][1]
        w3_h2 = w3[0][2]
        w3_label = w3[1]
        self.add_animation(w3_label, animation=FadeOut(w3_label), run_time=0.5)
        self.add_animation(w3_o, animation=w3_o.animate.move_to(LEFT * 3.5), run_time=2.0)
        self.add_animation(w3_h1, animation=w3_h1.animate.move_to(RIGHT * 4.0), run_time=2.0)
        self.add_animation(w3_h2, animation=w3_h2.animate.move_to(RIGHT * 4.5), run_time=2.0)

        w4 = water_molecules[3]
        w4_o = w4[0][0]
        w4_h1 = w4[0][1]
        w4_h2 = w4[0][2]
        w4_label = w4[1]
        self.add_animation(w4_label, animation=FadeOut(w4_label), run_time=0.5)
        self.add_animation(w4_o, animation=w4_o.animate.move_to(LEFT * 4.0), run_time=2.0)
        self.add_animation(w4_h1, animation=w4_h1.animate.move_to(RIGHT * 5.0), run_time=2.0)
        self.add_animation(w4_h2, animation=w4_h2.animate.move_to(RIGHT * 5.5), run_time=2.0)

        h2_2 = VGroup(w3_h1, w3_h2).arrange(RIGHT, buff=0.05)
        h2_label2 = Text("H₂", font_size=18, color=WHITE).next_to(h2_2, UP, buff=0.05)
        self.add_animation(h2_2, animation=h2_2.animate.arrange(RIGHT, buff=0.05), run_time=1.0)
        self.add_animation(h2_label2, animation=FadeIn(h2_label2), run_time=0.5)
        self.add_animation(VGroup(h2_2, h2_label2), animation=VGroup(h2_2, h2_label2).animate.shift(RIGHT * 1.0), run_time=2.0)

        o2_2 = VGroup(w3_o, w4_o).arrange(RIGHT, buff=0.1)
        o2_label2 = Text("O₂", font_size=18, color=WHITE).next_to(o2_2, UP, buff=0.05)
        self.add_animation(o2_2, animation=o2_2.animate.arrange(RIGHT, buff=0.1), run_time=1.0)
        self.add_animation(o2_label2, animation=FadeIn(o2_label2), run_time=0.5)
        self.add_animation(VGroup(o2_2, o2_label2), animation=VGroup(o2_2, o2_label2).animate.shift(LEFT * 1.0), run_time=2.0)

        equation = create_chinese_formula(r"2H_2O \stackrel{通电}{=\!=\!=} 2H_2\uparrow + O_2\uparrow", font_size=42, color=WHITE)
        equation.move_to(DOWN * 2.5)
        self.add_animation(equation, animation=FadeIn(equation), run_time=2.0)
        self.add_animation(equation, animation=equation.animate.scale(1.2), run_time=1.0)
        self.wait(6.0)

        lines = [
            "微观上通电后水分子分解为氢氧原子",
            "两个氢原子结合成氢分子聚集成氢气",
            "两个氧原子结合成氧分子聚集成氧气",
            "对应反应为2H₂O通电生成2H₂和O₂"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(2.0)

    def _page_3(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1", transition=True)
        self.set_title("气体检验与实验结论")
        self.set_page_number(4, total_pages)

        left_parent = self.create_parent("left_test", side="left", show_boundary=False)

        top_test_o2 = VGroup()
        o2_tube = Rectangle(width=1.0, height=2.0, color=LIGHT_GRAY, fill_opacity=0.3, stroke_width=2).move_to(left_parent.get_center() + UP * 1.2)
        o2_gas = Rectangle(width=0.9, height=1.0, color=LIGHT_GRAY, fill_opacity=0.1).move_to(o2_tube.get_top() + DOWN * 0.5)
        splint = Line(start=o2_tube.get_top() + UP * 0.8, end=o2_tube.get_center() + DOWN * 0.3, color=BROWN, stroke_width=3)
        spark = Circle(radius=0.15, color=YELLOW, fill_opacity=0.8).move_to(splint.get_end())
        glow = Circle(radius=0.4, color=ORANGE, fill_opacity=0.4).move_to(spark.get_center())
        label_o2_test = Text("氧气 助燃", font_size=20, color=WHITE).next_to(o2_tube, RIGHT, buff=0.2)
        top_test_o2.add(o2_tube, o2_gas, splint, spark, glow, label_o2_test)

        self.add_animation(top_test_o2, animation=FadeIn(top_test_o2), parent=left_parent, run_time=3.0)
        self.add_animation(glow, animation=Indicate(glow, color=YELLOW), parent=left_parent, run_time=2.0)
        self.wait(2.0)

        bottom_test_h2 = VGroup()
        h2_tube = Rectangle(width=1.0, height=2.0, color=LIGHT_GRAY, fill_opacity=0.3, stroke_width=2).move_to(left_parent.get_center() + DOWN * 1.8)
        h2_gas = Rectangle(width=0.9, height=1.5, color=LIGHT_GRAY, fill_opacity=0.1).move_to(h2_tube.get_top() + DOWN * 0.75)
        flame = Polygon(
            h2_tube.get_top() + UP * 0.05,
            h2_tube.get_top() + LEFT * 0.2 + UP * 0.6,
            h2_tube.get_top() + RIGHT * 0.2 + UP * 0.6,
            color=PINK, fill_opacity=0.7
        )
        label_h2_test = Text("氢气 可燃", font_size=20, color=WHITE).next_to(h2_tube, RIGHT, buff=0.2)
        bottom_test_h2.add(h2_tube, h2_gas, flame, label_h2_test)

        self.add_animation(bottom_test_h2, animation=FadeIn(bottom_test_h2), parent=left_parent, run_time=3.0)
        self.add_animation(flame, animation=Indicate(flame, color=PINK), parent=left_parent, run_time=2.0)
        self.wait(2.0)

        right_parent = self.create_parent("right_conclusion", side="right", show_boundary=False)
        right_title_3 = Text("实验结论", font_size=32, color=WHITE, weight="bold").move_to(right_parent.get_center() + UP * 2.0)
        self.add_animation(right_title_3, animation=FadeIn(right_title_3), parent=right_parent, run_time=0.5)
        self.wait(1.0)

        right_text1_3 = Text("1 水由氢元素和氧元素组成", font_size=26, color=WHITE).next_to(right_title_3, DOWN, buff=0.5)
        self.add_animation(right_text1_3, animation=GrowFromCenter(right_text1_3), parent=right_parent, run_time=0.8)
        self.wait(1.0)

        right_text2_3 = Text("2 化学变化中分子可分原子不可分", font_size=26, color=WHITE).next_to(right_text1_3, DOWN, buff=0.3)
        self.add_animation(right_text2_3, animation=GrowFromCenter(right_text2_3), parent=right_parent, run_time=0.8)
        self.wait(1.0)

        right_text3_3 = Text("3 口诀：正氧负氢 氢二氧一", font_size=26, color=YELLOW).next_to(right_text2_3, DOWN, buff=0.3)
        right_text3_3.scale(1.1)
        self.add_animation(right_text3_3, animation=GrowFromCenter(right_text3_3), parent=right_parent, run_time=0.8)
        self.wait(5.0)

        lines = [
            "正极气体可使带火星木条复燃是氧气",
            "负极气体可燃烧产生淡蓝色火焰是氢气",
            "说明水由氢元素和氧元素组成",
            "可记口诀正氧负氢氢二氧一"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(5.0)
