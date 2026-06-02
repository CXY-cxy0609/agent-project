from __future__ import annotations

import sys
from pathlib import Path

from manim import (
    Circle,
    Rectangle,
    Line,
    Arrow,
    Text,
    VGroup,
    FadeIn,
    Indicate,
    UP,
    DOWN,
    LEFT,
    RIGHT,
    DL,
    DR,
    YELLOW,
    BLUE,
    RED,
    WHITE,
    GREEN,
    GRAY,
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
        self._page_1(total_pages)
        self._page_2(total_pages)
        self._page_3(total_pages)
        self._page_4(total_pages)

    def _page_1(self, total_pages: int) -> None:
        self.start_page(layout="left_right", column_ratio="1:1", transition=False)
        self.set_title("电解水实验装置介绍")
        self.set_page_number(1, total_pages)

        # 左侧容器：实验装置
        left_container = self.create_parent("left_container", side="left", show_boundary=False)
        
        # 构建简单的电解水装置示意图
        container = Rectangle(width=4, height=2.5, color=BLUE, stroke_opacity=0.8).move_to(left_container.get_center())
        
        # 电极
        anode = Line(start=container.get_top() + LEFT*1.2, end=container.get_bottom() + LEFT*1.2 + UP*0.5, color=GRAY)
        cathode = Line(start=container.get_top() + RIGHT*1.2, end=container.get_bottom() + RIGHT*1.2 + UP*0.5, color=GRAY)
        
        # 电源
        power_source = Rectangle(width=1.5, height=0.6, color=YELLOW, fill_opacity=0.3).next_to(container, UP, buff=0.5)
        pos_label = Text("+ 阳极", font_size=20).next_to(power_source, LEFT)
        neg_label = Text("- 阴极", font_size=20).next_to(power_source, RIGHT)
        
        # 试管
        test_tube1 = Rectangle(width=0.8, height=1.8, color=WHITE, stroke_opacity=0.7).move_to(container.get_center() + LEFT*1.2 + UP*0.2)
        test_tube2 = Rectangle(width=0.8, height=1.8, color=WHITE, stroke_opacity=0.7).move_to(container.get_center() + RIGHT*1.2 + UP*0.2)
        
        # 气体体积示意
        gas1 = Rectangle(width=0.7, height=1.2, color=BLUE, fill_opacity=0.4).move_to(test_tube1.get_center() + UP*0.1)
        gas2 = Rectangle(width=0.7, height=0.6, color=RED, fill_opacity=0.4).move_to(test_tube2.get_center() + UP*0.4)
        
        # 体积比标注
        ratio_label = create_math_formula(r"2:1", font_size=36).next_to(container, DOWN, buff=0.3)
        ratio_label.set_opacity(0)
        
        # 右侧文字说明
        self.add_text("电解水实验装置", font_size=28, side="right")
        self.add_text("电源正极连接阳极", font_size=24, side="right")
        self.add_text("电源负极连接阴极", font_size=24, side="right")
        
        # 组装装置
        apparatus_group = VGroup(container, anode, cathode, power_source, pos_label, neg_label, test_tube1, test_tube2, gas1, gas2, ratio_label)
        self.add_animation(apparatus_group, parent="left_container", animation=FadeIn(apparatus_group), run_time=2)
        
        # 高亮正极和阳极
        self.add_animation(apparatus_group, animation=Indicate(VGroup(pos_label, anode), color=YELLOW), run_time=2)
        # 高亮负极和阴极
        self.add_animation(apparatus_group, animation=Indicate(VGroup(neg_label, cathode), color=BLUE), run_time=2)
        
        # 显示体积比
        self.add_animation(apparatus_group, animation=ratio_label.animate.set_opacity(1), run_time=1)
        self.add_animation(apparatus_group, animation=Indicate(ratio_label, color=GREEN), run_time=1)
        self.add_animation(apparatus_group, animation=Indicate(ratio_label, color=GREEN), run_time=1)
        
        # 字幕
        lines = [
            "今天我们学习电解水的原理",
            "首先认识电解水实验装置",
            "连接电源正极的是阳极",
            "连接电源负极的是阴极",
            "生成气体体积比为2比1"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(5)

    def _page_2(self, total_pages: int) -> None:
        self.next_page(layout="center", transition=True)
        self.set_title("电解水微观反应过程")
        self.set_page_number(2, total_pages)
        
        # 电场方向
        field_arrow = Arrow(start=LEFT*3, end=RIGHT*3, color=YELLOW)
        field_label = Text("电场方向 正极→负极", font_size=24).next_to(field_arrow, UP)
        
        # 电极区域
        cathode_zone = Text("阴极 (-)", font_size=22).to_corner(DL)
        anode_zone = Text("阳极 (+)", font_size=22).to_corner(DR)
        
        # 简单的水分子示意（用圆形表示）
        h2o_group = VGroup()
        for i in range(3):
            o = Circle(radius=0.15, color=RED, fill_opacity=0.8).shift(UP*(1.5 - i*1.2))
            h1 = Circle(radius=0.1, color=WHITE, fill_opacity=0.8).next_to(o, LEFT, buff=0.1)
            h2 = Circle(radius=0.1, color=WHITE, fill_opacity=0.8).next_to(o, RIGHT, buff=0.1)
            h2o = VGroup(o, h1, h2)
            h2o_group.add(h2o)
        
        # 生成的气体标注
        h2_label = create_math_formula(r"H_2", font_size=36).next_to(cathode_zone, UP, buff=0.5)
        o2_label = create_math_formula(r"O_2", font_size=36).next_to(anode_zone, UP, buff=0.5)
        h2_label.set_opacity(0)
        o2_label.set_opacity(0)
        reaction_group = VGroup(field_arrow, field_label, cathode_zone, anode_zone, h2o_group, h2_label, o2_label)
        
        self.add_animation(reaction_group, animation=FadeIn(reaction_group), run_time=2)
        
        # 示意分解和移动过程（简化版）
        self.wait(3)
        
        self.add_animation(reaction_group, animation=VGroup(h2_label, o2_label).animate.set_opacity(1), run_time=2)
        
        # 字幕
        lines = [
            "通电后水分子分解为两种离子",
            "带正电的氢离子向阴极移动",
            "结合生成氢气",
            "带负电的氢氧根向阳极移动",
            "结合生成氧气"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(5)

    def _page_3(self, total_pages: int) -> None:
        self.next_page(layout="center", transition=True)
        self.set_title("电解水化学方程式")
        self.set_page_number(3, total_pages)
        
        # 中文 LaTeX 统一通过 create_formula.py 渲染。
        equation = create_math_formula(r"2H_2O \xrightarrow{\text{通电}} 2H_2 \uparrow + O_2 \uparrow", font_size=42)
        ratio_note = create_math_formula(r"H_2:O_2 = 2:1", font_size=32).next_to(equation, RIGHT, buff=0.8)
        
        # 氧化剂还原剂标注
        redox_note = create_chinese_formula(r"氧化剂：$H_2O$  还原剂：$H_2O$", font_size=28).next_to(equation, DOWN, buff=0.6)
        redox_note.set_opacity(0)
        equation_group = VGroup(equation, ratio_note, redox_note)
        
        self.add_animation(equation_group, animation=FadeIn(equation_group), run_time=2)
        
        # 高亮各部分
        self.add_animation(equation_group, animation=Indicate(equation, color=YELLOW), run_time=2)
        self.add_animation(equation_group, animation=redox_note.animate.set_opacity(1), run_time=1)
        self.add_animation(equation_group, animation=Indicate(redox_note, color=GREEN), run_time=1)
        self.add_animation(equation_group, animation=Indicate(redox_note, color=GREEN), run_time=1)
        
        # 字幕
        lines = [
            "电解水的化学方程式如下",
            "两个水分子通电生成氢氧气体",
            "水同时做氧化剂和还原剂",
            "证明水由氢氧元素组成"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(3)

    def _page_4(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1", transition=True)
        self.set_title("电解水核心考点总结")
        self.set_page_number(4, total_pages)
        
        # 左侧考点列表
        self.add_text("电解水核心考点", font_size=28, side="left")
        point1 = self.add_text("1. 正氧负氢，氢二氧一", font_size=24, side="left")
        point2 = self.add_text("2. 加入稀硫酸/氢氧化钠增强导电性", font_size=24, side="left")
        point3 = self.add_text("3. 实验结论：水由氢、氧元素组成", font_size=24, side="left")
        
        # 右侧示意图
        right_container = self.create_parent("right_container", side="right", show_boundary=False)
        
        # 简易体积比图
        tube_h2 = Rectangle(width=0.8, height=2.0, color=WHITE, stroke_opacity=0.7).move_to(right_container.get_center() + LEFT*0.8)
        tube_o2 = Rectangle(width=0.8, height=1.0, color=WHITE, stroke_opacity=0.7).move_to(right_container.get_center() + RIGHT*0.8)
        
        label_h2 = Text("负极 氢气", font_size=20).next_to(tube_h2, DOWN)
        label_o2 = Text("正极 氧气", font_size=20).next_to(tube_o2, DOWN)
        
        ratio = create_math_formula(r"2:1", font_size=36).move_to(right_container.get_center())
        
        diagram_group = VGroup(tube_h2, tube_o2, label_h2, label_o2, ratio)
        
        self.add_animation(diagram_group, animation=FadeIn(diagram_group), run_time=2)
        
        # 高亮对应考点
        self.add_animation(point1, animation=Indicate(VGroup(point1, diagram_group), color=YELLOW), run_time=2)
        self.add_animation(point2, animation=Indicate(point2, color=BLUE), run_time=2)
        self.add_animation(point3, animation=Indicate(point3, color=GREEN), run_time=2)
        
        # 字幕
        lines = [
            "电解水核心考点总结",
            "记住正氧负氢氢二氧一",
            "加电解质增强溶液导电性",
            "证明水由氢氧元素组成"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(2)
