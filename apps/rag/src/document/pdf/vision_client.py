from __future__ import annotations

import base64
import logging
from dataclasses import dataclass

import httpx

from ...config import settings

logger = logging.getLogger(__name__)


@dataclass
class VisionResult:
    text: str
    model: str
    confidence: float


class VisionUnderstandingClient:
    def __init__(self) -> None:
        self._base_url = settings.vision_base_url.rstrip("/")
        self._api_key = settings.vision_api_key
        self._model = settings.vision_model
        self._timeout = settings.vision_timeout_seconds

    @property
    def enabled(self) -> bool:
        return bool(settings.vision_enabled and self._api_key and self._model)

    def describe_page(self, image_png: bytes, page_number: int, reason: str) -> VisionResult | None:
        if not self.enabled:
            return None
        prompt = (
            "你是企业级 RAG 文档解析器。请分析这页 PDF 图片，输出可用于知识库检索的中文结构化摘要。"
            "重点提取：正文文字、表格内容、数学公式、图表/几何图含义、题目条件、关键结论。"
            "如果看不清，请明确说明低置信区域。"
            f"\n页码：{page_number}\n触发原因：{reason}"
        )
        return self._chat_with_image(prompt, image_png)

    def _chat_with_image(self, prompt: str, image_png: bytes) -> VisionResult | None:
        image_b64 = base64.b64encode(image_png).decode("ascii")
        payload = {
            "model": self._model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_b64}",
                            },
                        },
                    ],
                }
            ],
            "temperature": 0.1,
        }
        try:
            with httpx.Client(timeout=self._timeout) as client:
                response = client.post(
                    f"{self._base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("vision understanding failed: %s", exc)
            return None

        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        if not isinstance(content, str) or not content.strip():
            return None
        return VisionResult(text=content.strip(), model=self._model, confidence=0.75)


vision_client = VisionUnderstandingClient()
