from __future__ import annotations

import sys
from pathlib import Path
import numpy as np

from manim import (
    VGroup, Rectangle, Text, Line, Circle, Polygon,
    FadeIn, Write, Indicate, Flash, Transform, ScaleInPlace,
    Succession, AnimationGroup, ORIGIN, UP, DOWN, LEFT, RIGHT,
    RED, BLUE, YELLOW, WHITE, GRAY, GREEN, CYAN, BLUE_D, BROWN, ORANGE, BLUE_A
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

        # 左侧装置构建
        left_parent = self.create_parent("left_device", side="left")
        
        # 电源组件
        power_supply = Rectangle(width=1.2, height=0.6, color=GRAY, fill_opacity=0.3).to_edge(UP, buff=0.5)
        power_label = Text("直流电源", font_size=20).next_to(power_supply, DOWN)
        pos_terminal = Text("+", font_size=24, color=RED).move_to(power_supply.get_left() + RIGHT*0.1)
        neg_terminal = Text("-", font_size=24, color=BLUE).move_to(power_supply.get_right() + LEFT*0.1)
        power_group = VGroup(power_supply, power_label, pos_terminal, neg_terminal)
        
        # 导线
        pos_wire = Line(power_supply.get_left() + LEFT*0.1, [-2, 1, 0], color=RED)
        neg_wire = Line(power_supply.get_right() + RIGHT*0.1, [2, 1, 0], color=BLUE)
        
        # 玻璃管
        pos_tube = Rectangle(width=0.4, height=2.5, color=BLUE, stroke_width=2, fill_opacity=0.1).move_to([-2, -0.5, 0])
        neg_tube = Rectangle(width=0.4, height=2.5, color=BLUE, stroke_width=2, fill_opacity=0.1).move_to([2, -0.5, 0])
        pos_tube_label = Text("玻璃刻度管", font_size=18).next_to(pos_tube, LEFT)
        neg_tube_label = Text("玻璃刻度管", font_size=18).next_to(neg_tube, RIGHT)
        
        # 电极
        pos_electrode = Line(pos_tube.get_top(), pos_tube.get_top() + DOWN*0.3, color=RED, stroke_width=4)
        neg_electrode = Line(neg_tube.get_top(), neg_tube.get_top() + DOWN*0.3, color=BLUE, stroke_width=4)
        
        # 水槽与液体
        tank = Rectangle(width=5, height=1.2, color=CYAN, stroke_width=2, fill_opacity=0.2).move_to([0, -2, 0])
        tank_label = Text("水槽", font_size=20).next_to(tank, DOWN)
        pos_liquid = Rectangle(width=0.35, height=1.8, color=BLUE_D, fill_opacity=0.4).move_to(pos_tube.get_bottom() + UP*0.9)
        neg_liquid = Rectangle(width=0.35, height=1.8, color=BLUE_D, fill_opacity=0.4).move_to(neg_tube.get_bottom() + UP*0.9)
        
        # 标注
        pos_label = Text("正极", font_size=20, color=RED).next_to(pos_electrode, UP)
        neg_label = Text("负极", font_size=20, color=BLUE).next_to(neg_electrode, UP)
        
        device_group = VGroup(
            power_group, pos_wire, neg_wire,
            pos_tube, neg_tube, pos_tube_label, neg_tube_label,
            pos_electrode, neg_electrode,
            tank, tank_label, pos_liquid, neg_liquid,
            pos_label, neg_label
        )
        self.add_animation(device_group, animation=FadeIn(device_group), side="left", run_time=3)
        
        # 依次高亮元素
        self.wait(3)
        self.add_animation(pos_label, animation=Indicate(pos_label, scale_factor=1.3), run_time=2)
        self.add_animation(neg_label, animation=Indicate(neg_label, scale_factor=1.3), run_time=2)
        self.add_animation(VGroup(pos_liquid, neg_liquid), animation=Indicate(VGroup(pos_liquid, neg_liquid), scale_factor=1.05), run_time=2)
        
        # 右侧说明文字
        right_parent = self.create_parent("right_content", side="right")
        right_title = Text("电解水实验装置", font_size=32, weight=BOLD).to_edge(UP, buff=0.5)
        self.add_animation(right_title, animation=FadeIn(right_title), side="right", run_time=0.5)
        
        right_texts = [
            "1 正极连接阳极",
            "2 负极连接阴极",
            "3 容器内为添加少量硫酸钠的纯水"
        ]
        for i, text in enumerate(right_texts):
            text_mob = Text(text, font_size=28).next_to(right_title, DOWN, buff=0.5 + i*0.8)
            self.wait(1 + i)
            self.add_animation(text_mob, animation=Write(text_mob), side="right", run_time=0.5)
        
        self.wait(2)
        
        # 字幕
        self.speak_with_subtitles([
            "今天我们来学习电解水的原理",
            "首先认识电解水的实验装置",
            "左侧连正极做阳极右侧连负极做阴极",
            "水中加硫酸钠增强导电性"
        ], subtitle_font_size=28, pause_between=0.08)

    def _page_1(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1", transition=True)
        self.set_title("通电后的实验现象")
        self.set_page_number(2, total_pages)

        # 左侧装置
        left_parent = self.create_parent("left_device_2", side="left")
        
        # 电源
        power_supply = Rectangle(width=1.2, height=0.6, color=GRAY, fill_opacity=0.3).to_edge(UP, buff=0.5)
        power_label = Text("直流电源", font_size=20).next_to(power_supply, DOWN)
        switch = Text("开", font_size=20, color=GREEN).move_to(power_supply.get_center())
        pos_terminal = Text("+", font_size=24, color=RED).move_to(power_supply.get_left() + RIGHT*0.1)
        neg_terminal = Text("-", font_size=24, color=BLUE).move_to(power_supply.get_right() + LEFT*0.1)
        power_group = VGroup(power_supply, power_label, switch, pos_terminal, neg_terminal)
        
        # 导线与玻璃管
        pos_wire = Line(power_supply.get_left() + LEFT*0.1, [-2, 1, 0], color=RED)
        neg_wire = Line(power_supply.get_right() + RIGHT*0.1, [2, 1, 0], color=BLUE)
        pos_tube = Rectangle(width=0.4, height=2.5, color=BLUE, stroke_width=2, fill_opacity=0.1).move_to([-2, -0.5, 0])
        neg_tube = Rectangle(width=0.4, height=2.5, color=BLUE, stroke_width=2, fill_opacity=0.1).move_to([2, -0.5, 0])
        pos_electrode = Line(pos_tube.get_top(), pos_tube.get_top() + DOWN*0.3, color=RED, stroke_width=4)
        neg_electrode = Line(neg_tube.get_top(), neg_tube.get_top() + DOWN*0.3, color=BLUE, stroke_width=4)
        tank = Rectangle(width=5, height=1.2, color=CYAN, stroke_width=2, fill_opacity=0.2).move_to([0, -2, 0])
        
        # 液体
        pos_liquid = Rectangle(width=0.35, height=1.8, color=BLUE_D, fill_opacity=0.4).move_to(pos_tube.get_bottom() + UP*0.9)
        neg_liquid = Rectangle(width=0.35, height=1.8, color=BLUE_D, fill_opacity=0.4).move_to(neg_tube.get_bottom() + UP*0.9)
        
        device_base = VGroup(
            power_group, pos_wire, neg_wire,
            pos_tube, neg_tube, pos_electrode, neg_electrode,
            tank, pos_liquid, neg_liquid
        )
        self.add_animation(device_base, animation=FadeIn(device_base), side="left", run_time=0.5)
        
        # 电源闪光
        flash = Flash(power_supply.get_center(), color=YELLOW, line_length=0.3, num_lines=12)
        self.add_animation(flash, animation=flash, side="left", run_time=2)
        self.wait(2)
        
        # 气泡与液面动画
        bubbles = VGroup()
        for _ in range(20):
            pos_bubble = Circle(radius=0.05, color=WHITE, fill_opacity=0.8).move_to(
                pos_electrode.get_bottom() + DOWN*0.1 + RIGHT*np.random.uniform(-0.1, 0.1)
            )
            pos_bubble.add_updater(lambda m, dt: m.shift(UP*0.3*dt))
            for __ in range(2):
                neg_bubble = Circle(radius=0.05, color=WHITE, fill_opacity=0.8).move_to(
                    neg_electrode.get_bottom() + DOWN*0.1 + RIGHT*np.random.uniform(-0.1, 0.1)
                )
                neg_bubble.add_updater(lambda m, dt: m.shift(UP*0.3*dt))
                bubbles.add(neg_bubble)
            bubbles.add(pos_bubble)
        self.add_animation(bubbles, animation=FadeIn(bubbles), side="left", run_time=0.5)
        
        pos_liquid_target = Rectangle(width=0.35, height=1.2, color=BLUE_D, fill_opacity=0.4).move_to(pos_tube.get_bottom() + UP*0.6)
        neg_liquid_target = Rectangle(width=0.35, height=0.6, color=BLUE_D, fill_opacity=0.4).move_to(neg_tube.get_bottom() + UP*0.3)
        self.add_animation(VGroup(pos_liquid, neg_liquid), animation=Transform(VGroup(pos_liquid, neg_liquid), VGroup(pos_liquid_target, neg_liquid_target)), side="left", run_time=15)
        self.wait(15)
        
        # 体积比标注
        volume_ratio = create_math_formula(r"\text{正极气体体积:负极气体体积}=1:2", font_size=28, color=YELLOW)
        volume_ratio.move_to([0, 0.5, 0])
        self.add_animation(volume_ratio, animation=ScaleInPlace(volume_ratio, 1.2), side="left", run_time=1)
        self.wait(1)
        
        # 右侧说明
        right_parent = self.create_parent("right_content_2", side="right")
        right_title = Text("实验现象", font_size=32, weight=BOLD).to_edge(UP, buff=0.5)
        self.add_animation(right_title, animation=FadeIn(right_title), side="right", run_time=0.5)
        
        right_texts = [
            "1 两极均有气泡产生",
            "2 正负极气体体积比为1:2"
        ]
        for i, text in enumerate(right_texts):
            text_mob = Text(text, font_size=28).next_to(right_title, DOWN, buff=0.5 + i*0.8)
            self.wait(1 + i)
            self.add_animation(text_mob, animation=Write(text_mob), side="right", run_time=0.5)
        
        self.wait(3)
        
        # 字幕
        self.speak_with_subtitles([
            "接通直流电源后两极都产生气泡",
            "正极气体体积比负极为1比2",
            "这两种气体分别是什么呢"
        ], subtitle_font_size=28, pause_between=0.08)

    def _page_2(self, total_pages: int) -> None:
        self.next_page(layout="center", transition=True)
        self.set_title("微观反应过程解析")
        self.set_page_number(3, total_pages)

        # 电极标识
        anode_label = Text("阳极（+）", font_size=28, color=RED).to_edge(LEFT, buff=1)
        cathode_label = Text("阴极（-）", font_size=28, color=BLUE).to_edge(RIGHT, buff=1)
        self.add_animation(VGroup(anode_label, cathode_label), animation=FadeIn(VGroup(anode_label, cathode_label)), run_time=1)
        
        # 水分子模型
        water_molecules = VGroup()
        for idx in range(8):
            o = Circle(radius=0.15, color=RED, fill_opacity=0.8).shift(
                np.array([np.random.uniform(-3, 3), np.random.uniform(-2, 1), 0])
            )
            h1 = Circle(radius=0.1, color=WHITE, fill_opacity=0.8).next_to(o, LEFT + UP*0.5, buff=0.05)
            h2 = Circle(radius=0.1, color=WHITE, fill_opacity=0.8).next_to(o, RIGHT + UP*0.5, buff=0.05)
            label = create_math_formula(r"H_2O", font_size=16).next_to(o, DOWN, buff=0.1)
            water_molecules.add(VGroup(o, h1, h2, label))
        self.add_animation(water_molecules, animation=FadeIn(water_molecules), run_time=3)
        self.wait(1)
        
        # 通电闪烁
        power_text = Text("通电", font_size=32, color=YELLOW).to_edge(UP, buff=1)
        self.add_animation(power_text, animation=FadeIn(power_text), run_time=0.5)
        for _ in range(2):
            self.add_animation(power_text, animation=Flash(power_text.get_center(), color=YELLOW, line_length=0.2, num_lines=8), run_time=1)
        self.wait(2)
        
        # 简化的反应动画
        def make_reaction():
            w1 = water_molecules[0].copy()
            w2 = water_molecules[1].copy()
            w3 = water_molecules[2].copy()
            w4 = water_molecules[3].copy()
            
            return Succession(
                AnimationGroup(
                    w1.animate.move_to(anode_label.get_right() + RIGHT*1 + DOWN*1),
                    w2.animate.move_to(anode_label.get_right() + RIGHT*1 + DOWN*0),
                    w3.animate.move_to(cathode_label.get_left() + LEFT*1 + DOWN*1),
                    w4.animate.move_to(cathode_label.get_left() + LEFT*1 + DOWN*0),
                    run_time=2
                ),
                AnimationGroup(
                    FadeOut(w1[3]), FadeOut(w2[3]), FadeOut(w3[3]), FadeOut(w4[3]),
                    run_time=1
                ),
                AnimationGroup(
                    VGroup(w1[0], w2[0]).animate.move_to(anode_label.get_right() + RIGHT*0.5),
                    VGroup(w1[1], w1[2], w2[1], w2[2]).animate.move_to(cathode_label.get_left() + LEFT*0.5),
                    VGroup(w3[1], w3[2], w4[1], w4[2]).animate.move_to(cathode_label.get_left() + LEFT*0.5 + DOWN*0.5),
                    VGroup(w3[0], w4[0]).animate.move_to(anode_label.get_right() + RIGHT*0.5 + DOWN*0.5),
                    run_time=5
                )
            )
        
        self.add_animation(make_reaction(), animation=make_reaction(), run_time=8)
        self.wait(8)
        self.add_animation(make_reaction(), animation=make_reaction(), run_time=8)
        self.wait(8)
        
        # 化学方程式
        equation = create_math_formula(r"2H_2O \stackrel{通电}{=\!=\!=} 2H_2\uparrow + O_2\uparrow", font_size=42)
        equation.to_edge(DOWN, buff=1)
        self.add_animation(equation, animation=FadeIn(equation, shift=UP), run_time=2)
        self.add_animation(equation, animation=ScaleInPlace(equation, 1.1), run_time=1)
        self.wait(6)
        
        # 字幕
        self.speak_with_subtitles([
            "微观上通电后水分子分解为氢氧原子",
            "两个氢原子结合成氢分子聚集成氢气",
            "两个氧原子结合成氧分子聚集成氧气",
            "对应反应为2H₂O通电生成2H₂和O₂"
        ], subtitle_font_size=28, pause_between=0.08)

    def _page_3(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1", transition=True)
        self.set_title("气体检验与实验结论")
        self.set_page_number(4, total_pages)

        # 左侧气体检验
        left_parent = self.create_parent("left_tests", side="left")
        
        # 氧气检验
        o2_container = Rectangle(width=1.5, height=2, color=BLUE, stroke_width=2, fill_opacity=0.1).to_edge(UP, buff=0.5).shift(LEFT*0.5)
        o2_label = create_math_formula(r"O_2", font_size=24).move_to(o2_container.get_center() + UP*0.5)
        splint = Line(o2_container.get_top() + UP*0.5, o2_container.get_center(), color=BROWN, stroke_width=3)
        glowing_tip = Circle(radius=0.08, color=ORANGE, fill_opacity=0.8).move_to(splint.get_end())
        glowing_text = Text("带火星", font_size=18).next_to(splint, LEFT)
        o2_conclusion = Text("氧气 助燃", font_size=22, color=YELLOW).next_to(o2_container, RIGHT)
        
        upper_test = VGroup(o2_container, o2_label, splint, glowing_tip, glowing_text)
        self.add_animation(upper_test, animation=FadeIn(upper_test), side="left", run_time=2)
        self.wait(2)
        self.add_animation(Flash(glowing_tip.get_center(), color=YELLOW, line_length=0.3, num_lines=12), animation=Flash(glowing_tip.get_center(), color=YELLOW, line_length=0.3, num_lines=12), side="left", run_time=1)
        self.add_animation(o2_conclusion, animation=FadeIn(o2_conclusion), side="left", run_time=0.5)
        self.wait(2)
        
        # 氢气检验
        h2_container = Rectangle(width=1.5, height=2, color=BLUE, stroke_width=2, fill_opacity=0.1).to_edge(DOWN, buff=0.5).shift(LEFT*0.5)
        h2_label = create_math_formula(r"H_2", font_size=24).move_to(h2_container.get_center() + UP*0.5)
        burning_splint = Line(h2_container.get_top() + UP*0.5, h2_container.get_top() + DOWN*0.1, color=BROWN, stroke_width=3)
        flame = Polygon(
            burning_splint.get_end() + UP*0.05,
            burning_splint.get_end() + LEFT*0.15 + DOWN*0.3,
            burning_splint.get_end() + RIGHT*0.15 + DOWN*0.3,
            color=BLUE_A, fill_opacity=0.8
        )
        burning_text = Text("燃着", font_size=18).next_to(burning_splint, LEFT)
        h2_conclusion = Text("氢气 可燃", font_size=22, color=YELLOW).next_to(h2_container, RIGHT)
        
        lower_test = VGroup(h2_container, h2_label, burning_splint, flame, burning_text)
        self.add_animation(lower_test, animation=FadeIn(lower_test), side="left", run_time=2)
        self.wait(2)
        self.add_animation(h2_conclusion, animation=FadeIn(h2_conclusion), side="left", run_time=0.5)
        self.wait(2)
        
        # 右侧结论
        right_parent = self.create_parent("right_conclusion", side="right")
        right_title = Text("实验结论", font_size=32, weight=BOLD).to_edge(UP, buff=0.5)
        self.add_animation(right_title, animation=FadeIn(right_title), side="right", run_time=0.5)
        
        right_texts = [
            "1 水由氢元素和氧元素组成",
            "2 化学变化中分子可分原子不可分",
            "3 口诀：正氧负氢 氢二氧一"
        ]
        for i, text in enumerate(right_texts):
            text_mob = Text(text, font_size=28).next_to(right_title, DOWN, buff=0.5 + i*0.8)
            if i == 2:
                text_mob.set_color(YELLOW)
            self.wait(1 + i)
            self.add_animation(text_mob, animation=Write(text_mob), side="right", run_time=0.5)
            if i == 2:
                self.add_animation(text_mob, animation=ScaleInPlace(text_mob, 1.1), side="right", run_time=0.5)
        
        self.wait(5)
        
        # 字幕
        self.speak_with_subtitles([
            "正极气体可使带火星木条复燃是氧气",
            "负极气体可燃烧产生淡蓝色火焰是氢气",
            "说明水由氢元素和氧元素组成",
            "可记口诀正氧负氢氢二氧一"
        ], subtitle_font_size=28, pause_between=0.08)
