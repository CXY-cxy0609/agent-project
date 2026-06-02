```python
from __future__ import annotations

import sys
from pathlib import Path

from manim import (
    VGroup, Circle, Rectangle, Text, Arrow, Triangle,
    FadeIn, FadeOut, Create, Indicate, Flash, MoveToTarget,
    Succession, Wait, Line, DashedLine, UP, DOWN,
    LEFT, RIGHT, ORIGIN, YELLOW, RED, BLUE, WHITE,
    GRAY, GREEN, PINK, ORANGE
)

BASE_DIR = Path(__file__).resolve().parents[4]
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))
if str(BASE_DIR / "function-tools") not in sys.path:
    sys.path.append(str(BASE_DIR / "function-tools"))

from BaseScene import BaseScene
from create_formula import create_math_formula, create_chinese_formula


class ElectrolysisOfWaterScene(BaseScene):
    show_layout_guides = False
    subtitle_rect_down_shift = 0.12
    two_column_ratio = "1:1"

    def construct(self) -> None:
        total_pages = 4
        self._page_1(total_pages)
        self._page_2(total_pages)
        self._page_3(total_pages)
        self._page_4(total_pages)

    def _page_1(self, total_pages: int) -> None:
        self.start_page(layout="left_right", transition=False)
        self.set_title("电解水实验装置介绍", font_size=32)
        self.set_page_number(1, total_pages)

        # 左侧装置图
        power_supply = VGroup()
        ps_body = Rectangle(width=2.0, height=1.0, color=GRAY, fill_opacity=0.8, stroke_width=3)
        ps_label = create_chinese_formula(r"直流电源 $12V$", font_size=24)
        ps_label.move_to(ps_body.get_center())
        ps_pos = Text("+", color=RED, font_size=30).next_to(ps_body, RIGHT, buff=0.1).shift(UP*0.3)
        ps_neg = Text("-", color=BLUE, font_size=30).next_to(ps_body, RIGHT, buff=0.1).shift(DOWN*0.3)
        power_supply.add(ps_body, ps_label, ps_pos, ps_neg)
        power_supply.shift(UP*1.5 + LEFT*1.5)

        pos_wire = Line(ps_pos.get_right(), UP*1.5 + RIGHT*0.5, color=RED, stroke_width=3)
        neg_wire = Line(ps_neg.get_right(), UP*1.5 + RIGHT*2.5, color=BLUE, stroke_width=3)
        pos_elec = DashedLine(pos_wire.get_end(), pos_wire.get_end() + DOWN*2.5, color=RED, stroke_width=3)
        neg_elec = DashedLine(neg_wire.get_end(), neg_wire.get_end() + DOWN*2.5, color=BLUE, stroke_width=3)
        wires = VGroup(pos_wire, neg_wire, pos_elec, neg_elec)

        tank = Rectangle(width=3.5, height=2.0, color=GRAY, fill_opacity=0.3, stroke_width=3)
        tank.shift(DOWN*0.5 + RIGHT*1.5)
        tank_label = create_math_formula("H_2O", font_size=28).next_to(tank, DOWN, buff=0.2)

        tube1 = Rectangle(width=0.8, height=2.2, color=WHITE, fill_opacity=0.2, stroke_width=2)
        tube1.move_to(pos_elec.get_center() + UP*0.1)
        tube2 = tube1.copy().move_to(neg_elec.get_center() + UP*0.1)
        tube1_water = Rectangle(width=0.7, height=1.8, color=BLUE, fill_opacity=0.4, stroke_width=0)
        tube1_water.move_to(tube1.get_bottom() + UP*0.9)
        tube2_water = tube1_water.copy()
        tube2_water.move_to(tube2.get_bottom() + UP*0.9)
        tubes = VGroup(tube1, tube2, tube1_water, tube2_water)

        pos_bubbles = VGroup(*[Circle(radius=0.08, color=RED, fill_opacity=0.6).move_to(pos_elec.get_bottom() + UP*0.1 + i*UP*0.3) for i in range(5)])
        neg_bubbles = VGroup(*[Circle(radius=0.08, color=BLUE, fill_opacity=0.6).move_to(neg_elec.get_bottom() + UP*0.1 + i*UP*0.3) for i in range(10)])
        for b in pos_bubbles + neg_bubbles:
            b.set_opacity(0)

        left_group = VGroup(power_supply, wires, tank, tank_label, tubes, pos_bubbles, neg_bubbles)
        left_group.to_edge(LEFT, buff=0.5)

        # 右侧文字
        right_title = Text("电解水实验装置", font_size=30, color=YELLOW)
        rt1 = create_chinese_formula(r"反应物 水($H_2O$)", font_size=26)
        rt2 = create_chinese_formula(r"条件 通直流电", font_size=26)
        rt3 = create_chinese_formula(r"两电极均有气泡产生", font_size=26)
        rt4 = create_chinese_formula(r"负极气体体积:正极气体体积=", font_size=26)
        rt_ratio = create_math_formula("2:1", font_size=32, color=RED).next_to(rt4, RIGHT, buff=0.1)
        right_group = VGroup(right_title, rt1, rt2, rt3, VGroup(rt4, rt_ratio)).arrange(DOWN, aligned_edge=LEFT, buff=0.3)
        right_group.to_edge(RIGHT, buff=0.5)

        self.add_animation(left_group, side="left", animation=FadeIn(left_group), run_time=2)
        self.add_animation(right_group[0], side="right", animation=FadeIn(right_group[0]), run_time=0.5)
        self.add_animation(right_group[1:], side="right", animation=FadeIn(right_group[1:]), run_time=1.5)

        self.add_animation(ps_pos, animation=Indicate(ps_pos, color=RED, scale_factor=1.5), run_time=1)
        self.add_animation(ps_neg, animation=Indicate(ps_neg, color=BLUE, scale_factor=1.5), run_time=1)

        self.add_animation(rt_ratio, animation=Indicate(rt_ratio, color=RED, scale_factor=1.5), run_time=4)
        for b in pos_bubbles:
            b.target = b.copy().shift(UP*2.0).set_opacity(0)
        self.add_animation(pos_bubbles, animation=[Succession(Wait(i*0.4), b.animate.set_opacity(0.6), MoveToTarget(b)) for i, b in enumerate(pos_bubbles)], run_time=4)
        for b in neg_bubbles:
            b.target = b.copy().shift(UP*2.0).set_opacity(0)
        self.add_animation(neg_bubbles, animation=[Succession(Wait(i*0.3), b.animate.set_opacity(0.6), MoveToTarget(b)) for i, b in enumerate(neg_bubbles)], run_time=4)

        lines = [
            "同学们好今天我们学习电解水原理",
            "首先来看电解水的实验装置",
            "通直流电后两电极都产生气泡",
            "负极气体体积是正极的两倍"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(12)

    def _page_2(self, total_pages: int) -> None:
        self.next_page(layout="center", transition=True)
        self.set_title("电解水微观反应过程", font_size=32)
        self.set_page_number(2, total_pages)

        def create_water(center=ORIGIN):
            o = Circle(radius=0.25, color=RED, fill_opacity=0.9).move_to(center)
            h1 = Circle(radius=0.15, color=WHITE, fill_opacity=0.9).move_to(center + UP*0.3 + LEFT*0.25)
            h2 = Circle(radius=0.15, color=WHITE, fill_opacity=0.9).move_to(center + UP*0.3 + RIGHT*0.25)
            b1 = Line(o.get_center(), h1.get_center(), color=GRAY, stroke_width=3)
            b2 = Line(o.get_center(), h2.get_center(), color=GRAY, stroke_width=3)
            lbl = create_math_formula("H_2O", font_size=18).next_to(o, DOWN, buff=0.1)
            return VGroup(o, h1, h2, b1, b2, lbl)

        w1 = create_water(ORIGIN + UP*1.0)
        w2 = create_water(ORIGIN + LEFT*1.5 + DOWN*0.5)
        w3 = create_water(ORIGIN + RIGHT*1.5 + DOWN*0.5)
        waters = VGroup(w1, w2, w3)

        power_sign = create_chinese_formula(r"$\bigstar$ 通电 $\bigstar$", font_size=32, color=YELLOW).shift(UP*2.5)
        cathode = create_chinese_formula(r"阴极(负极)", font_size=24, color=BLUE).shift(LEFT*3.0 + DOWN*0.5)
        anode = create_chinese_formula(r"阳极(正极)", font_size=24, color=RED).shift(RIGHT*3.0 + DOWN*0.5)

        eq = create_math_formula(r"2H_2O \xrightarrow{\text{通电}} 2H_2 \uparrow + O_2 \uparrow", font_size=28).shift(DOWN*2.8)
        eq.set_opacity(0)

        main_group = VGroup(waters, power_sign, cathode, anode, eq)
        self.add_animation(main_group, animation=FadeIn(main_group[:4]), run_time=1)

        self.add_animation(power_sign, animation=Succession(Flash(power_sign, color=YELLOW), Wait(0.3), Flash(power_sign, color=YELLOW)), run_time=2)

        self.add_animation(waters, animation=FadeOut(waters), run_time=1.5)
        self.add_animation(eq, animation=FadeIn(eq), run_time=1)
        self.add_animation(eq, animation=Indicate(eq, color=YELLOW), run_time=2)

        lines = [
            "从微观角度看反应过程",
            "通电后水分子分解为氢氧原子",
            "氢原子在负极结合为氢气",
            "氧原子在正极结合为氧气",
            "氢氧体积比为2比1"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(7)

    def _page_3(self, total_pages: int) -> None:
        self.next_page(layout="left_right", transition=True)
        self.set_title("电解水产物验证", font_size=32)
        self.set_page_number(3, total_pages)

        # 左侧上半部分
        ul_tube = Rectangle(width=0.8, height=2.0, color=WHITE, fill_opacity=0.2, stroke_width=2).shift(UP*1.0)
        ul_wood = VGroup(
            Rectangle(width=0.1, height=1.2, color=ORANGE, fill_opacity=0.8),
            Triangle(color=YELLOW, fill_opacity=0.9).scale(0.2)
        ).arrange(UP, buff=0, aligned_edge=DOWN).rotate(PI/4).next_to(ul_tube, LEFT, buff=0.5)
        ul_flame = VGroup(
            Triangle(color=PINK, fill_opacity=0.8).scale(0.5),
            Triangle(color=RED, fill_opacity=0.9).scale(0.3).move_to(Triangle(color=PINK, fill_opacity=0.8).scale(0.5).get_center() + UP*0.1)
        ).move_to(ul_tube.get_center() + UP*0.5).set_opacity(0)
        ul_lbl = create_chinese_formula(r"氢气 可燃", font_size=22, color=PINK).next_to(ul_tube, RIGHT, buff=0.3).set_opacity(0)
        upper_left = VGroup(ul_tube, ul_wood, ul_flame, ul_lbl)

        # 左侧下半部分
        ll_tube = Rectangle(width=0.8, height=2.0, color=WHITE, fill_opacity=0.2, stroke_width=2).shift(DOWN*1.0)
        ll_wood = VGroup(
            Rectangle(width=0.1, height=1.2, color=ORANGE, fill_opacity=0.8),
            Circle(radius=0.08, color=RED, fill_opacity=0.6)
        ).arrange(UP, buff=0, aligned_edge=DOWN).rotate(PI/6).next_to(ll_tube, LEFT, buff=0.5)
        ll_flame = VGroup(
            Triangle(color=YELLOW, fill_opacity=0.9).scale(0.4),
            Triangle(color=WHITE, fill_opacity=1.0).scale(0.2).move_to(Triangle(color=YELLOW, fill_opacity=0.9).scale(0.4).get_center() + UP*0.1)
        ).move_to(ll_tube.get_center() + UP*0.2).set_opacity(0)
        ll_lbl = create_chinese_formula(r"氧气 助燃", font_size=22, color=GREEN).next_to(ll_tube, RIGHT, buff=0.3).set_opacity(0)
        lower_left = VGroup(ll_tube, ll_wood, ll_flame, ll_lbl)

        left_group = VGroup(upper_left, lower_left).arrange(DOWN, buff=0.5).to_edge(LEFT, buff=0.5)

        # 右侧文字
        right_group = VGroup(
            create_chinese_formula(r"负极产物 氢气($H_2$)", font_size=26),
            create_chinese_formula(r"正极产物 氧气($O_2$)", font_size=26),
            create_chinese_formula(r"验证水由氢氧两种元素组成", font_size=26)
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.4).to_edge(RIGHT, buff=0.5)

        self.add_animation(left_group, side="left", animation=FadeIn(left_group[0][0], left_group[0][1], left_group[1][0], left_group[1][1]), run_time=2)
        self.add_animation(right_group, side="right", animation=FadeIn(right_group), run_time=2)

        self.add_animation(left_group[0][2], animation=FadeIn(left_group[0][2]), run_time=0.5)
        self.add_animation(left_group[0][3], animation=FadeIn(left_group[0][3]), run_time=0.5)
        self.wait(2)

        self.add_animation(left_group[1][2], animation=FadeIn(left_group[1][2]), run_time=0.5)
        self.add_animation(left_group[1][3], animation=FadeIn(left_group[1][3]), run_time=0.5)
        self.wait(2)

        self.add_animation(right_group[0], animation=Indicate(right_group[0], color=PINK), run_time=2)
        self.add_animation(right_group[1], animation=Indicate(right_group[1], color=GREEN), run_time=2)
        self.add_animation(right_group[2], animation=Indicate(right_group[2], color=YELLOW), run_time=2)
        self.wait(12)

        lines = [
            "我们来验证生成的两种气体",
            "负极气体可燃是氢气",
            "正极气体助燃是氧气",
            "证明水由氢氧元素组成"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)

    def _page_4(self, total_pages: int) -> None:
        self.next_page(layout="center", transition=True)
        self.set_title("电解水原理总结", font_size=32)
        self.set_page_number(4, total_pages)

        # 中心节点
        center = VGroup(
            Circle(radius=0.6, color=YELLOW, fill_opacity=0.8),
            create_chinese_formula(r"电解水原理", font_size=22)
        )
        center[1].move_to(center[0].get_center())

        # 分支
        b1_line = Line(center.get_top(), center.get_top() + UP*1.2, color=GRAY, stroke_width=3)
        b1_node = VGroup(
            Rectangle(width=2.2, height=0.6, color=BLUE, fill_opacity=0.7),
            create_chinese_formula(r"反应条件 通直流电", font_size=18)
        )
        b1_node[1].move_to(b1_node[0].get_center())
        b1_node.next_to(b1_line, UP, buff=0.05)
        branch1 = VGroup(b1_line, b1_node).set_opacity(0)

        b2_line = Line(center.get_left(), center.get_left() + LEFT*1.5, color=GRAY, stroke_width=3)
        b2_node = VGroup(
            Rectangle(width=2.5, height=0.8, color=GREEN, fill_opacity=0.7),
            create_chinese_formula(r"微观过程 分子拆分 原子重组", font_size=18)
        )
        b2_node[1].move_to(b2_node[0].get_center())
        b2_node.next_to(b2_line, LEFT, buff=0.05)
        branch2 = VGroup(b2_line, b2_node).set_opacity(0)

        b3_line = Line(center.get_bottom(), center.get_bottom() + DOWN*1.2, color=GRAY, stroke_width=3)
        b3_node = VGroup(
            Rectangle(width=2.8, height=0.7, color=PINK, fill_opacity=0.7),
            create_chinese_formula(r"产物 负氢正氧 体积比$2:1$", font_size=18)
        )
        b3_node[1].move_to(b3_node[0].get_center())
        b3_node.next_to(b3_line, DOWN, buff=0.05)
        branch3 = VGroup(b3_line, b3_node).set_opacity(0)

        b4_line = Line(center.get_right(), center.get_right() + RIGHT*1.5, color=GRAY, stroke_width=3)
        b4_node = VGroup(
            Rectangle(width=2.5, height=0.6, color=ORANGE, fill_opacity=0.7),
            create_chinese_formula(r"结论 水由$H$ $O$元素组成", font_size=18)
        )
        b4_node[1].move_to(b4_node[0].get_center())
        b4_node.next_to(b4_line, RIGHT, buff=0.05)
        branch4 = VGroup(b4_line, b4_node).set_opacity(0)

        # 底部反应式
        final_eq = create_math_formula(r"2H_2O \xrightarrow{\text{通电}} 2H_2 \uparrow + O_2 \uparrow", font_size=30).shift(DOWN*2.8).set_opacity(0)

        mindmap = VGroup(center, branch1, branch2, branch3, branch4, final_eq)
        self.add_animation(mindmap, animation=FadeIn(center), run_time=0.5)

        self.add_animation(branch1, animation=FadeIn(branch1), run_time=1)
        self.wait(0.5)
        self.add_animation(branch2, animation=FadeIn(branch2), run_time=1)
        self.wait(0.5)
        self.add_animation(branch3, animation=FadeIn(branch3), run_time=1)
        self.wait(0.5)
        self.add_animation(branch4, animation=FadeIn(branch4), run_time=1)

        self.add_animation(final_eq, animation=FadeIn(final_eq), run_time=1)
        self.add_animation(final_eq, animation=Indicate(final_eq, color=YELLOW), run_time=2)

        lines = [
            "最后我们总结电解水原理",
            "反应条件为通直流电",
            "本质是原子的重新组合",
            "记住负氢正氧体积比2比1",
            "水由氢氧两种元素组成"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(16)
        self.add_animation(mindmap, animation=FadeOut(mindmap), run_time=0.5)
```