from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


ParseMode = Literal["fast", "balanced", "quality"]
PageType = Literal["text_page", "mixed_page", "image_page"]


@dataclass
class ParseOptions:
    mode: ParseMode = "balanced"
    max_upgrade_pages: int = 3
    budget_tokens: int = 4000


@dataclass
class PageSignal:
    page_number: int
    page_type: PageType
    text_density: float
    quality_score: float
    extracted_chars: int
