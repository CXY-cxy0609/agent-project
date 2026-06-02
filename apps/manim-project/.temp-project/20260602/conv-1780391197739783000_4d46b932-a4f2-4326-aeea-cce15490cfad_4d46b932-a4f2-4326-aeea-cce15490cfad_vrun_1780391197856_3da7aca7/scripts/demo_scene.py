"""Rich animation demo: Kepler's three laws."""

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
    GrowArrow,
    Indicate,
    LEFT,
    Line,
    ORANGE,
    PURPLE,
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

BASE_DIR = Path(__file__).resolve().parents[4]
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))
if str(BASE_DIR / "function-tools") not in sys.path:
    sys.path.append(str(BASE_DIR / "function-tools"))

from BaseScene import BaseScene
from create_formula import create_math_formula


class LessonPageDemo(BaseScene):
    """Kepler laws scene with layered animation effects."""

    show_layout_guides = False
    subtitle_rect_down_shift = 0.12
    content_subtitle_gap = 0.16

    def construct(self) -> None:
        total_pages = 5
        self._page_1_intro(total_pages)
        self._page_2_first_law(total_pages)
        self._page_3_second_law(total_pages)
        self._page_4_third_law(total_pages)
        self._page_5_summary(total_pages)

    def _page_1_intro(self, total_pages: int) -> None:
        self.start_page(layout="center", transition=False)
        self.set_title("开普勒三定律速学")
        self.set_page_number(1, total_pages)

        self.add_text("开普勒用行星观测数据，总结出轨道运动三条规律。", font_size=33)
        self.add_text("它们解释了行星如何绕太阳运行，是经典天体力学基础。", font_size=33)

        sun = Circle(radius=0.18, color=YELLOW, fill_opacity=0.9).shift(DOWN * 1.0)
        orbit = Circle(radius=1.8, color=BLUE, stroke_opacity=0.8).shift(DOWN * 1.0)
        planet = Circle(radius=0.1, color=GREEN, fill_opacity=0.9).move_to(orbit.get_right())
        tangent = Arrow(
            planet.get_center(),
            planet.get_center() + UP * 0.55,
            buff=0.05,
            color=ORANGE,
        )
        gravity = Arrow(
            planet.get_center(),
            sun.get_center() + RIGHT * 0.1,
            buff=0.05,
            color=RED,
        )
        f_label = create_math_formula(r"\vec{F}\propto\frac{1}{r^2}", font_size=42).next_to(orbit, DOWN, buff=0.15)
        visual_group = VGroup(
            sun,
            orbit,
            planet,
            tangent,
            gravity,
            f_label,
        )

        self.add_animation(visual_group, animation=[FadeIn(sun), Create(orbit)], run_time=0.7)
        self.add_animation(visual_group, animation=FadeIn(planet), run_time=0.4)
        self.add_animation(visual_group, animation=[GrowArrow(tangent), GrowArrow(gravity)], run_time=0.65)
        self.add_animation(
            visual_group,
            animation=[Indicate(sun, color=YELLOW), Indicate(planet, color=GREEN), FadeIn(f_label)],
            run_time=0.7,
        )
        self.add_animation(
            visual_group,
            animation=[planet.animate.shift(UP * 0.08), planet.animate.shift(DOWN * 0.08)],
            run_time=0.55,
            play_kwargs={"rate_func": there_and_back},
        )

        lines = [
            "开普勒三定律描述了行星绕太阳运动的几何与时间规律。",
            "它们最初来自大量天文观测，并非从理论假设直接推出。",
            "接下来我们按第一、第二、第三定律依次讲清楚。",
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.08)

    def _page_2_first_law(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:2")
        self.set_title("1) 第一定律：椭圆轨道定律")
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

        self.add_text("行星轨道是椭圆，太阳位于椭圆的一个焦点。", parent="left_notes", font_size=30)
        self.add_text("轨道最近点是近日点，最远点是远日点。", parent="left_notes", font_size=30)
        self.add_text("这意味着行星到太阳距离会周期变化。", parent="left_notes", font_size=30)

        orbit = Circle(radius=2.0, color=BLUE, stroke_opacity=0.8).stretch(0.65, 0)
        focus_1 = Circle(radius=0.07, color=YELLOW, fill_opacity=1).move_to(LEFT * 0.95)
        focus_2 = Circle(radius=0.05, color=PURPLE, fill_opacity=0.85).move_to(RIGHT * 0.95)
        sun_label = Text("太阳(焦点)", font=self.default_font, font_size=22, color=YELLOW).next_to(focus_1, DOWN, buff=0.12)
        planet = Circle(radius=0.1, color=GREEN, fill_opacity=0.9).move_to(orbit.get_right())
        peri = Text("近日点", font=self.default_font, font_size=22, color=GREEN).next_to(orbit.get_right(), RIGHT, buff=0.1)
        aphe = Text("远日点", font=self.default_font, font_size=22, color=GREEN).next_to(orbit.get_left(), LEFT, buff=0.1)
        law_formula = create_math_formula(r"\text{Orbit is ellipse}", font_size=40).next_to(orbit, UP, buff=0.25)

        visual_group = VGroup(
            orbit,
            focus_1,
            focus_2,
            sun_label,
            planet,
            peri,
            aphe,
            law_formula,
        )
        self.add_animation(visual_group, parent="right_canvas", animation=Create(orbit), run_time=0.8)
        self.add_animation(visual_group, animation=[FadeIn(focus_1), FadeIn(focus_2), FadeIn(sun_label)], run_time=0.7)
        self.add_animation(visual_group, animation=FadeIn(planet), run_time=0.45)
        self.add_animation(visual_group, animation=[FadeIn(peri), FadeIn(aphe), FadeIn(law_formula)], run_time=0.75)
        self.add_animation(
            visual_group,
            animation=[planet.animate.move_to(orbit.point_from_proportion(0.15))],
            run_time=0.55,
            play_kwargs={"rate_func": there_and_back},
        )
        self.add_animation(
            visual_group,
            animation=[
                Flash(focus_1.get_center(), color=YELLOW, flash_radius=0.2),
                Indicate(orbit, color=BLUE, scale_factor=1.02),
                Indicate(planet, color=GREEN, scale_factor=1.15),
            ],
            run_time=0.8,
        )

        lines = [
            "第一定律告诉我们，行星不会绕太阳做完美圆周运动。",
            "真实轨道是椭圆，而且太阳只在其中一个焦点。",
            "因此行星与太阳的距离会在一个周期内不断变化。",
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.08)

    def _page_3_second_law(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:2")
        self.set_title("2) 第二定律：面积速度定律")
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

        self.add_text("在相等时间内，行星与太阳连线扫过面积相等。", parent="left_notes", font_size=30)
        self.add_text("靠近太阳时行星更快，远离太阳时更慢。", parent="left_notes", font_size=30)
        self.add_text("速度变化保证面积速度保持常量。", parent="left_notes", font_size=30)

        sun = Circle(radius=0.16, color=YELLOW, fill_opacity=0.95).shift(LEFT * 0.95)
        orbit = Circle(radius=2.0, color=BLUE, stroke_opacity=0.8).stretch(0.65, 0)
        p1 = orbit.point_from_proportion(0.08)
        p2 = orbit.point_from_proportion(0.20)
        p3 = orbit.point_from_proportion(0.56)
        p4 = orbit.point_from_proportion(0.67)
        r1 = Line(sun.get_center(), p1, color=GREEN)
        r2 = Line(sun.get_center(), p2, color=GREEN)
        r3 = Line(sun.get_center(), p3, color=ORANGE)
        r4 = Line(sun.get_center(), p4, color=ORANGE)
        area_near = VGroup(r1, r2)
        area_far = VGroup(r3, r4)
        near_tag = Text("近日点区间", font=self.default_font, font_size=22, color=GREEN).move_to((p1 + p2) / 2 + UP * 0.55)
        far_tag = Text("远日点区间", font=self.default_font, font_size=22, color=ORANGE).move_to((p3 + p4) / 2 + DOWN * 0.55)
        equal_text = Text("相等时间 -> 相等面积", font=self.default_font, font_size=26, color=YELLOW).next_to(orbit, DOWN, buff=0.22)

        law_group = VGroup(
            orbit,
            sun,
            r1,
            r2,
            r3,
            r4,
            near_tag,
            far_tag,
            equal_text,
        )

        self.add_animation(law_group, parent="right_canvas", animation=[Create(orbit), FadeIn(sun)], run_time=0.75)
        self.add_animation(law_group, animation=[Create(r1), Create(r2), FadeIn(near_tag)], run_time=0.7)
        self.add_animation(law_group, animation=[Create(r3), Create(r4), FadeIn(far_tag)], run_time=0.7)
        self.add_animation(
            law_group,
            animation=[
                ShowPassingFlash(area_near.copy().set_color(GREEN), time_width=0.3),
                ShowPassingFlash(area_far.copy().set_color(ORANGE), time_width=0.3),
                FadeIn(equal_text),
            ],
            run_time=0.85,
        )
        self.add_animation(
            law_group,
            animation=[Indicate(near_tag, color=GREEN), Indicate(far_tag, color=ORANGE)],
            run_time=0.55,
        )

        lines = [
            "第二定律强调的是时间与面积之间的关系。",
            "在同样时长里，近日点与远日点扫过的面积相同。",
            "这意味着行星近日点快、远日点慢，但面积速度恒定。",
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.08)

    def _page_4_third_law(self, total_pages: int) -> None:
        self.next_page(layout="center")
        self.set_title("3) 第三定律：周期与轨道半径关系")
        self.set_page_number(4, total_pages)

        self.add_text("行星公转周期 T 的平方与轨道长半轴 a 的立方成正比。", font_size=31)
        self.add_text("离太阳越远，公转周期越长。", font_size=31)

        axis_x = Line(LEFT * 2.7 + DOWN * 1.25, RIGHT * 2.7 + DOWN * 1.25, color=BLUE)
        axis_y = Line(LEFT * 2.7 + DOWN * 1.25, LEFT * 2.7 + UP * 1.7, color=BLUE)
        bar_1 = Rectangle(width=0.7, height=0.65, color=GREEN, fill_opacity=0.35, stroke_opacity=0.85).move_to(LEFT * 1.9 + DOWN * 0.93)
        bar_2 = Rectangle(width=0.7, height=1.25, color=YELLOW, fill_opacity=0.35, stroke_opacity=0.85).move_to(LEFT * 0.4 + DOWN * 0.63)
        bar_3 = Rectangle(width=0.7, height=2.05, color=ORANGE, fill_opacity=0.35, stroke_opacity=0.85).move_to(RIGHT * 1.1 + DOWN * 0.23)
        bar_labels = VGroup(
            Text("内行星", font=self.default_font, font_size=22, color=GREEN).next_to(bar_1, DOWN, buff=0.12),
            Text("中间轨道", font=self.default_font, font_size=22, color=YELLOW).next_to(bar_2, DOWN, buff=0.12),
            Text("外行星", font=self.default_font, font_size=22, color=ORANGE).next_to(bar_3, DOWN, buff=0.12),
        )
        formula = create_math_formula(r"\frac{T^2}{a^3}=k", font_size=56).shift(RIGHT * 2.25 + UP * 1.0)
        factor_group = VGroup(axis_x, axis_y, bar_1, bar_2, bar_3, bar_labels, formula).shift(DOWN * 0.55)

        self.add_animation(factor_group, animation=[Create(axis_x), Create(axis_y)], run_time=0.65)
        self.add_animation(
            factor_group,
            animation=[FadeIn(bar_1), FadeIn(bar_2), FadeIn(bar_3), FadeIn(bar_labels)],
            run_time=0.75,
        )
        self.add_animation(
            factor_group,
            animation=[Indicate(bar_1, color=GREEN), Indicate(bar_2, color=YELLOW), Indicate(bar_3, color=ORANGE)],
            run_time=0.75,
        )
        self.add_animation(factor_group, animation=[FadeIn(formula), Flash(formula.get_center(), color=YELLOW, flash_radius=0.35)], run_time=0.7)

        lines = [
            "第三定律给出不同轨道之间的统一比例关系。",
            "轨道长半轴越大，公转周期增长会更明显。",
            "它帮助我们快速比较不同天体系统的轨道时间尺度。",
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.08)

    def _page_5_summary(self, total_pages: int) -> None:
        self.next_page(layout="center")
        self.set_title("4) 小结")
        self.set_page_number(5, total_pages)

        self.add_text("第一定律：轨道是椭圆，太阳在焦点。", font_size=31)
        self.add_text("第二定律：等时扫过等面积。", font_size=31)
        self.add_text("第三定律：T^2 与 a^3 成正比。", font_size=31)

        key_1 = Text("几何轨道", font=self.default_font, font_size=34, color=GREEN).shift(LEFT * 3.2 + DOWN * 1.45)
        key_2 = Text("时间规律", font=self.default_font, font_size=34, color=YELLOW).shift(DOWN * 1.45)
        key_3 = Text("比例定律", font=self.default_font, font_size=34, color=PURPLE).shift(RIGHT * 3.2 + DOWN * 1.45)
        connector_1 = Line(key_1.get_right(), key_2.get_left(), color=BLUE, stroke_opacity=0.7)
        connector_2 = Line(key_2.get_right(), key_3.get_left(), color=BLUE, stroke_opacity=0.7)
        summary_group = VGroup(key_1, key_2, key_3, connector_1, connector_2)

        self.add_animation(summary_group, animation=[FadeIn(key_1), FadeIn(key_2), FadeIn(key_3)], run_time=0.7)
        self.add_animation(summary_group, animation=[Create(connector_1), Create(connector_2)], run_time=0.65)
        self.add_animation(
            summary_group,
            animation=[Indicate(key_1, color=GREEN), Indicate(key_2, color=YELLOW), Indicate(key_3, color=PURPLE)],
            run_time=0.75,
        )

        lines = [
            "开普勒三定律把行星轨道的形状、速度和周期关系连接在一起。",
            "它们是后续万有引力理论与航天轨道计算的重要基础。",
            "掌握这三条规律，就建立了天体轨道分析的核心框架。",
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.08)
