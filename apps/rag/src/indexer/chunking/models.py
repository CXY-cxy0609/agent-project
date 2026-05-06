from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class Chunk:
    text: str
    metadata: dict[str, Any]
    token_count: int


@dataclass
class TextBlock:
    text: str
    block_type: str
