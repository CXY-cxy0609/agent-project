"""Reusable Manim base scene with layout, text helpers and TTS support."""

from __future__ import annotations

import json
import uuid
import base64
from pathlib import Path
from typing import Any, Optional
from urllib import error, request

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    BLUE_D,
    Create,
    FadeIn,
    Rectangle,
    Scene,
    Text,
    VGroup,
    WHITE,
    YELLOW_D,
    config,
)


class BaseScene(Scene):
    """
    Base scene that provides:
    - Fixed title/subtitle/page-number regions
    - Content region with center or two-column layout
    - Helpers for text rendering by passing plain strings
    - Bytedance TTS invocation logic
    """

    default_font = "PingFang SC"
    default_color = WHITE
    # Global TTS defaults; can be overridden per-call in generate_tts_bytedance().
    BYTEDANCE_TTS_API_KEY = "4e92078a-d8b5-4e85-9d07-ebfa36fd9129"
    BYTEDANCE_TTS_ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
    BYTEDANCE_TTS_RESOURCE_ID = "seed-tts-2.0"
    BYTEDANCE_TTS_SPEAKER = "zh_female_vv_uranus_bigtts"

    def setup(self) -> None:
        super().setup()
        self._init_regions()
        self._draw_layout_guides()

    def _init_regions(self) -> None:
        self.frame_width = float(config.frame_width)
        self.frame_height = float(config.frame_height)
        self.margin = 0.35

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

    def _draw_layout_guides(self) -> None:
        guides = VGroup(self.title_rect, self.content_rect, self.subtitle_rect)
        self.play(Create(guides), run_time=0.8)

    def set_title(self, title: str, font_size: int = 44) -> Text:
        if self._title_text is not None:
            self.remove(self._title_text)
        self._title_text = Text(
            title,
            font=self.default_font,
            color=self.default_color,
            font_size=font_size,
        ).move_to(self.title_rect.get_center())
        self.play(FadeIn(self._title_text), run_time=0.35)
        return self._title_text

    def set_subtitle(self, subtitle: str, font_size: int = 30) -> Text:
        if self._subtitle_text is not None:
            self.remove(self._subtitle_text)
        self._subtitle_text = Text(
            subtitle,
            font=self.default_font,
            color=self.default_color,
            font_size=font_size,
        ).move_to(self.subtitle_rect.get_center())
        self.play(FadeIn(self._subtitle_text), run_time=0.35)
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
            self.remove(self._page_text)
        self._page_text = text
        self.add(self._page_text)
        return self._page_text

    def show_center_text(self, text: str, font_size: int = 42) -> Text:
        content = Text(
            text,
            font=self.default_font,
            color=self.default_color,
            font_size=font_size,
            line_spacing=0.8,
        ).move_to(self.content_rect.get_center())
        content.width = min(content.width, self.content_rect.width * 0.9)
        self.play(FadeIn(content), run_time=0.45)
        return content

    def show_two_columns(
        self, left_text: str, right_text: str, font_size: int = 34
    ) -> VGroup:
        self.add(self.left_rect, self.right_rect)
        left = Text(
            left_text,
            font=self.default_font,
            color=self.default_color,
            font_size=font_size,
            line_spacing=0.75,
        ).move_to(self.left_rect.get_center())
        right = Text(
            right_text,
            font=self.default_font,
            color=self.default_color,
            font_size=font_size,
            line_spacing=0.75,
        ).move_to(self.right_rect.get_center())
        left.width = min(left.width, self.left_rect.width * 0.9)
        right.width = min(right.width, self.right_rect.width * 0.9)
        columns = VGroup(left, right)
        self.play(FadeIn(columns), run_time=0.45)
        return columns

    def quick_show(
        self,
        *,
        title: str,
        subtitle: str = "",
        layout: str = "center",
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

        if layout == "two_columns":
            if not left_text or not right_text:
                raise ValueError(
                    "two_columns layout requires both left_text and right_text."
                )
            content = self.show_two_columns(left_text=left_text, right_text=right_text)
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
