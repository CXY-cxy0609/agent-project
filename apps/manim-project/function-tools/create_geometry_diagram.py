from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from manim import (
    BLACK,
    DOWN,
    LEFT,
    ORIGIN,
    RIGHT,
    UP,
    WHITE,
    DashedLine,
    Dot,
    Line,
    Polygon,
    Text,
    VGroup,
)

Point3D = Sequence[float]
EdgeSpec = str | tuple[str, str] | list[str]


def project_oblique(
    point: Point3D,
    *,
    origin=ORIGIN,
    scale: float = 1.0,
    depth_vector=None,
    height_vector=None,
):
    """Project logical 3D coordinates to a 2D textbook-style oblique diagram."""
    x, y, z = _coerce_point3d(point)
    depth = depth_vector if depth_vector is not None else 0.45 * RIGHT + 0.28 * UP
    height = height_vector if height_vector is not None else UP
    return origin + scale * (x * RIGHT + y * depth + z * height)


def create_wireframe_diagram(
    vertices: Mapping[str, Point3D],
    *,
    visible_edges: Sequence[EdgeSpec],
    hidden_edges: Sequence[EdgeSpec] | None = None,
    labels: Sequence[str] | None = None,
    label_directions: Mapping[str, Any] | None = None,
    point_colors: Mapping[str, Any] | None = None,
    edge_color=WHITE,
    hidden_edge_color=WHITE,
    point_color=WHITE,
    label_color=WHITE,
    stroke_width: float = 3,
    point_radius: float = 0.055,
    font_size: int = 20,
    origin=ORIGIN,
    scale: float = 1.0,
):
    """
    Build a reusable 2D pseudo-projection wireframe.

    Returns:
        (group, edges_by_name, points_by_name, labels_by_name)
    """
    projected = {
        name: project_oblique(point, origin=origin, scale=scale)
        for name, point in vertices.items()
    }
    group = VGroup()
    edges_by_name: dict[str, Any] = {}
    points_by_name: dict[str, Any] = {}
    labels_by_name: dict[str, Any] = {}

    for edge in visible_edges:
        start, end = _resolve_edge(edge, vertices)
        edge_name = f"{start}{end}"
        line = Line(
            projected[start],
            projected[end],
            color=edge_color,
            stroke_width=stroke_width,
        )
        edges_by_name[edge_name] = line
        group.add(line)

    for edge in hidden_edges or []:
        start, end = _resolve_edge(edge, vertices)
        edge_name = f"{start}{end}"
        line = DashedLine(
            projected[start],
            projected[end],
            color=hidden_edge_color,
            stroke_width=stroke_width,
        )
        edges_by_name[edge_name] = line
        group.add(line)

    label_names = list(labels) if labels is not None else list(vertices.keys())
    for name in label_names:
        if name not in projected:
            continue
        color = point_colors.get(name, point_color) if point_colors else point_color
        dot = Dot(projected[name], color=color, radius=point_radius)
        points_by_name[name] = dot
        group.add(dot)

        direction = _label_direction(name, label_directions)
        label = Text(name, font_size=font_size, color=label_color)
        label.next_to(projected[name], direction, buff=0.08)
        labels_by_name[name] = label
        group.add(label)

    return group, edges_by_name, points_by_name, labels_by_name


def create_projected_polygon(
    vertices: Mapping[str, Point3D],
    names: Sequence[str],
    *,
    origin=ORIGIN,
    scale: float = 1.0,
    color=WHITE,
    fill_color=None,
    fill_opacity: float = 0.18,
    stroke_opacity: float = 0.85,
):
    """Create a 2D polygon from logical 3D vertex names."""
    points = [project_oblique(vertices[name], origin=origin, scale=scale) for name in names]
    return Polygon(
        *points,
        color=color,
        fill_color=fill_color or color,
        fill_opacity=fill_opacity,
        stroke_opacity=stroke_opacity,
    )


def _coerce_point3d(point: Point3D) -> tuple[float, float, float]:
    if len(point) != 3:
        raise ValueError("3D point must contain exactly three numbers")
    return float(point[0]), float(point[1]), float(point[2])


def _resolve_edge(edge: EdgeSpec, vertices: Mapping[str, Point3D]) -> tuple[str, str]:
    if isinstance(edge, (tuple, list)):
        if len(edge) != 2:
            raise ValueError("Edge tuple/list must contain exactly two vertex names")
        return str(edge[0]), str(edge[1])

    edge_name = str(edge)
    labels = sorted(vertices.keys(), key=len, reverse=True)
    for start in labels:
        if not edge_name.startswith(start):
            continue
        rest = edge_name[len(start):]
        if rest in vertices:
            return start, rest
    raise ValueError(f"Cannot resolve edge '{edge_name}' from vertex labels")


def _label_direction(name: str, directions: Mapping[str, Any] | None):
    if directions and name in directions:
        return directions[name]
    if name.endswith("1"):
        return UP
    if name in {"D", "C"}:
        return LEFT
    if name in {"A", "B"}:
        return DOWN
    return RIGHT
