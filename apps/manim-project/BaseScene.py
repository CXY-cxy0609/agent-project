"""Reusable Manim base scene with layout, text helpers and TTS support."""

from __future__ import annotations

import json
import uuid
import base64
import hashlib
import shutil
import subprocess
import unicodedata
from pathlib import Path
from typing import Any, Iterable, Optional
from urllib import error, request

from manim import (
    Animation,
    DOWN,
    LEFT,
    ORIGIN,
    RIGHT,
    UP,
    BLUE_D,
    Create,
    FadeIn,
    FadeOut,
    Rectangle,
    Scene,
    Text,
    VGroup,
    Mobject,
    WHITE,
    YELLOW_D,
    config,
    smooth,
)


class BaseScene(Scene):
    """
    Base scene that provides:
    - Fixed title/subtitle/page-number regions
    - Content region with center or two-column layout
    - Helpers for text rendering by passing plain strings
    - Layout manager APIs: add_text() / add_animation()
    - Page lifecycle APIs: start_page() / clear_page()
    - Bytedance TTS invocation logic
    """

    default_font = "PingFang SC"
    default_color = WHITE
    # Global layout tuning; subclasses can override these class attributes.
    show_layout_guides = True
    subtitle_rect_down_shift = 0.08
    content_subtitle_gap = 0.12
    two_column_ratio = "1:1"
    # Global TTS defaults; can be overridden per-call in generate_tts_bytedance().
    BYTEDANCE_TTS_API_KEY = "4e92078a-d8b5-4e85-9d07-ebfa36fd9129"
    BYTEDANCE_TTS_ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
    BYTEDANCE_TTS_RESOURCE_ID = "seed-tts-2.0"
    BYTEDANCE_TTS_SPEAKER = "zh_female_vv_uranus_bigtts"
    # Overflow scaling behavior.
    animate_overflow_scale = True
    overflow_scale_run_time = 0.22

    def setup(self) -> None:
        super().setup()
        self._init_regions()
        self._draw_layout_guides()

    def _init_regions(self) -> None:
        self.frame_width = float(config.frame_width)
        self.frame_height = float(config.frame_height)
        self.margin = 0.35
        self._show_layout_guides = bool(getattr(self, "show_layout_guides", True))
        self._subtitle_rect_down_shift = float(
            getattr(self, "subtitle_rect_down_shift", 0.08)
        )
        self._content_subtitle_gap = float(getattr(self, "content_subtitle_gap", 0.12))

        title_h = 1.1
        subtitle_h = 0.9
        footer_h = 0.8
        content_h = self.frame_height - title_h - subtitle_h - footer_h - self.margin

        title_top = self.frame_height / 2 - self.margin
        title_bottom = title_top - title_h
        content_top = title_bottom - 0.1
        content_bottom = content_top - content_h
        subtitle_bottom = -self.frame_height / 2 + footer_h + self.margin

        self.title_rect = Rectangle(
            width=self.frame_width - self.margin * 2,
            height=title_h,
            color=BLUE_D,
            stroke_opacity=0.45,
        ).move_to([0, (title_top + title_bottom) / 2, 0])

        self.content_rect = Rectangle(
            width=self.frame_width - self.margin * 2,
            height=content_h,
            color=YELLOW_D,
            stroke_opacity=0.38,
        ).move_to([0, (content_top + content_bottom) / 2, 0])

        self.subtitle_rect = Rectangle(
            width=self.frame_width - self.margin * 2,
            height=subtitle_h,
            color=BLUE_D,
            stroke_opacity=0.35,
        ).move_to([0, (subtitle_bottom + content_bottom) / 2, 0])
        if self._subtitle_rect_down_shift:
            self.subtitle_rect.shift(DOWN * self._subtitle_rect_down_shift)
        self._enforce_content_subtitle_gap()

        self.left_rect = Rectangle(
            width=self.content_rect.width / 2,
            height=self.content_rect.height,
            color=YELLOW_D,
            stroke_opacity=0.28,
        )
        self.right_rect = Rectangle(
            width=self.content_rect.width / 2,
            height=self.content_rect.height,
            color=YELLOW_D,
            stroke_opacity=0.28,
        )
        self.left_rect.align_to(self.content_rect, LEFT)
        self.right_rect.align_to(self.content_rect, RIGHT)

        self._title_text: Optional[Text] = None
        self._subtitle_text: Optional[Text] = None
        self._page_text: Optional[Text] = None
        self._subtitle_font_size = 30
        self._layout_mode = "center"
        self._two_column_ratio = "1:1"
        self._content_padding = 0.25
        self._layout_v_gap = 0.22
        self._animate_overflow_scale = bool(getattr(self, "animate_overflow_scale", True))
        self._overflow_scale_run_time = float(getattr(self, "overflow_scale_run_time", 0.22))
        self._left_items = VGroup()
        self._right_items = VGroup()
        self._center_items = VGroup()
        self._page_items = VGroup()
        self._named_parents: dict[str, Rectangle] = {}
        self._parent_stacks: dict[str, VGroup] = {}
        self._parent_align: dict[str, str] = {}
        self._parent_overflow: dict[str, str] = {}
        self._set_two_column_ratio(getattr(self, "two_column_ratio", "1:1"))

    def _draw_layout_guides(self) -> None:
        if not self._show_layout_guides:
            return
        guides = VGroup(self.title_rect, self.content_rect, self.subtitle_rect)
        self.play(Create(guides), run_time=0.8)

    def _enforce_content_subtitle_gap(self) -> None:
        desired_top = self.content_rect.get_bottom()[1] - self._content_subtitle_gap
        current_top = self.subtitle_rect.get_top()[1]
        if current_top > desired_top:
            self.subtitle_rect.shift(DOWN * (current_top - desired_top))

    def set_title(self, title: str, font_size: int = 44) -> Text:
        if self._title_text is not None:
            self._unregister_page_item(self._title_text)
            self.remove(self._title_text)
        self._title_text = Text(
            title,
            font=self.default_font,
            color=self.default_color,
            font_size=font_size,
        ).move_to(self.title_rect.get_center())
        self._register_page_item(self._title_text)
        self.play(FadeIn(self._title_text), run_time=0.35)
        return self._title_text

    def set_subtitle(self, subtitle: str, font_size: int = 30) -> Text:
        self._subtitle_font_size = font_size
        if self._subtitle_text is not None:
            self._unregister_page_item(self._subtitle_text)
            self.remove(self._subtitle_text)
        self._subtitle_text = Text(
            subtitle,
            font=self.default_font,
            color=self.default_color,
            font_size=font_size,
        ).move_to(self.subtitle_rect.get_center())
        self._register_page_item(self._subtitle_text)
        self.play(FadeIn(self._subtitle_text), run_time=0.35)
        return self._subtitle_text

    def _set_subtitle_instant(self, subtitle: str, font_size: Optional[int] = None) -> Text:
        effective_size = font_size or self._subtitle_font_size
        if self._subtitle_text is not None:
            self._unregister_page_item(self._subtitle_text)
            self.remove(self._subtitle_text)
        self._subtitle_text = Text(
            subtitle,
            font=self.default_font,
            color=self.default_color,
            font_size=effective_size,
            line_spacing=0.75,
        ).move_to(self.subtitle_rect.get_center())
        self._subtitle_text.width = min(self._subtitle_text.width, self.subtitle_rect.width * 0.94)
        self._register_page_item(self._subtitle_text)
        self.add(self._subtitle_text)
        return self._subtitle_text

    def set_page_number(self, page: int, total: Optional[int] = None) -> Text:
        page_label = f"{page}" if total is None else f"{page}/{total}"
        text = Text(
            page_label,
            font=self.default_font,
            color=self.default_color,
            font_size=26,
        )
        text.move_to(
            self.title_rect.get_corner(RIGHT + UP) + LEFT * 0.7 + DOWN * 0.32
        )
        if self._page_text is not None:
            self._unregister_page_item(self._page_text)
            self.remove(self._page_text)
        self._page_text = text
        self._register_page_item(self._page_text)
        self.add(self._page_text)
        return self._page_text

    def start_page(
        self,
        *,
        layout: str = "center",
        column_ratio: Optional[str] = None,
        clear_title: bool = True,
        clear_subtitle: bool = True,
        clear_page_number: bool = True,
        show_column_guides: bool = True,
        transition: bool = False,
        transition_run_time: float = 0.28,
    ) -> None:
        """
        Start a new page and clear previous page elements.
        """
        self.clear_page(
            clear_title=clear_title,
            clear_subtitle=clear_subtitle,
            clear_page_number=clear_page_number,
            transition=transition,
            transition_run_time=transition_run_time,
        )
        self.set_content_layout(
            layout=layout,
            column_ratio=column_ratio,
            clear_existing=True,
            show_column_guides=show_column_guides,
        )

    def next_page(
        self,
        *,
        layout: str = "center",
        column_ratio: Optional[str] = None,
        clear_title: bool = True,
        clear_subtitle: bool = True,
        clear_page_number: bool = True,
        show_column_guides: bool = True,
        transition: bool = True,
        transition_run_time: float = 0.28,
    ) -> None:
        """
        Semantic alias of start_page() for page switching.
        """
        self.start_page(
            layout=layout,
            column_ratio=column_ratio,
            clear_title=clear_title,
            clear_subtitle=clear_subtitle,
            clear_page_number=clear_page_number,
            show_column_guides=show_column_guides,
            transition=transition,
            transition_run_time=transition_run_time,
        )

    def clear_page(
        self,
        *,
        clear_title: bool = True,
        clear_subtitle: bool = True,
        clear_page_number: bool = True,
        transition: bool = False,
        transition_run_time: float = 0.28,
    ) -> None:
        """
        Clear current page elements and reset content parents/containers.
        """
        clear_targets: list[Mobject] = []
        for mob in list(self._page_items):
            if mob is self._title_text and not clear_title:
                continue
            if mob is self._subtitle_text and not clear_subtitle:
                continue
            if mob is self._page_text and not clear_page_number:
                continue
            clear_targets.append(mob)

        if transition and clear_targets:
            self.play(*[FadeOut(mob) for mob in clear_targets], run_time=transition_run_time)
            for mob in clear_targets:
                self._unregister_page_item(mob)
        else:
            for mob in clear_targets:
                self.remove(mob)
                self._unregister_page_item(mob)

        if clear_title:
            self._title_text = None
        if clear_subtitle:
            self._subtitle_text = None
        if clear_page_number:
            self._page_text = None

        self._left_items = VGroup()
        self._right_items = VGroup()
        self._center_items = VGroup()
        self._named_parents.clear()
        self._parent_stacks.clear()
        self._parent_align.clear()
        self._parent_overflow.clear()
        self.remove(self.left_rect, self.right_rect)

    def create_parent(
        self,
        name: str,
        *,
        side: Optional[str] = None,
        width_ratio: float = 1.0,
        height_ratio: float = 1.0,
        align: str = "center",
        overflow: str = "auto",
        offset: tuple[float, float, float] = ORIGIN,
        show_boundary: bool = False,
    ) -> Rectangle:
        """
        Create a named parent region as anchor for flexible positioning.
        """
        if not name or not name.strip():
            raise ValueError("Parent name must be non-empty.")
        if name in self._named_parents:
            raise ValueError(f"Parent '{name}' already exists.")
        if overflow not in {"auto", "scale", "trim"}:
            raise ValueError("overflow must be 'auto', 'scale' or 'trim'.")
        if align not in {"left", "right", "center"}:
            raise ValueError("align must be 'left', 'right' or 'center'.")
        if width_ratio <= 0 or height_ratio <= 0:
            raise ValueError("width_ratio and height_ratio must be > 0.")

        base_rect = self._resolve_target_rect(side=side, for_text=False)
        parent_rect = Rectangle(
            width=base_rect.width * width_ratio,
            height=base_rect.height * height_ratio,
            color=YELLOW_D,
            stroke_opacity=0.24 if show_boundary else 0.0,
        )
        parent_rect.move_to(base_rect.get_center() + offset)
        self._named_parents[name] = parent_rect
        self._parent_stacks[name] = VGroup()
        self._parent_align[name] = align
        self._parent_overflow[name] = overflow
        self._register_page_item(parent_rect)
        self.add(parent_rect)
        return parent_rect

    def show_center_text(self, text: str, font_size: int = 42) -> Text:
        self.set_content_layout("center", clear_existing=True)
        return self.add_text(
            text,
            font_size=font_size,
            line_spacing=0.8,
            animate=True,
            run_time=0.45,
        )

    def show_two_columns(
        self,
        left_text: str,
        right_text: str,
        font_size: int = 34,
        column_ratio: Optional[str] = None,
    ) -> VGroup:
        self.set_content_layout(
            "two_columns", column_ratio=column_ratio, clear_existing=True
        )
        left = self.add_text(left_text, font_size=font_size, side="left", animate=False)
        right = self.add_text(right_text, font_size=font_size, side="right", animate=False)
        columns = VGroup(left, right)
        self.play(FadeIn(columns), run_time=0.45)
        return columns

    def set_content_layout(
        self,
        layout: str = "center",
        *,
        column_ratio: Optional[str] = None,
        clear_existing: bool = True,
        show_column_guides: bool = True,
    ) -> None:
        """
        Set content layout mode.

        Supported values:
        - "center": vertical stack in content area
        - "two_columns"/"left_right": left text lane + right media lane
        """
        normalized = self._normalize_layout_name(layout)
        if clear_existing:
            self.clear_content_items()
        self._layout_mode = normalized
        if normalized == "two_columns":
            self._set_two_column_ratio(column_ratio or self._two_column_ratio)
        if normalized == "two_columns" and show_column_guides and self._show_layout_guides:
            self.add(self.left_rect, self.right_rect)
        else:
            self.remove(self.left_rect, self.right_rect)

    def clear_content_items(self) -> None:
        """Remove all managed content items from current scene."""
        for group in (self._left_items, self._right_items, self._center_items):
            for item in list(group):
                self._unregister_page_item(item)
                self.remove(item)
        for parent_rect in self._named_parents.values():
            self._unregister_page_item(parent_rect)
            self.remove(parent_rect)
        for stack in self._parent_stacks.values():
            for item in list(stack):
                self._unregister_page_item(item)
                self.remove(item)
        self._left_items = VGroup()
        self._right_items = VGroup()
        self._center_items = VGroup()
        self._named_parents.clear()
        self._parent_stacks.clear()
        self._parent_align.clear()
        self._parent_overflow.clear()

    def add_text(
        self,
        text: str,
        *,
        font_size: int = 34,
        side: Optional[str] = None,
        parent: Optional[str] = None,
        line_spacing: float = 0.75,
        animate: bool = True,
        run_time: float = 0.35,
    ) -> Text:
        """Add text into the current layout with automatic overflow handling."""
        target_rect = self._resolve_target_rect(side=side, for_text=True, parent=parent)
        max_width = target_rect.width - self._content_padding * 2
        wrapped_text = self._wrap_text_to_region(
            text,
            max_width=max_width,
            font_size=font_size,
        )
        text_mob = Text(
            wrapped_text,
            font=self.default_font,
            color=self.default_color,
            font_size=font_size,
            line_spacing=line_spacing,
        )

        self._append_to_layout_group(text_mob, side=side, for_text=True, parent=parent)
        self._register_page_item(text_mob)
        self.add(text_mob)
        self._refresh_layout_positions(animate_overflow_scale=animate)
        if animate:
            self.play(FadeIn(text_mob), run_time=run_time)
        return text_mob

    def add_animation(
        self,
        mobject: Mobject,
        *,
        animation: Optional[Animation | Iterable[Any]] = None,
        side: Optional[str] = None,
        parent: Optional[str] = None,
        animate: bool = True,
        run_time: float = 0.45,
        play_kwargs: Optional[dict[str, Any]] = None,
    ) -> Mobject:
        """Add visual object into layout and optionally play one or more animations."""
        if not isinstance(mobject, Mobject):
            raise TypeError("add_animation expects a Manim Mobject.")

        should_manage_layout = not self._is_managed_content_item(mobject)
        if should_manage_layout:
            self._append_to_layout_group(mobject, side=side, for_text=False, parent=parent)
            self._register_page_item(mobject)
            self._refresh_layout_positions(animate_overflow_scale=animate)

        play_items: tuple[Any, ...] = ()
        if animate:
            resolved_play_kwargs: dict[str, Any] = dict(play_kwargs or {})
            resolved_play_kwargs.setdefault("run_time", run_time)
            if animation is None:
                play_items = (FadeIn(mobject),)
            else:
                play_items = self._normalize_play_items(animation)

            if should_manage_layout and self._should_pre_add_before_play(play_items):
                self.add(mobject)
            self.play(*play_items, **resolved_play_kwargs)
        elif should_manage_layout:
            self.add(mobject)
        return mobject

    @staticmethod
    def _normalize_play_items(animation: Animation | Iterable[Any]) -> tuple[Any, ...]:
        if isinstance(animation, Animation):
            return (animation,)
        if isinstance(animation, Iterable) and not isinstance(animation, (str, bytes)):
            items = tuple(animation)
            if not items:
                raise ValueError("animation iterable cannot be empty.")
            return items
        return (animation,)

    def _is_managed_content_item(self, mobject: Mobject) -> bool:
        if mobject in self._left_items or mobject in self._right_items or mobject in self._center_items:
            return True
        for managed in self._left_items:
            if self._is_same_or_descendant(mobject, managed):
                return True
        for managed in self._right_items:
            if self._is_same_or_descendant(mobject, managed):
                return True
        for managed in self._center_items:
            if self._is_same_or_descendant(mobject, managed):
                return True
        for stack in self._parent_stacks.values():
            for managed in stack:
                if self._is_same_or_descendant(mobject, managed):
                    return True
        return False

    @staticmethod
    def _should_pre_add_before_play(play_items: tuple[Any, ...]) -> bool:
        if not play_items:
            return True
        for item in play_items:
            if not BaseScene._is_intro_animation_item(item):
                return True
        return False

    @staticmethod
    def _is_intro_animation_item(play_item: Any) -> bool:
        if isinstance(play_item, (Create, FadeIn)):
            return True
        return False

    @staticmethod
    def _is_same_or_descendant(candidate: Mobject, managed_root: Mobject) -> bool:
        if candidate is managed_root:
            return True
        family = managed_root.get_family()
        return candidate in family

    def _normalize_layout_name(self, layout: str) -> str:
        normalized = layout.strip().lower()
        if normalized in {"center", "centered"}:
            return "center"
        if normalized in {"two_columns", "left_right", "left-right", "lr"}:
            return "two_columns"
        raise ValueError(f"Unsupported layout '{layout}'. Use 'center' or 'left_right'.")

    def _resolve_target_rect(
        self, *, side: Optional[str], for_text: bool, parent: Optional[str] = None
    ) -> Rectangle:
        if parent is not None:
            parent_rect = self._named_parents.get(parent)
            if parent_rect is None:
                raise ValueError(f"Unknown parent '{parent}'. Please call create_parent() first.")
            return parent_rect
        if self._layout_mode != "two_columns":
            return self.content_rect
        if side is None:
            resolved_side = "left" if for_text else "right"
        else:
            resolved_side = side.strip().lower()
        if resolved_side == "left":
            return self.left_rect
        if resolved_side == "right":
            return self.right_rect
        raise ValueError("side must be 'left' or 'right' in two-column layout.")

    @staticmethod
    def _char_display_units(ch: str) -> float:
        if ch.isspace():
            return 0.45
        if unicodedata.east_asian_width(ch) in {"W", "F"}:
            return 1.0
        if ch.isalnum():
            return 0.58
        return 0.5

    def _wrap_text_to_region(self, text: str, *, max_width: float, font_size: int) -> str:
        if max_width <= 0:
            return text
        # Empirical conversion from Manim width-units to display-width units.
        unit_width = max(0.06, float(font_size) * 0.0128)
        max_units = max(4, int(max_width / unit_width))
        wrapped_lines: list[str] = []
        source_lines = text.splitlines() or [text]
        for raw_line in source_lines:
            if not raw_line:
                wrapped_lines.append("")
                continue
            current = ""
            current_units = 0.0
            for ch in raw_line:
                ch_units = self._char_display_units(ch)
                if current and (current_units + ch_units) > max_units:
                    wrapped_lines.append(current.rstrip())
                    current = ch
                    current_units = ch_units
                else:
                    current += ch
                    current_units += ch_units
            if current:
                wrapped_lines.append(current.rstrip())
        return "\n".join(wrapped_lines)

    @staticmethod
    def _parse_column_ratio(ratio: str) -> tuple[int, int]:
        ratio_map = {
            "1:2": (1, 2),
            "1:1": (1, 1),
            "2:1": (2, 1),
        }
        normalized = ratio.strip()
        if normalized not in ratio_map:
            raise ValueError("column_ratio must be one of: '1:2', '1:1', '2:1'.")
        return ratio_map[normalized]

    def _set_two_column_ratio(self, ratio: str) -> None:
        left_weight, right_weight = self._parse_column_ratio(ratio)
        total_weight = left_weight + right_weight
        content_width = self.content_rect.width
        self.left_rect.stretch_to_fit_width(content_width * (left_weight / total_weight))
        self.right_rect.stretch_to_fit_width(content_width * (right_weight / total_weight))
        self.left_rect.stretch_to_fit_height(self.content_rect.height)
        self.right_rect.stretch_to_fit_height(self.content_rect.height)
        self.left_rect.align_to(self.content_rect, LEFT)
        self.right_rect.align_to(self.content_rect, RIGHT)
        self._two_column_ratio = ratio.strip()

    def _append_to_layout_group(
        self,
        mobject: Mobject,
        *,
        side: Optional[str],
        for_text: bool,
        parent: Optional[str] = None,
    ) -> None:
        if parent is not None:
            stack = self._parent_stacks.get(parent)
            if stack is None:
                raise ValueError(f"Unknown parent '{parent}'. Please call create_parent() first.")
            stack.add(mobject)
            return
        if self._layout_mode == "two_columns":
            resolved_side = (side or ("left" if for_text else "right")).strip().lower()
            if resolved_side == "left":
                self._left_items.add(mobject)
            elif resolved_side == "right":
                self._right_items.add(mobject)
            else:
                raise ValueError("side must be 'left' or 'right' in two-column layout.")
            return
        self._center_items.add(mobject)

    def _refresh_layout_positions(self, *, animate_overflow_scale: bool = False) -> None:
        for parent_name, parent_stack in self._parent_stacks.items():
            parent_rect = self._named_parents[parent_name]
            overflow_mode = self._parent_overflow.get(parent_name, "scale")
            align = self._parent_align.get(parent_name, "center")
            use_trim = self._should_use_trim_for_parent(
                parent_stack=parent_stack,
                parent_rect=parent_rect,
                overflow_mode=overflow_mode,
            )
            if use_trim:
                self._place_stack(parent_stack, parent_rect, align=align)
                self._trim_stack_overflow(parent_stack, parent_rect, align=align)
            else:
                self._fit_stack_to_rect(
                    parent_stack,
                    parent_rect,
                    animate_scale=animate_overflow_scale,
                )
                self._place_stack(parent_stack, parent_rect, align=align)

        if self._layout_mode == "two_columns":
            self._place_stack(self._left_items, self.left_rect, align="left")
            self._trim_left_overflow()
            self._fit_stack_to_rect(
                self._right_items,
                self.right_rect,
                animate_scale=animate_overflow_scale,
            )
            self._place_stack(self._right_items, self.right_rect, align="right")
            return
        self._fit_stack_to_rect(
            self._center_items,
            self.content_rect,
            animate_scale=animate_overflow_scale,
        )
        self._place_stack(self._center_items, self.content_rect, align="center")

    def _should_use_trim_for_parent(
        self,
        *,
        parent_stack: VGroup,
        parent_rect: Rectangle,
        overflow_mode: str,
    ) -> bool:
        if overflow_mode == "trim":
            return True
        if overflow_mode == "scale":
            return False
        # "auto": for two-column left text area, keep danmaku behavior (trim),
        # and avoid unexpected text down-scaling.
        if self._layout_mode == "two_columns":
            left_center_x = self.left_rect.get_center()[0]
            content_center_x = self.content_rect.get_center()[0]
            is_left_side = parent_rect.get_center()[0] <= (left_center_x + content_center_x) / 2
            if is_left_side and len(parent_stack) > 0 and all(
                isinstance(item, Text) for item in parent_stack
            ):
                return True
        return False

    def _place_stack(self, stack: VGroup, rect: Rectangle, *, align: str) -> None:
        if len(stack) == 0:
            return
        stack.arrange(DOWN, buff=self._layout_v_gap)
        target_top = rect.get_top()[1] - self._content_padding
        if align == "left":
            target_x = rect.get_left()[0] + self._content_padding
            dx = target_x - stack.get_left()[0]
        elif align == "right":
            target_x = rect.get_right()[0] - self._content_padding
            dx = target_x - stack.get_right()[0]
        else:
            target_x = rect.get_center()[0]
            dx = target_x - stack.get_center()[0]
        dy = target_top - stack.get_top()[1]
        stack.shift([dx, dy, 0])

    def _trim_left_overflow(self) -> None:
        if len(self._left_items) == 0:
            return
        bottom_limit = self.left_rect.get_bottom()[1] + self._content_padding
        while len(self._left_items) > 0 and self._left_items.get_bottom()[1] < bottom_limit:
            oldest_item = self._left_items[0]
            self._left_items.remove(oldest_item)
            self._unregister_page_item(oldest_item)
            self.remove(oldest_item)
            if len(self._left_items) > 0:
                self._place_stack(self._left_items, self.left_rect, align="left")

    def _trim_stack_overflow(self, stack: VGroup, rect: Rectangle, *, align: str) -> None:
        if len(stack) == 0:
            return
        bottom_limit = rect.get_bottom()[1] + self._content_padding
        while len(stack) > 0 and stack.get_bottom()[1] < bottom_limit:
            oldest_item = stack[0]
            stack.remove(oldest_item)
            self._unregister_page_item(oldest_item)
            self.remove(oldest_item)
            if len(stack) > 0:
                self._place_stack(stack, rect, align=align)

    def _fit_stack_to_rect(
        self,
        stack: VGroup,
        rect: Rectangle,
        *,
        animate_scale: bool = False,
    ) -> None:
        if len(stack) == 0:
            return
        available_w = rect.width - self._content_padding * 2
        available_h = rect.height - self._content_padding * 2
        if available_w <= 0 or available_h <= 0:
            return
        if stack.width <= 0 or stack.height <= 0:
            return
        scale_factor = min(available_w / stack.width, available_h / stack.height, 1.0)
        if scale_factor < 1.0:
            can_animate_scale = animate_scale and self._animate_overflow_scale
            if not can_animate_scale:
                stack.scale(scale_factor)
                return

            about_point = stack.get_center()
            visible_items = VGroup(
                *[item for item in stack if self._is_effectively_visible(item)]
            )
            hidden_items = VGroup(
                *[item for item in stack if not self._is_effectively_visible(item)]
            )

            if len(visible_items) > 0:
                self.play(
                    visible_items.animate.scale(scale_factor, about_point=about_point),
                    run_time=self._overflow_scale_run_time,
                    rate_func=smooth,
                )
            if len(hidden_items) > 0:
                hidden_items.scale(scale_factor, about_point=about_point)

    def _is_effectively_visible(self, mobject: Mobject) -> bool:
        return any(member in self.mobjects for member in mobject.get_family())

    def _register_page_item(self, mobject: Mobject) -> None:
        if mobject not in self._page_items:
            self._page_items.add(mobject)

    def _unregister_page_item(self, mobject: Mobject) -> None:
        if mobject in self._page_items:
            self._page_items.remove(mobject)

    def quick_show(
        self,
        *,
        title: str,
        subtitle: str = "",
        layout: str = "center",
        column_ratio: Optional[str] = None,
        center_text: str = "",
        left_text: str = "",
        right_text: str = "",
        page: Optional[int] = None,
        total: Optional[int] = None,
    ) -> VGroup:
        self.set_title(title)
        if subtitle:
            self.set_subtitle(subtitle)
        if page is not None:
            self.set_page_number(page, total)

        normalized_layout = self._normalize_layout_name(layout)
        if normalized_layout == "two_columns":
            if not left_text or not right_text:
                raise ValueError(
                    "two_columns layout requires both left_text and right_text."
                )
            content = self.show_two_columns(
                left_text=left_text,
                right_text=right_text,
                column_ratio=column_ratio,
            )
        else:
            if not center_text:
                raise ValueError("center layout requires center_text.")
            content = self.show_center_text(center_text)

        return VGroup(
            *(item for item in [self._title_text, self._subtitle_text, self._page_text, content] if item)
        )

    def generate_tts_bytedance(
        self,
        text: str,
        output_file: Optional[str] = None,
        *,
        speaker: Optional[str] = None,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        resource_id: Optional[str] = None,
        sample_rate: int = 24000,
    ) -> str:
        """
        Generate speech audio using ByteDance TTS API.

        Config priority:
        1) Per-call params (api_key/endpoint/resource_id/speaker)
        2) Global class attributes (BYTEDANCE_TTS_*)
        """
        resolved_api_key = api_key or self.BYTEDANCE_TTS_API_KEY
        if not resolved_api_key:
            raise ValueError(
                "Missing ByteDance TTS API key. "
                "Please configure BYTEDANCE_TTS_API_KEY or pass api_key."
            )

        req_id = str(uuid.uuid4())
        resolved_endpoint = endpoint or self.BYTEDANCE_TTS_ENDPOINT
        resolved_resource_id = resource_id or self.BYTEDANCE_TTS_RESOURCE_ID
        resolved_speaker = speaker or self.BYTEDANCE_TTS_SPEAKER
        payload = {
            "user": {"uid": req_id},
            "req_params": {
                "text": text,
                "speaker": resolved_speaker,
                "audio_params": {"format": "mp3", "sample_rate": sample_rate},
            },
        }
        req = request.Request(
            resolved_endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-Api-Key": resolved_api_key,
                "X-Api-Resource-Id": resolved_resource_id,
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=30) as resp:
                raw_response = resp.read().decode("utf-8", errors="replace")
                print(
                    "[ByteDance TTS] HTTP",
                    getattr(resp, "status", "unknown"),
                    "Content-Type:",
                    resp.headers.get("Content-Type", ""),
                )
                print("[ByteDance TTS] Raw response preview:", raw_response[:600])
                if len(raw_response) > 600:
                    print("[ByteDance TTS] Raw response tail:", raw_response[-300:])
                response_events = self._parse_streaming_json_objects(raw_response)
        except error.URLError as exc:
            raise RuntimeError(f"ByteDance TTS request failed: {exc}") from exc
        except json.JSONDecodeError as exc:
            print("[ByteDance TTS] JSON decode failed. Full raw response below:")
            print(raw_response)
            raise RuntimeError(f"ByteDance TTS returned non-JSON response: {exc}") from exc

        print(f"[ByteDance TTS] Parsed event count: {len(response_events)}")
        invalid_events = [
            event
            for event in response_events
            if isinstance(event, dict) and event.get("code") not in (0, 20000000)
        ]
        if invalid_events:
            raise RuntimeError(f"ByteDance TTS API error: {invalid_events}")

        audio_b64 = "".join(
            event.get("data", "")
            for event in response_events
            if isinstance(event, dict) and isinstance(event.get("data"), str) and event.get("data")
        )
        if not audio_b64:
            raise RuntimeError(f"No audio data returned from ByteDance TTS: {response_events}")
        try:
            audio_bytes = base64.b64decode(audio_b64)
        except Exception as exc:
            raise RuntimeError(f"Failed to decode ByteDance TTS audio data: {exc}") from exc
        if not audio_bytes:
            raise RuntimeError("Decoded audio bytes are empty.")

        output_dir = Path("media/tts")
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = (
            output_dir / f"tts_{req_id}.mp3" if output_file is None else Path(output_file)
        )
        output_path.write_bytes(audio_bytes)
        return str(output_path)

    def _estimate_speech_seconds(self, text: str, chars_per_second: float = 4.8) -> float:
        clean_text = "".join(ch for ch in text if not ch.isspace())
        return max(1.0, len(clean_text) / chars_per_second)

    def _probe_audio_seconds(self, audio_path: str) -> Optional[float]:
        if shutil.which("ffprobe") is None:
            return None
        try:
            result = subprocess.run(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    audio_path,
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            return float(result.stdout.strip())
        except (subprocess.SubprocessError, ValueError):
            return None

    def _tts_cache_key(
        self, text: str, speaker: str, sample_rate: int, resource_id: str, endpoint: str
    ) -> str:
        digest = hashlib.sha256(
            f"{speaker}|{sample_rate}|{resource_id}|{endpoint}|{text}".encode("utf-8")
        ).hexdigest()
        return digest[:24]

    def speak_with_subtitles(
        self,
        lines: list[str],
        *,
        subtitle_font_size: int = 30,
        speaker: Optional[str] = None,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        resource_id: Optional[str] = None,
        sample_rate: int = 24000,
        pause_between: float = 0.12,
    ) -> None:
        """
        Speak lines one by one and keep subtitle in sync with audio duration.
        """
        resolved_endpoint = endpoint or self.BYTEDANCE_TTS_ENDPOINT
        resolved_resource_id = resource_id or self.BYTEDANCE_TTS_RESOURCE_ID
        resolved_speaker = speaker or self.BYTEDANCE_TTS_SPEAKER

        cache_dir = Path("media/tts-cache")
        cache_dir.mkdir(parents=True, exist_ok=True)

        for raw_line in lines:
            line = raw_line.strip()
            if not line:
                continue

            self._set_subtitle_instant(line, subtitle_font_size)
            cache_key = self._tts_cache_key(
                line, resolved_speaker, sample_rate, resolved_resource_id, resolved_endpoint
            )
            audio_path = cache_dir / f"{cache_key}.mp3"

            if not audio_path.exists():
                self.generate_tts_bytedance(
                    line,
                    output_file=str(audio_path),
                    speaker=resolved_speaker,
                    api_key=api_key,
                    endpoint=resolved_endpoint,
                    resource_id=resolved_resource_id,
                    sample_rate=sample_rate,
                )

            self.add_sound(str(audio_path))
            duration = self._probe_audio_seconds(str(audio_path)) or self._estimate_speech_seconds(line)
            self.wait(duration + pause_between)

    @staticmethod
    def _parse_streaming_json_objects(raw_response: str) -> list[dict[str, Any]]:
        """
        Parse one or multiple concatenated JSON objects from streaming response.
        Supports payloads like:
        - {"code":0,...}
        - {"code":0,...}\n{"code":20000000,...}
        """
        decoder = json.JSONDecoder()
        idx = 0
        events: list[dict[str, Any]] = []
        length = len(raw_response)

        while idx < length:
            while idx < length and raw_response[idx].isspace():
                idx += 1
            if idx >= length:
                break

            obj, next_idx = decoder.raw_decode(raw_response, idx)
            if isinstance(obj, dict):
                events.append(obj)
            idx = next_idx

        if not events:
            raise json.JSONDecodeError("No JSON object found in response", raw_response, 0)
        return events

    def add_voiceover(self, text: str, **kwargs: object) -> str:
        """
        Generate TTS audio and attach it to scene.
        Returns saved audio path.
        """
        audio_path = self.generate_tts_bytedance(text, **kwargs)
        self.add_sound(audio_path)
        return audio_path
