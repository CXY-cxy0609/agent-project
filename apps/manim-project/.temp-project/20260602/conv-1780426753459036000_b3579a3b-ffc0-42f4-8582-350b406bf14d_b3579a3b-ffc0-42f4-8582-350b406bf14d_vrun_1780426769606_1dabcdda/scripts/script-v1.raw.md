from __future__ import annotations

import sys
from pathlib import Path

from manim import (
    FadeIn,
    Create,
    Indicate,
    FadeOut,
    VGroup,
    Text,
    Line,
    DashedLine,
    Polygon,
    Dot,
    Arrow,
    WHITE,
    YELLOW,
    BLUE,
    RED,
    GREEN,
    PURPLE,
    GREY,
    ORIGIN,
    RIGHT,
    UP,
    DOWN,
    LEFT,
)

BASE_DIR = Path(__file__).resolve().parents[4]
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))
if str(BASE_DIR / "function-tools") not in sys.path:
    sys.path.append(str(BASE_DIR / "function-tools"))

from BaseScene import BaseScene
from create_formula import create_math_formula, create_chinese_formula


class StraightPrismProblem(BaseScene):
    show_layout_guides = False
    subtitle_rect_down_shift = 0.12
    background_color = "#F0F2F5"
    default_color = "#1F2937"

    def construct(self) -> None:
        total_pages = 5
        self._page_0(total_pages)
        self._page_1(total_pages)
        self._page_2(total_pages)
        self._page_3(total_pages)
        self._page_4(total_pages)

    def _project_3d_to_2d(self, point, origin=ORIGIN, scale=1.0):
        x, y, z = point
        depth = 0.5 * RIGHT + 0.2 * DOWN
        return origin + x * RIGHT * scale + y * depth * scale + z * UP * scale

    def _create_prism_diagram(self, origin=ORIGIN):
        scale = 1.0
        points_3d = {
            "A": (0, 0, 0),
            "B": (2, 0, 0),
            "C": (3, 1.732, 0),
            "D": (1, 1.732, 0),
            "A1": (0, 0, 4),
            "B1": (2, 0, 4),
            "C1": (3, 1.732, 4),
            "D1": (1, 1.732, 4),
        }
        points_3d["E"] = ((points_3d["B"][0]+points_3d["C"][0])/2, (points_3d["B"][1]+points_3d["C"][1])/2, 0)
        points_3d["M"] = (2, 0, 2)
        points_3d["N"] = (0.5, 0.866, 2)

        points_2d = {name: self._project_3d_to_2d(p, origin, scale) for name, p in points_3d.items()}

        visible_edges = [
            ("A", "B"), ("B", "C"), ("B", "B1"), ("B1", "C1"),
            ("C1", "D1"), ("C", "C1"), ("A", "A1"), ("A1", "B1")
        ]
        hidden_edges = [("A", "D"), ("D", "C"), ("D", "D1"), ("A1", "D")]

        edges = []
        for a, b in visible_edges:
            edges.append(Line(points_2d[a], points_2d[b], color="#1F2937", stroke_width=3))
        for a, b in hidden_edges:
            edges.append(DashedLine(points_2d[a], points_2d[b], color="#9CA3AF", stroke_width=2))

        dots = []
        labels = []
        for name in ["E", "M", "N"]:
            dot = Dot(points_2d[name], color=RED, radius=0.08)
            label = Text(name, font_size=20, color="#1F2937").next_to(dot, UP+RIGHT, buff=0.1)
            dots.append(dot)
            labels.append(label)

        prism_group = VGroup(*edges, *dots, *labels)
        return prism_group, points_2d, dots

    def _page_0(self, total_pages: int) -> None:
        self.start_page(layout="center", transition=False)
        self.set_page_number(1, total_pages)

        title = Text("直四棱柱立体几何真题解析", font_size=48, color="#1F2937")
        subtitle = Text("高中数学 立体几何专题", font_size=28, color="#6B7280").next_to(title, DOWN, buff=0.5)
        cover_group = VGroup(title, subtitle)

        self.add_animation(cover_group, animation=FadeIn(cover_group), run_time=1.0)
        self.wait(1.5)
        self.add_animation(cover_group, animation=FadeOut(cover_group), run_time=0.5)

        lines = ["同学们好", "今天讲解直四棱柱立体几何真题"]
        self.speak_with_subtitles(lines, subtitle_font_size=30, pause_between=0.1)

    def _page_1(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1", transition=True)
        self.set_title("原题展示")
        self.set_page_number(2, total_pages)

        problem_text = """9. 如图，直四棱柱ABCD-A₁B₁C₁D₁的底面是菱形，AA₁=4，AB=2，∠BAD=60°，E，M，N分别是BC，BB₁，A₁D的中点。
（1）证明：MN ∥ 平面C₁DE；
（2）求二面角A-MA₁-N的正弦值。"""
        self.add_text(problem_text, font_size=22, side="left", line_spacing=0.8)

        prism_group, points_2d, dots = self._create_prism_diagram(origin=RIGHT*0.5)
        self.add_animation(prism_group, animation=FadeIn(prism_group), side="right", run_time=1.0)

        for dot in dots:
            self.add_animation(prism_group, animation=Indicate(dot, color=YELLOW, scale_factor=1.5), run_time=1.0)
            self.wait(0.5)

        lines = [
            "首先来看完整题干",
            "几何体是底面为菱形的直四棱柱",
            "已知棱长角度和三个中点位置",
            "要求证明线面平行并求二面角正弦值"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)

    def _page_2(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1", transition=True)
        self.set_title("第一问 线面平行证明")
        self.set_page_number(3, total_pages)

        proof_text = """证明思路：要证MN∥平面C₁DE，只需证MN与平面内某条直线平行。
步骤1：连接ME、B₁C，M是BB₁中点，E是BC中点，故ME∥B₁C且ME=1/2 B₁C。
步骤2：直四棱柱中A₁B₁∥DC且A₁B₁=DC，故B₁C∥A₁D，N是A₁D中点，故ND=1/2 A₁D=1/2 B₁C，且ND∥B₁C。
步骤3：故ME∥ND且ME=ND，四边形MNDE是平行四边形，MN∥DE。
步骤4：DE⊂平面C₁DE，MN⊄平面C₁DE，故MN∥平面C₁DE。"""
        self.add_text(proof_text, font_size=20, side="left", line_spacing=0.7)

        prism_group, points_2d, _ = self._create_prism_diagram(origin=RIGHT*0.5)
        me = Line(points_2d["M"], points_2d["E"], color=BLUE, stroke_width=4)
        b1c = Line(points_2d["B1"], points_2d["C"], color=BLUE, stroke_width=3)
        nd = Line(points_2d["N"], points_2d["D"], color=BLUE, stroke_width=4)
        a1d = Line(points_2d["A1"], points_2d["D"], color=GREEN, stroke_width=3)
        mn = Line(points_2d["M"], points_2d["N"], color=RED, stroke_width=4)
        de = Line(points_2d["D"], points_2d["E"], color=BLUE, stroke_width=4)
        plane_c1de = Polygon(points_2d["C1"], points_2d["D"], points_2d["E"], fill_color=BLUE, fill_opacity=0.2, stroke_opacity=0)
        proof_group = VGroup(prism_group, me, b1c, nd, a1d, mn, de, plane_c1de)
        self.add_animation(proof_group, animation=FadeIn(prism_group), side="right", run_time=0.8)

        self.add_animation(proof_group, animation=[Indicate(me, color=YELLOW), Indicate(b1c, color=YELLOW)], run_time=1.2)
        self.wait(0.3)
        self.add_animation(proof_group, animation=[Indicate(nd, color=YELLOW), Indicate(a1d, color=YELLOW)], run_time=1.2)
        self.wait(0.3)
        self.add_animation(proof_group, animation=[Indicate(mn, color=YELLOW), Indicate(de, color=YELLOW)], run_time=1.2)
        self.wait(0.3)
        self.add_animation(proof_group, animation=Indicate(plane_c1de, color=YELLOW), run_time=1.2)

        lines = [
            "第一问我们证明线面平行",
            "核心思路是证明线线平行",
            "先连接ME和B1C构造中位线",
            "证明四边形MNDE是平行四边形",
            "得到MN平行于平面内的DE",
            "即可证明MN平行于平面C1DE"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)

    def _page_3(self, total_pages: int) -> None:
        self.next_page(layout="left_right", column_ratio="1:1", transition=True)
        self.set_title("第二问 二面角求解")
        self.set_page_number(4, total_pages)

        solve_text = """求解思路：建立空间直角坐标系，求两个面的法向量，计算法向量夹角正弦值。
步骤1：以A为原点，AB为x轴，过A作垂直AB的直线为y轴，AA₁为z轴建立坐标系。各点坐标：A(0,0,0), A₁(0,0,4), M(2,0,2), N(1,√3,2)。
步骤2：面AMA₁的法向量：面AMA₁在xOz平面，法向量n₁=(0,1,0)。
步骤3：面A₁MN的法向量：向量A₁M=(2,0,-2)，向量A₁N=(1,√3,-2)，设法向量n₂=(x,y,z)，则2x-2z=0，x+√3 y -2z=0，取z=1，得n₂=(1,√3/3,1)。
步骤4：计算法向量夹角余弦值cosθ=|n₁·n₂|/(|n₁||n₂|)= (√3/3)/√(1 + 1/3 + 1) = √7/7，故正弦值sinθ=√(1 - 1/7)=√42/7。"""
        self.add_text(solve_text, font_size=19, side="left", line_spacing=0.65)

        scale = 0.8
        origin_coord = ORIGIN + RIGHT*0.5
        x_axis = Arrow(origin_coord, origin_coord + RIGHT*3, color=RED, stroke_width=3)
        x_label = Text("x", font_size=22, color=RED).next_to(x_axis.get_end(), RIGHT)
        y_axis = Arrow(origin_coord, origin_coord + UP*2.5, color=GREEN, stroke_width=3)
        y_label = Text("y", font_size=22, color=GREEN).next_to(y_axis.get_end(), UP)
        z_axis = Arrow(origin_coord, origin_coord + 0.5*RIGHT + 0.2*DOWN + UP*3, color=BLUE, stroke_width=3)
        z_label = Text("z", font_size=22, color=BLUE).next_to(z_axis.get_end(), UP+RIGHT)
        axes_group = VGroup(x_axis, x_label, y_axis, y_label, z_axis, z_label)

        a_dot = Dot(origin_coord, color="#1F2937", radius=0.06)
        a1_dot = Dot(origin_coord + UP*3*scale, color="#1F2937", radius=0.06)
        m_dot = Dot(origin_coord + RIGHT*2*scale, color="#1F2937", radius=0.06)
        n_dot = Dot(origin_coord + RIGHT*1*scale + UP*1.732*scale, color="#1F2937", radius=0.06)
        n1_arrow = Arrow(origin_coord + RIGHT*1*scale + UP*1.5*scale, origin_coord + RIGHT*1*scale + UP*1.5*scale + UP*1.2, color=GREEN, stroke_width=3)
        n1_label = create_math_formula(r"\vec{n_1}=(0,1,0)", font_size=22, color=GREEN).next_to(n1_arrow.get_end(), UP)
        n2_start = origin_coord + RIGHT*1*scale + UP*1.5*scale
        n2_end = n2_start + RIGHT*0.8 + UP*0.5 + 0.3*RIGHT + 0.1*DOWN
        n2_arrow = Arrow(n2_start, n2_end, color=PURPLE, stroke_width=3)
        n2_label = create_math_formula(r"\vec{n_2}=(1,\frac{\sqrt{3}}{3},1)", font_size=22, color=PURPLE).next_to(n2_arrow.get_end(), UP+RIGHT)
        result = create_math_formula(r"\sin\theta = \frac{\sqrt{42}}{7}", font_size=42, color=RED)
        result.move_to(origin_coord + DOWN*2)

        solve_group = VGroup(axes_group, a_dot, a1_dot, m_dot, n_dot, n1_arrow, n1_label, n2_arrow, n2_label, result)
        self.add_animation(solve_group, animation=FadeIn(axes_group), side="right", run_time=0.8)
        self.add_animation(solve_group, animation=FadeIn(VGroup(a_dot, a1_dot, m_dot, n_dot)), run_time=0.5)
        self.wait(0.3)
        self.add_animation(solve_group, animation=FadeIn(VGroup(n1_arrow, n1_label)), run_time=0.5)
        self.wait(0.3)
        self.add_animation(solve_group, animation=FadeIn(VGroup(n2_arrow, n2_label)), run_time=0.5)
        self.wait(0.3)
        self.add_animation(solve_group, animation=[FadeIn(result), Indicate(result, color=YELLOW, scale_factor=1.2)], run_time=1.2)

        lines = [
            "第二问我们求二面角的正弦值",
            "首先建立空间直角坐标系",
            "写出各关键点的坐标",
            "分别求两个面的法向量",
            "计算法向量夹角的正弦值",
            "最终结果为7分之根号42"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=28, pause_between=0.1)

    def _page_4(self, total_pages: int) -> None:
        self.next_page(layout="center", transition=True)
        self.set_title("内容总结")
        self.set_page_number(5, total_pages)

        summary1 = Text("【结论汇总】", font_size=36, color="#1F2937")
        summary2 = create_chinese_formula(r"（1）$MN \parallel$ 平面$C_1DE$ 证明成立；", font_size=28, color="#1F2937")
        summary3 = create_chinese_formula(r"（2）二面角$A-MA_1-N$的正弦值为$\frac{\sqrt{42}}{7}$", font_size=28, color="#1F2937")
        summary2.next_to(summary1, DOWN, buff=0.4)
        summary3.next_to(summary2, DOWN, buff=0.3)
        key_points = Text("解题要点：线面平行判定定理、空间向量法求二面角", font_size=22, color="#6B7280").next_to(summary3, DOWN, buff=0.6)
        summary_group = VGroup(summary1, summary2, summary3, key_points)

        self.add_animation(summary_group, animation=FadeIn(summary_group), run_time=2.0)
        self.wait(3.0)
        self.add_animation(summary_group, animation=FadeOut(summary_group), run_time=0.5)

        lines = [
            "今天的题目讲解完毕",
            "牢记线面平行判定定理",
            "掌握空间向量求二面角方法",
            "同学们下次再见"
        ]
        self.speak_with_subtitles(lines, subtitle_font_size=30, pause_between=0.1)