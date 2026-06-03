```python
from __future__ import annotations

import sys
from pathlib import Path

from manim import (
    VGroup, Text, Circle, FadeIn, Create, Indicate, Line, DashedLine, Polygon, Dot,
    ORIGIN, RIGHT, UP, DOWN, LEFT, YELLOW, BLUE, RED, GREEN, ORANGE, WHITE, GRAY,
    MathTex, FadeOut, Transform, Flash, SurroundingRectangle
)

BASE_DIR = Path(__file__).resolve().parents[4]
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))
if str(BASE_DIR / "function-tools") not in sys.path:
    sys.path.append(str(BASE_DIR / "function-tools"))

from BaseScene import BaseScene
from create_formula import create_math_formula, create_chinese_formula


class SolidGeometryExam(BaseScene):
    show_layout_guides = False
    subtitle_rect_down_shift = 0.12
    background_color = "#F0F2F5"
    default_color = "#1A1A2E"

    def construct(self) -> None:
        total_pages = 5
        self._page_0(total_pages)
        self._page_1(total_pages)
        self._page_2(total_pages)
        self._page_3(total_pages)
        self._page_4(total_pages)

    def _project_3d_to_2d(self, point_3d, origin=ORIGIN):
        x, y, z = point_3d
        y_vec = 0.5 * RIGHT - 0.3 * UP
        return origin + x * 0.8 * RIGHT + y * y_vec + z * 0.8 * UP

    def _create_prism_base(self):
        # 3D coordinates for the prism
        d_3d = (0, 0, 0)
        a_3d = (2, 0, 0)
        b_3d = (1, 1.732, 0)  # √3 ≈1.732
        c_3d = (3, 1.732, 0)
        d1_3d = (0, 0, 4)
        a1_3d = (2, 0, 4)
        b1_3d = (1, 1.732, 4)
        c1_3d = (3, 1.732, 4)
        e_3d = (2, 1.732, 0)
        m_3d = (1, 1.732, 2)
        n_3d = (1, 0, 2)

        points_3d = {
            "D": d_3d, "A": a_3d, "B": b_3d, "C": c_3d,
            "D1": d1_3d, "A1": a1_3d, "B1": b1_3d, "C1": c1_3d,
            "E": e_3d, "M": m_3d, "N": n_3d
        }

        origin_shift = DOWN * 0.5 + RIGHT * 0.5
        points_2d = {k: self._project_3d_to_2d(v, origin_shift) for k, v in points_3d.items()}

        # Create edges
        visible_edges = [
            ("D", "A"), ("A", "B"), ("B", "C"),
            ("A", "A1"), ("B", "B1"), ("C", "C1"), ("D", "D1"),
            ("A1", "B1"), ("B1", "C1"), ("C1", "D1"), ("D1", "A1")
        ]
        hidden_edges = [("C", "D"), ("C", "C1")]  # Adjusted for better visibility

        edges = {}
        edge_vgroup = VGroup()
        for start, end in visible_edges:
            line = Line(points_2d[start], points_2d[end], color="#1A1A2E", stroke_width=3)
            edges[f"{start}{end}"] = line
            edge_vgroup.add(line)
        for start, end in hidden_edges:
            line = DashedLine(points_2d[start], points_2d[end], color=GRAY, stroke_width=2)
            edges[f"{start}{end}"] = line
            edge_vgroup.add(line)

        # Create vertices and labels
        vertex_vgroup = VGroup()
        vertices = {}
        for name, pos in points_2d.items():
            dot = Dot(pos, color="#1A1A2E", radius=0.06)
            vertices[name] = dot
            vertex_vgroup.add(dot)
            # Adjust label positions
            label_offset = {
                "D": DOWN + LEFT, "A": DOWN + LEFT, "B": UP + RIGHT, "C": UP + RIGHT,
                "D1": UP + LEFT, "A1": UP + LEFT, "B1": UP + RIGHT, "C1": UP + RIGHT,
                "E": DOWN, "M": RIGHT, "N": LEFT
            }
            label = Text(name, font_size=18, color="#1A1A2E").next_to(pos, label_offset.get(name, UP))
            vertex_vgroup.add(label)

        return VGroup(edge_vgroup, vertex_vgroup), points_2d, edges, vertices

    def _page_0(self, total_pages: int) -> None:
        self.start_page(layout="center", transition=False)
        self.set_title("课程导入", font_size=32)
        self.set_page_number(1, total_pages)

        main_title = Text("立体几何真题精讲", font_size=56, color="#165DFF", weight="BOLD")
        subtitle = Text("直四棱柱线面平行与二面角计算", font_size=28, color=GRAY)
        title_group = VGroup(main_title, subtitle).arrange(DOWN, buff=0.6)

        self.add_animation(title_group, animation=[
            FadeIn(main_title, run_time=1),
            FadeIn(subtitle.shift(DOWN * 0.3), run_time=0.8)
        ])

        self.speak_with_subtitles([
            "同学们好",
            "今天讲解立体几何经典真题",
            "涵盖线面平行和二面角考点"
        ], subtitle_font_size=28, pause_between=0.08)
        self.wait(0.5)

    def _page_1(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1")
        self.set_title("原题展示", font_size=32)
        self.set_page_number(2, total_pages)

        # Left side: problem text
        problem_text = """9. 如图，直四棱柱ABCD-A₁B₁C₁D₁的底面是菱形，AA₁=4，AB=2，∠BAD=60°，E，M，N分别是BC，BB₁，A₁D的中点。
（1）证明：MN ∥ 平面C₁DE；
（2）求二面角A-MA₁-N的正弦值。"""
        self.add_text(problem_text, font_size=22, side="left", line_spacing=0.8)

        # Right side: prism diagram
        prism_base, points_2d, edges, vertices = self._create_prism_base()
        right_group = VGroup(prism_base)
        self.add_animation(right_group, side="right", animation=FadeIn(prism_base, run_time=1))

        # Highlight E, M, N
        highlight_dots = VGroup()
        for name in ["E", "M", "N"]:
            hd = Dot(points_2d[name], color=RED, radius=0.12)
            highlight_dots.add(hd)
        right_group.add(highlight_dots)

        self.add_animation(right_group, animation=[
            Indicate(highlight_dots[0], color=RED, run_time=0.5),
            Indicate(highlight_dots[1], color=RED, run_time=0.5),
            Indicate(highlight_dots[2], color=RED, run_time=0.5)
        ])

        self.speak_with_subtitles([
            "直四棱柱底面为菱形",
            "AA1=4 AB=2 ∠BAD=60°",
            "E M N分别为对应边中点",
            "第一问证明MN平行平面C1DE",
            "第二问求二面角A-MA1-N正弦值"
        ], subtitle_font_size=28, pause_between=0.08)
        self.wait(0.5)

    def _page_2(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1")
        self.set_title("第一问 线面平行证明", font_size=32)
        self.set_page_number(3, total_pages)

        # Left side: proof steps
        step1 = "1. 连接ME，由中点性质得ME ∥ B₁C，ME = ½ B₁C"
        step2 = "2. 直四棱柱中A₁B₁ ∥ DC且A₁B₁ = DC，故A₁D ∥ B₁C"
        step3 = "3. N为A₁D中点，推导得MN ∥ DE"
        step4 = "4. DE⊂平面C₁DE，MN⊄平面C₁DE，故MN ∥ 平面C₁DE"
        left_text = "\n\n".join([step1, step2, step3, step4])
        self.add_text(left_text, font_size=22, side="left", line_spacing=0.9)

        # Right side: annotated prism
        prism_base, points_2d, edges, vertices = self._create_prism_base()
        right_group = VGroup(prism_base)

        # Create helper elements
        me = Line(points_2d["M"], points_2d["E"], color=ORANGE, stroke_width=4)
        b1c = DashedLine(points_2d["B1"], points_2d["C"], color=ORANGE, stroke_width=3)
        a1d = Line(points_2d["A1"], points_2d["D"], color=ORANGE, stroke_width=3)
        mn = Line(points_2d["M"], points_2d["N"], color=BLUE, stroke_width=4)
        de = Line(points_2d["D"], points_2d["E"], color=GREEN, stroke_width=4)
        plane_c1de = Polygon(points_2d["C1"], points_2d["D"], points_2d["E"], color=RED, fill_opacity=0.2, stroke_opacity=0)

        helper_elements = VGroup(me, b1c, a1d, mn, de, plane_c1de)
        helper_elements.set_opacity(0)
        right_group.add(helper_elements)

        self.add_animation(right_group, side="right", animation=FadeIn(prism_base, run_time=0.5))

        # Animate steps
        self.add_animation(right_group, animation=[
            helper_elements[0:2].animate.set_opacity(1),
            Indicate(helper_elements[0:2], color=ORANGE, run_time=0.8)
        ])
        self.wait(0.3)
        self.add_animation(right_group, animation=[
            helper_elements[2].animate.set_opacity(1),
            Indicate(helper_elements[2], color=ORANGE, run_time=0.8)
        ])
        self.wait(0.3)
        self.add_animation(right_group, animation=[
            helper_elements[3:5].animate.set_opacity(1),
            Flash(helper_elements[3], color=BLUE, line_length=0.2, num_lines=8, flash_radius=0.3),
            Flash(helper_elements[4], color=GREEN, line_length=0.2, num_lines=8, flash_radius=0.3)
        ])
        self.wait(0.3)
        self.add_animation(right_group, animation=[
            helper_elements[5].animate.set_opacity(1),
            Indicate(helper_elements[5], color=RED, run_time=1)
        ])

        self.speak_with_subtitles([
            "第一问核心是证明线线平行",
            "连接ME 可得ME平行B1C",
            "直四棱柱中A1D平行B1C",
            "可推出MN平行于DE",
            "DE在平面内 MN不在平面内",
            "所以MN平行于平面C1DE"
        ], subtitle_font_size=28, pause_between=0.08)
        self.wait(0.5)

    def _page_3(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1")
        self.set_title("第二问 二面角计算", font_size=32)
        self.set_page_number(4, total_pages)

        # Left side: calculation steps
        step1 = create_chinese_formula(r"1. 建立坐标系：以D为原点，DA为x轴，底面垂直DA为y轴，DD₁为z轴", font_size=20, color="#1A1A2E")
        step2 = create_chinese_formula(r"2. 各点坐标：$A(2,0,0)$、$A_1(2,0,4)$、$M(1,\sqrt{3},2)$、$N(1,0,2)$", font_size=20, color="#1A1A2E")
        step3 = create_chinese_formula(r"3. 面$AMA_1$法向量$\boxed{n_1}=(\sqrt{3},1,0)$，面$MA_1N$法向量$\boxed{n_2}=(0,1,\sqrt{3})$", font_size=20, color="#1A1A2E")
        step4 = create_math_formula(r"4. \cos\theta=\frac{|\boxed{n_1}\cdot\boxed{n_2}|}{|\boxed{n_1}||\boxed{n_2}|}=\frac{1}{4}", font_size=24, color="#1A1A2E")
        step5 = create_math_formula(r"5. \sin\theta=\sqrt{1-\frac{1}{16}}=\frac{\sqrt{15}}{4}", font_size=28, color="#165DFF")
        left_group = VGroup(step1, step2, step3, step4, step5).arrange(DOWN, buff=0.4, aligned_edge=LEFT)
        self.add_animation(left_group, side="left", animation=FadeIn(left_group[0], run_time=0.5))

        # Right side: coordinate system and vectors
        prism_base, points_2d, edges, vertices = self._create_prism_base()
        right_group = VGroup(prism_base)

        # Coordinate system
        origin = points_2d["D"]
        x_axis = Arrow(origin, origin + 1.2 * RIGHT, color="#1A1A2E", stroke_width=2)
        y_axis = Arrow(origin, origin + 0.6 * (0.5 * RIGHT - 0.3 * UP), color="#1A1A2E", stroke_width=2)
        z_axis = Arrow(origin, origin + 1.2 * UP, color="#1A1A2E", stroke_width=2)
        axes = VGroup(x_axis, y_axis, z_axis)

        # Point labels
        coord_labels = VGroup()
        coords = {
            "A": "(2,0,0)", "A1": "(2,0,4)", "M": "(1,√3,2)", "N": "(1,0,2)"
        }
        for name, coord in coords.items():
            lbl = Text(coord, font_size=16, color="#1A1A2E").next_to(points_2d[name], UP * 0.5 if name != "A" else DOWN * 0.5)
            coord_labels.add(lbl)

        # Planes
        plane_ama1 = Polygon(points_2d["A"], points_2d["M"], points_2d["A1"], color=BLUE, fill_opacity=0.25, stroke_opacity=0)
        plane_ma1n = Polygon(points_2d["M"], points_2d["A1"], points_2d["N"], color=GREEN, fill_opacity=0.25, stroke_opacity=0)

        # Normal vectors (approximate for visualization)
        mid_ama1 = (points_2d["A"] + points_2d["M"] + points_2d["A1"]) / 3
        n1_arrow = Arrow(mid_ama1, mid_ama1 + 0.8 * RIGHT + 0.5 * UP, color=BLUE, stroke_width=3, max_tip_length_to_length_ratio=0.15)
        mid_ma1n = (points_2d["M"] + points_2d["A1"] + points_2d["N"]) / 3
        n2_arrow = Arrow(mid_ma1n, mid_ma1n + 0.5 * LEFT + 0.8 * UP, color=GREEN, stroke_width=3, max_tip_length_to_length_ratio=0.15)

        helper_elements = VGroup(axes, coord_labels, plane_ama1, plane_ma1n, n1_arrow, n2_arrow)
        helper_elements.set_opacity(0)
        right_group.add(helper_elements)

        self.add_animation(right_group, side="right", animation=FadeIn(prism_base, run_time=0.5))

        # Animate left and right together
        self.add_animation(left_group, animation=FadeIn(left_group[1], run_time=0.5))
        self.add_animation(right_group, animation=helper_elements[0:2].animate.set_opacity(1))
        self.wait(0.3)
        self.add_animation(left_group, animation=FadeIn(left_group[2], run_time=0.5))
        self.add_animation(right_group, animation=helper_elements[2:6].animate.set_opacity(1))
        self.wait(0.3)
        self.add_animation(left_group, animation=[FadeIn(left_group[3], run_time=0.5), FadeIn(left_group[4], run_time=0.5)])
        self.add_animation(left_group, animation=Indicate(left_group[4], color="#165DFF", run_time=1))

        self.speak_with_subtitles([
            "第二问用空间向量法求解",
            "先建立空间直角坐标系",
            "写出各点的坐标",
            "分别求两个面的法向量",
            "计算法向量夹角余弦为1/4",
            "得正弦值为√15/4"
        ], subtitle_font_size=28, pause_between=0.08)
        self.wait(0.5)

    def _page_4(self, total_pages: int) -> None:
        self.next_page(layout="center")
        self.set_title("总结", font_size=32)
        self.set_page_number(5, total_pages)

        conclusion1 = create_chinese_formula(r"第一问结论：$MN \parallel$ 平面$C_1DE$（线面平行→线线平行）", font_size=28, color="#1A1A2E")
        conclusion2 = create_chinese_formula(r"第二问结论：二面角$A-MA_1-N$的正弦值为$\frac{\sqrt{15}}{4}$", font_size=28, color="#1A1A2E")
        tip = Text("解题技巧：线面平行优先找线线平行 二面角用向量法降低难度", font_size=26, color="#165DFF", weight="BOLD")
        summary_group = VGroup(conclusion1, conclusion2, tip).arrange(DOWN, buff=0.7)

        self.add_animation(summary_group, animation=[
            FadeIn(conclusion1, run_time=0.5),
            FadeIn(conclusion2, run_time=0.5)
        ])
        self.wait(0.3)
        self.add_animation(summary_group, animation=Indicate(tip, color="#165DFF", run_time=1))

        self.speak_with_subtitles([
            "本题解题思路总结",
            "线面平行先找线线平行",
            "二面角用向量法更简便",
            "平时练习要熟练掌握方法"
        ], subtitle_font_size=28, pause_between=0.08)
        self.wait(1)
```