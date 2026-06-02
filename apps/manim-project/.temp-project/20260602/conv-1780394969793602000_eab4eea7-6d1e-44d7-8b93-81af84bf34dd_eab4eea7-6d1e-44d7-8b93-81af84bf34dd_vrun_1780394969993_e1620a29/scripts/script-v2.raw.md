```python
from __future__ import annotations

import sys
from pathlib import Path

from manim import (
    Circle, RoundedRectangle, Line, Arrow, Text, VGroup, FadeIn, Create,
    GrowArrow, Indicate, Transform, ApplyMethod, RED, BLUE, YELLOW, WHITE, BLACK,
    ORIGIN, UP, DOWN, LEFT, RIGHT, MathTex, Wait
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

    def construct(self) -> None:
        total_pages = 4
        self._page_0(total_pages)
        self._page_1(total_pages)
        self._page_2(total_pages)
        self._page_3(total_pages)

    def _page_0(self, total_pages: int) -> None:
        self.start_page(layout="left_right", column_ratio="1:1", transition=False)
        self.set_title("电解水实验装置介绍")
        self.set_page_number(1, total_pages)

        # 左侧实验装置
        left_container = self.create_parent("left_container", side="left", show_boundary=False)
        
        # 电源
        power_neg = RoundedRectangle(corner_radius=0.1, width=0.8, height=0.6, color=WHITE, fill_opacity=0.8).shift(UP * 2.8 + LEFT * 1.0)
        power_pos = RoundedRectangle(corner_radius=0.1, width=0.8, height=0.6, color=YELLOW, fill_opacity=0.8).shift(UP * 2.8 + RIGHT * 1.0)
        neg_text = Text("-", font_size=32, color=BLACK).move_to(power_neg)
        pos_text = Text("+", font_size=32, color=BLACK).move_to(power_pos)
        power_group = VGroup(power_neg, power_pos, neg_text, pos_text)
        
        # 电极
        neg_electrode = Line(UP * 2.2, DOWN * 1.5, color=BLACK, stroke_width=4).next_to(power_neg, DOWN, buff=0.1)
        pos_electrode = Line(UP * 2.2, DOWN * 1.5, color=BLACK, stroke_width=4).next_to(power_pos, DOWN, buff=0.1)
        electrode_group = VGroup(neg_electrode, pos_electrode)
        
        # 试管
        tube_neg = RoundedRectangle(corner_radius=0.1, width=1.2, height=3.2, color=BLUE, stroke_opacity=0.9, fill_opacity=0.1).shift(LEFT * 1.0 + DOWN * 0.5)
        tube_pos = RoundedRectangle(corner_radius=0.1, width=1.2, height=3.2, color=BLUE, stroke_opacity=0.9, fill_opacity=0.1).shift(RIGHT * 1.0 + DOWN * 0.5)
        tube_group = VGroup(tube_neg, tube_pos)
        
        # 气体标签
        h2_label = Text("H₂", font_size=30, color=WHITE).next_to(tube_neg, LEFT, buff=0.3)
        o2_label = Text("O₂", font_size=30, color=WHITE).next_to(tube_pos, RIGHT, buff=0.3)
        ratio_placeholder = create_math_formula(r"V_{H_2} : V_{O_2} = ? : ?", font_size=32).shift(DOWN * 2.8)
        label_group = VGroup(h2_label, o2_label, ratio_placeholder)
        
        # 组合装置
        device_group = VGroup(power_group, electrode_group, tube_group, label_group)
        self.add_animation(device_group, animation=FadeIn(device_group), run_time=1.0)

        # 右侧说明
        right_container = self.create_parent("right_container", side="right", show_boundary=False)
        self.add_text("电解水实验装置", font_size=38, side="right", animate=True, run_time=2.0)
        self.wait(0.5)
        self.add_text("1. 直流电源供电", font_size=28, side="right", animate=True, run_time=0.8)
        self.wait(0.5)
        self.add_text("2. 纯水添加少量硫酸钠增强导电性", font_size=28, side="right", animate=True, run_time=0.8)
        self.wait(0.5)
        self.add_text("3. 通电后两极产生气体", font_size=28, side="right", animate=True, run_time=0.8)

        # 高亮气体试管
        self.wait(0.5)
        self.add_animation(tube_neg, animation=Indicate(tube_neg, color=YELLOW, scale_factor=1.1, run_time=1.0), run_time=1.0)
        self.add_animation(tube_pos, animation=Indicate(tube_pos, color=YELLOW, scale_factor=1.1, run_time=1.0), run_time=1.0)
        self.wait(9.0)

        lines = [
            "今天我们来学习电解水的原理",
            "首先认识电解水的实验装置",
            "使用直流电源为电极供电",
            "纯水加硫酸钠增强导电性",
            "通电后两极都会产生气体"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)

    def _page_1(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1", transition=True)
        self.set_title("电解水宏观现象观察")
        self.set_page_number(2, total_pages)

        # 左侧简化动态装置
        left_container = self.create_parent("left_container", side="left", show_boundary=False)
        
        # 基础装置
        power_neg = RoundedRectangle(corner_radius=0.1, width=0.8, height=0.6, color=WHITE, fill_opacity=0.8).shift(UP * 2.5 + LEFT * 1.0)
        power_pos = RoundedRectangle(corner_radius=0.1, width=0.8, height=0.6, color=YELLOW, fill_opacity=0.8).shift(UP * 2.5 + RIGHT * 1.0)
        neg_text = Text("-", font_size=30, color=BLACK).move_to(power_neg)
        pos_text = Text("+", font_size=30, color=BLACK).move_to(power_pos)
        tube_neg = RoundedRectangle(corner_radius=0.1, width=1.0, height=3.0, color=BLUE, stroke_opacity=0.9, fill_opacity=0.1).shift(LEFT * 1.0 + DOWN * 0.3)
        tube_pos = RoundedRectangle(corner_radius=0.1, width=1.0, height=3.0, color=BLUE, stroke_opacity=0.9, fill_opacity=0.1).shift(RIGHT * 1.0 + DOWN * 0.3)
        h2_label = Text("H₂", font_size=28, color=WHITE).next_to(tube_neg, LEFT, buff=0.2)
        o2_label = Text("O₂", font_size=28, color=WHITE).next_to(tube_pos, RIGHT, buff=0.2)
        
        # 初始液面
        liquid_neg = RoundedRectangle(corner_radius=0.1, width=0.9, height=2.8, color=BLUE, fill_opacity=0.6).move_to(tube_neg.get_center() + DOWN * 0.1)
        liquid_pos = RoundedRectangle(corner_radius=0.1, width=0.9, height=2.8, color=BLUE, fill_opacity=0.6).move_to(tube_pos.get_center() + DOWN * 0.1)
        
        # 最终液面（2:1体积）
        final_liquid_neg = RoundedRectangle(corner_radius=0.1, width=0.9, height=1.8, color=BLUE, fill_opacity=0.6).move_to(tube_neg.get_center() + DOWN * 0.6)
        final_liquid_pos = RoundedRectangle(corner_radius=0.1, width=0.9, height=2.4, color=BLUE, fill_opacity=0.6).move_to(tube_pos.get_center() + DOWN * 0.3)
        
        # 气体区域
        gas_neg = RoundedRectangle(corner_radius=0.1, width=0.9, height=1.0, color=WHITE, fill_opacity=0.2).move_to(tube_neg.get_center() + UP * 0.4)
        gas_pos = RoundedRectangle(corner_radius=0.1, width=0.9, height=0.5, color=WHITE, fill_opacity=0.2).move_to(tube_pos.get_center() + UP * 0.2)
        
        # 体积比标注
        ratio_label = create_math_formula(r"V_{H_2} : V_{O_2} = 2 : 1", font_size=36, color=RED).shift(DOWN * 2.6)
        
        device_group = VGroup(power_neg, power_pos, neg_text, pos_text, tube_neg, tube_pos, h2_label, o2_label, liquid_neg, liquid_pos)
        self.add_animation(device_group, animation=FadeIn(device_group), run_time=1.0)
        
        # 液面下降动画
        self.add_animation(liquid_neg, animation=Transform(liquid_neg, final_liquid_neg), run_time=6.0)
        self.add_animation(liquid_pos, animation=Transform(liquid_pos, final_liquid_pos), run_time=6.0)
        
        # 显示气体区域和体积比
        self.add_animation(gas_neg, animation=FadeIn(gas_neg), run_time=0.5)
        self.add_animation(gas_pos, animation=FadeIn(gas_pos), run_time=0.5)
        self.add_animation(ratio_label, animation=FadeIn(ratio_label), run_time=0.5)

        # 右侧说明
        right_container = self.create_parent("right_container", side="right", show_boundary=False)
        self.add_text("实验现象记录", font_size=36, side="right", animate=True, run_time=1.0)
        self.wait(1.0)
        self.add_text("1. 负极气体体积:正极气体体积=2:1", font_size=26, side="right", animate=True, run_time=0.8)
        self.wait(1.0)
        self.add_text("2. 负极气体可燃烧产生淡蓝色火焰", font_size=26, side="right", animate=True, run_time=0.8)
        self.wait(1.0)
        self.add_text("3. 正极气体可使带火星木条复燃", font_size=26, side="right", animate=True, run_time=0.8)

        # 闪烁体积比
        self.wait(1.0)
        for _ in range(3):
            self.add_animation(ratio_label, animation=Indicate(ratio_label, color=YELLOW, scale_factor=1.2, run_time=0.6), run_time=0.6)
            self.wait(0.2)
        self.wait(2.0)

        lines = [
            "观察电解水的实验现象",
            "负极气体体积是正极的两倍",
            "负极气体可燃烧是氢气",
            "正极气体可助燃是氧气"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)

    def _page_2(self, total_pages: int) -> None:
        self.next_page(layout="center", transition=True)
        self.set_title("电解水微观过程拆解")
        self.set_page_number(3, total_pages)

        # 创建水分子
        def create_water_molecule(center=ORIGIN):
            o = Circle(radius=0.3, color=RED, fill_opacity=0.9).move_to(center)
            h1 = Circle(radius=0.2, color=WHITE, fill_opacity=0.9).move_to(center + LEFT * 0.4 + UP * 0.3)
            h2 = Circle(radius=0.2, color=WHITE, fill_opacity=0.9).move_to(center + RIGHT * 0.4 + UP * 0.3)
            label = create_math_formula(r"H_2O", font_size=24).move_to(center + DOWN * 0.5)
            return VGroup(o, h1, h2, label)

        water1 = create_water_molecule(LEFT * 1.8 + UP * 1.0)
        water2 = create_water_molecule(RIGHT * 1.8 + UP * 1.0)
        water_group = VGroup(water1, water2)
        self.add_animation(water_group, animation=FadeIn(water_group), run_time=1.0)

        # 通电箭头
        power_arrow = Arrow(UP * 3.5, UP * 2.0, color=YELLOW, stroke_width=6)
        power_text = Text("通电", font_size=32, color=YELLOW).next_to(power_arrow, UP, buff=0.1)
        self.wait(1.0)
        self.add_animation(power_arrow, animation=GrowArrow(power_arrow), run_time=1.0)
        self.add_animation(power_text, animation=FadeIn(power_text), run_time=1.0)

        # 拆分重组后的原子和分子
        def split_and_rearrange(water):
            o = water[0]
            h1 = water[1]
            h2 = water[2]
            return VGroup(o.copy(), h1.copy(), h2.copy())

        split_atoms1 = split_and_rearrange(water1)
        split_atoms2 = split_and_rearrange(water2)
        self.wait(1.0)
        self.add_animation(split_atoms1, animation=FadeIn(split_atoms1), run_time=0.5)
        self.add_animation(split_atoms2, animation=FadeIn(split_atoms2), run_time=0.5)
        self.add_animation(water_group, animation=FadeOut(water_group), run_time=0.5)

        # 移动原子
        target_h1 = split_atoms1[1].copy().move_to(DOWN * 1.2 + LEFT * 1.5)
        target_h2 = split_atoms1[2].copy().move_to(DOWN * 1.2 + LEFT * 0.9)
        target_h3 = split_atoms2[1].copy().move_to(DOWN * 1.2 + RIGHT * 0.9)
        target_h4 = split_atoms2[2].copy().move_to(DOWN * 1.2 + RIGHT * 1.5)
        target_o1 = split_atoms1[0].copy().move_to(DOWN * 1.2 + LEFT * 2.5)
        target_o2 = split_atoms2[0].copy().move_to(DOWN * 1.2 + RIGHT * 2.5)
        
        self.add_animation(split_atoms1[1], animation=Transform(split_atoms1[1], target_h1), run_time=2.0)
        self.add_animation(split_atoms1[2], animation=Transform(split_atoms1[2], target_h2), run_time=2.0)
        self.add_animation(split_atoms2[1], animation=Transform(split_atoms2[1], target_h3), run_time=2.0)
        self.add_animation(split_atoms2[2], animation=Transform(split_atoms2[2], target_h4), run_time=2.0)
        self.add_animation(split_atoms1[0], animation=Transform(split_atoms1[0], target_o1), run_time=2.0)
        self.add_animation(split_atoms2[0], animation=Transform(split_atoms2[0], target_o2), run_time=2.0)

        # 组合成氢分子和氧分子
        h2_1 = VGroup(target_h1, target_h2)
        h2_2 = VGroup(target_h3, target_h4)
        o2 = VGroup(target_o1, target_o2)
        h2_label1 = create_math_formula(r"H_2", font_size=24).next_to(h2_1, DOWN, buff=0.2)
        h2_label2 = create_math_formula(r"H_2", font_size=24).next_to(h2_2, DOWN, buff=0.2)
        o2_label = create_math_formula(r"O_2", font_size=24).next_to(o2, DOWN, buff=0.2)
        product_group = VGroup(h2_1, h2_2, o2, h2_label1, h2_label2, o2_label)
        self.add_animation(product_group, animation=FadeIn(product_group), run_time=1.0)

        # 化学方程式
        equation = create_math_formula(r"2H_2O \stackrel{\text{通电}}{=\!=\!=} 2H_2\uparrow + O_2\uparrow", font_size=42).shift(DOWN * 2.8)
        self.wait(1.0)
        self.add_animation(equation, animation=Create(equation), run_time=3.0)

        # 高亮系数
        coeff_h2 = equation[0][:1]
        coeff_o2 = equation[0][-6:-5]
        self.wait(1.0)
        self.add_animation(coeff_h2, animation=Indicate(coeff_h2, color=RED, scale_factor=1.3, run_time=2.0), run_time=2.0)
        self.add_animation(coeff_o2, animation=Indicate(coeff_o2, color=RED, scale_factor=1.3, run_time=2.0), run_time=2.0)
        self.wait(4.0)

        lines = [
            "从微观角度看电解水的原理",
            "通电时水分子拆分为氢氧原子",
            "氢原子两两结合为氢分子",
            "氧原子两两结合为氧分子",
            "生成氢氧气体体积比为2比1"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)

    def _page_3(self, total_pages: int) -> None:
        self.next_page(layout="center", transition=True)
        self.set_title("电解水结论总结")
        self.set_page_number(4, total_pages)

        # 缩小的化学方程式
        small_equation = create_math_formula(r"2H_2O \stackrel{\text{通电}}{=\!=\!=} 2H_2\uparrow + O_2\uparrow", font_size=28).shift(UP * 2.8)
        self.add_animation(small_equation, animation=FadeIn(small_equation), run_time=2.0)

        # 大标题
        main_title = Text("电解水实验结论", font_size=40, color=WHITE).shift(UP * 1.2)
        self.add_animation(main_title, animation=FadeIn(main_title), run_time=1.0)

        # 三条结论
        self.wait(1.0)
        self.add_text("1. 水由氢元素和氧元素组成", font_size=32, animate=True, run_time=1.0)
        self.wait(1.0)
        self.add_text("2. 化学变化中分子可分 原子不可分", font_size=32, animate=True, run_time=1.0)
        self.wait(1.0)
        self.add_text("3. 生成氢气与氧气体积比为2:1", font_size=32, animate=True, run_time=1.0)
        self.wait(7.0)

        lines = [
            "总结电解水实验的核心结论",
            "水由氢元素和氧元素组成",
            "化学变化中分子可分原子不可分",
            "生成氢氧气体体积比为2比1"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
```