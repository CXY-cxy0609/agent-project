from __future__ import annotations

import sys
from pathlib import Path
import numpy as np

from manim import (
    Circle, VGroup, FadeIn, Create, UP, DOWN, LEFT, RIGHT, ORIGIN,
    YELLOW, BLUE, WHITE, Text, Ellipse, Line, Arrow,
    Polygon, FadeOut, MoveToTarget, Rotating, ValueTracker,
    UpdateFromAlpha, always_redraw, Transform, Dot, GREEN
)

BASE_DIR = Path(__file__).resolve().parents[4]
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))
if str(BASE_DIR / "function-tools") not in sys.path:
    sys.path.append(str(BASE_DIR / "function-tools"))

from BaseScene import BaseScene
from create_formula import create_math_formula, create_chinese_formula


class KeplerLawsScene(BaseScene):

    show_layout_guides = False
    subtitle_rect_down_shift = 0.12

    def construct(self) -> None:
        total_pages = 5
        self._page_0(total_pages)
        self._page_1(total_pages)
        self._page_2(total_pages)
        self._page_3(total_pages)
        self._page_4(total_pages)

    def _page_0(self, total_pages: int) -> None:
        self.start_page(layout="center", transition=False)
        self.set_title("开普勒三定律概述")
        self.set_page_number(1, total_pages)

        sun = Circle(radius=0.3, color=YELLOW, fill_opacity=0.9)
        orbits = VGroup(*[
            Circle(radius=0.8 + i * 0.6, color=WHITE, stroke_opacity=0.3)
            for i in range(4)
        ])
        solar_system = VGroup(sun, orbits)

        self.add_animation(solar_system, animation=FadeIn(solar_system), run_time=1.5)
        self.wait(1.0)

        title = Text("开普勒行星运动三定律", font_size=56)
        self.add_animation(title, animation=title.animate.scale(1.1).scale(1/1.1), run_time=0.8)
        self.wait(1.0)

        subtitle = Text("由天文学家开普勒观测总结得出", font_size=32)
        subtitle.next_to(title, DOWN, buff=0.5)
        self.add_animation(subtitle, animation=FadeIn(subtitle), run_time=0.8)

        lines = [
            "今天我们学习开普勒行星运动三定律",
            "由开普勒通过观测数据总结得出"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(4.0)

    def _page_1(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1")
        self.set_title("开普勒第一定律（椭圆定律）")
        self.set_page_number(2, total_pages)

        left_parent = self.create_parent("left", side="left")
        a, b = 3.0, 2.0
        c = (a**2 - b**2)**0.5
        ellipse = Ellipse(width=2*a, height=2*b, color=BLUE, stroke_opacity=0.8)
        f1 = Dot(color=WHITE).shift(LEFT * c)
        f2 = Dot(color=YELLOW).shift(RIGHT * c)
        f1_label = create_math_formula(r"F_1", font_size=36).next_to(f1, DOWN)
        f2_label = create_math_formula(r"F_2", font_size=36).next_to(f2, DOWN)
        sun_label = Text("太阳（焦点）", font_size=24).next_to(f2, UP)
        sun = Circle(radius=0.2, color=YELLOW, fill_opacity=0.9).move_to(f2)
        planet = Circle(radius=0.12, color=BLUE, fill_opacity=0.9)
        planet.move_to(ellipse.get_start())
        planet_label = Text("行星", font_size=24).next_to(planet, UP)

        left_group = VGroup(ellipse, f1, f2, f1_label, f2_label, sun_label, sun, planet, planet_label)
        left_group.move_to(left_parent.get_center())

        self.add_animation(ellipse, animation=Create(ellipse), side="left", run_time=1.0)
        self.add_animation(f1, animation=FadeIn(f1), side="left", run_time=0.3)
        self.add_animation(f2, animation=FadeIn(f2), side="left", run_time=0.3)
        self.add_animation(f1_label, animation=FadeIn(f1_label), side="left", run_time=0.3)
        self.add_animation(f2_label, animation=FadeIn(f2_label), side="left", run_time=0.3)
        self.add_animation(sun, animation=FadeIn(sun), side="left", run_time=0.3)
        self.add_animation(sun_label, animation=FadeIn(sun_label), side="left", run_time=0.3)
        self.add_animation(planet, animation=FadeIn(planet), side="left", run_time=0.3)
        self.add_animation(planet_label, animation=FadeIn(planet_label), side="left", run_time=0.3)

        planet.save_state()
        self.add_animation(planet, animation=Rotating(planet, about_point=ORIGIN, run_time=8.0, rate_func=linear), side="left")

        right_parent = self.create_parent("right", side="right")
        self.add_text("第一定律 椭圆定律", font_size=36, side="right")
        self.wait(0.5)
        self.add_text("所有行星绕太阳运行的轨道都是椭圆", font_size=28, side="right")
        self.wait(0.5)
        self.add_text("太阳处在椭圆的一个焦点上", font_size=28, side="right")

        lines = [
            "第一定律也叫椭圆定律",
            "行星绕太阳运行轨道是椭圆",
            "太阳处在椭圆的一个焦点上"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(3.0)

    def _page_2(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1")
        self.set_title("开普勒第二定律（面积定律）")
        self.set_page_number(3, total_pages)

        a, b = 3.0, 2.0
        c = (a**2 - b**2)**0.5
        ellipse = Ellipse(width=2*a, height=2*b, color=BLUE, stroke_opacity=0.8)
        sun_pos = RIGHT * c
        sun = Circle(radius=0.2, color=YELLOW, fill_opacity=0.9).move_to(sun_pos)
        perihelion = ellipse.get_right()
        aphelion = ellipse.get_left()
        perihelion_label = Text("近日点", font_size=24).next_to(perihelion, RIGHT)
        aphelion_label = Text("远日点", font_size=24).next_to(aphelion, LEFT)

        left_group = VGroup(ellipse, sun, perihelion_label, aphelion_label)
        left_parent = self.create_parent("left", side="left")
        left_group.move_to(left_parent.get_center())

        self.add_animation(ellipse, animation=Create(ellipse), side="left", run_time=0.8)
        self.add_animation(sun, animation=FadeIn(sun), side="left", run_time=0.3)
        self.add_animation(perihelion_label, animation=FadeIn(perihelion_label), side="left", run_time=0.3)
        self.add_animation(aphelion_label, animation=FadeIn(aphelion_label), side="left", run_time=0.3)

        planet = Circle(radius=0.12, color=BLUE, fill_opacity=0.9)
        planet.move_to(perihelion)

        def get_sector(start_angle, end_angle, num_points=20):
            points = [sun_pos]
            for i in range(num_points + 1):
                angle = start_angle + (end_angle - start_angle) * i / num_points
                x = a * np.cos(angle)
                y = b * np.sin(angle)
                points.append(UP * y + RIGHT * x)
            return Polygon(*points, color=BLUE, fill_opacity=0.3)

        sector1 = get_sector(0, np.pi/3)
        sector2 = get_sector(np.pi/3, 2*np.pi/3)
        sector3 = get_sector(2*np.pi/3, np.pi)
        area_label = Text("相等时间扫过面积相等", font_size=22).move_to(UP * 2.5)

        self.add_animation(planet, animation=FadeIn(planet), side="left", run_time=0.3)
        self.add_animation(sector1, animation=FadeIn(sector1), side="left", run_time=0.5)
        self.add_animation(sector2, animation=FadeIn(sector2), side="left", run_time=0.5)
        self.add_animation(sector3, animation=FadeIn(sector3), side="left", run_time=0.5)
        self.add_animation(area_label, animation=FadeIn(area_label), side="left", run_time=0.5)

        self.add_text("第二定律 面积定律", font_size=36, side="right")
        self.wait(0.5)
        self.add_text("行星与太阳的连线相等时间扫过相等面积", font_size=26, side="right")
        self.wait(0.5)
        self.add_text("近日点速度快 远日点速度慢", font_size=26, side="right")

        lines = [
            "第二定律也叫面积定律",
            "行星与太阳连线相等时间扫过相等面积",
            "近日点速度快 远日点速度慢"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(3.0)

    def _page_3(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1")
        self.set_title("开普勒第三定律（周期定律）")
        self.set_page_number(4, total_pages)

        a1, b1 = 2.0, 1.5
        a2, b2 = 3.0, 2.0
        ellipse1 = Ellipse(width=2*a1, height=2*b1, color=BLUE, stroke_opacity=0.8)
        ellipse2 = Ellipse(width=2*a2, height=2*b2, color=GREEN, stroke_opacity=0.8)
        sun1_pos = RIGHT * ((a1**2 - b1**2)**0.5)
        sun2_pos = RIGHT * ((a2**2 - b2**2)**0.5)
        sun = Circle(radius=0.2, color=YELLOW, fill_opacity=0.9).move_to(sun1_pos)
        planet1 = Circle(radius=0.1, color=BLUE, fill_opacity=0.9).move_to(ellipse1.get_right())
        planet2 = Circle(radius=0.1, color=GREEN, fill_opacity=0.9).move_to(ellipse2.get_right())

        a1_line = Line(LEFT * a1, RIGHT * a1, color=BLUE, stroke_opacity=0.6)
        a2_line = Line(LEFT * a2, RIGHT * a2, color=GREEN, stroke_opacity=0.6)
        a1_label = create_math_formula(r"a_1", font_size=32, color=BLUE).next_to(a1_line, DOWN)
        a2_label = create_math_formula(r"a_2", font_size=32, color=GREEN).next_to(a2_line, DOWN)

        left_group = VGroup(ellipse1, ellipse2, sun, planet1, planet2, a1_line, a2_line, a1_label, a2_label)
        left_parent = self.create_parent("left", side="left")
        left_group.move_to(left_parent.get_center())

        self.add_animation(ellipse1, animation=Create(ellipse1), side="left", run_time=0.6)
        self.add_animation(ellipse2, animation=Create(ellipse2), side="left", run_time=0.6)
        self.add_animation(a1_line, animation=Create(a1_line), side="left", run_time=0.4)
        self.add_animation(a2_line, animation=Create(a2_line), side="left", run_time=0.4)
        self.add_animation(a1_label, animation=FadeIn(a1_label), side="left", run_time=0.3)
        self.add_animation(a2_label, animation=FadeIn(a2_label), side="left", run_time=0.3)
        self.add_animation(sun, animation=FadeIn(sun), side="left", run_time=0.3)
        self.add_animation(planet1, animation=FadeIn(planet1), side="left", run_time=0.3)
        self.add_animation(planet2, animation=FadeIn(planet2), side="left", run_time=0.3)

        self.add_text("第三定律 周期定律", font_size=36, side="right")
        self.wait(0.5)
        formula = create_math_formula(r"a^3/T^2=k", font_size=48)
        self.add_animation(formula, animation=FadeIn(formula), side="right", run_time=0.8)
        self.wait(0.5)
        self.add_text("a为半长轴 T为公转周期 k为常量", font_size=24, side="right")
        self.wait(0.5)
        self.add_text("半长轴越大 公转周期越长", font_size=26, side="right")

        lines = [
            "第三定律也叫周期定律",
            "半长轴三次方与周期二次方比值为常量",
            "半长轴越大 公转周期越长"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(3.0)

    def _page_4(self, total_pages: int) -> None:
        self.next_page(layout="center")
        self.set_title("开普勒三定律总结")
        self.set_page_number(5, total_pages)

        point1 = Text("1. 椭圆定律：轨道为椭圆 太阳在焦点", font_size=32)
        point2 = Text("2. 面积定律：相等时间扫过相等面积", font_size=32)
        point3 = Text("3. 周期定律：a³/T²=k", font_size=32)

        points = VGroup(point1, point2, point3).arrange(DOWN, buff=0.8)
        points.move_to(ORIGIN)

        self.add_animation(point1, animation=point1.animate.shift(UP * 0.5).shift(DOWN * 0.5), run_time=0.6)
        self.wait(0.3)
        self.add_animation(point2, animation=point2.animate.shift(UP * 0.5).shift(DOWN * 0.5), run_time=0.6)
        self.wait(0.3)
        self.add_animation(point3, animation=point3.animate.shift(UP * 0.5).shift(DOWN * 0.5), run_time=0.6)

        lines = [
            "以上就是开普勒三定律的全部内容",
            "为万有引力定律发现打下重要基础",
            "大家一定要牢牢掌握"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)
        self.wait(4.0)

        self.add_animation(points, animation=FadeOut(points), run_time=1.0)
