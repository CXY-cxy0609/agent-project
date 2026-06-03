from __future__ import annotations

import hashlib
import mimetypes
from dataclasses import dataclass, field
from typing import Any, Literal

from ..indexer.parser_models import PageSignal

BlockType = Literal[
    "heading",
    "paragraph",
    "list",
    "table",
    "code",
    "formula",
    "image",
    "question",
    "answer",
    "footnote",
]


@dataclass(frozen=True)
class FileAsset:
    content: bytes
    filename: str
    mime_type: str
    content_hash: str

    @classmethod
    def from_bytes(cls, content: bytes, filename: str, mime_type: str | None = None) -> "FileAsset":
        guessed_type, _ = mimetypes.guess_type(filename)
        return cls(
            content=content,
            filename=filename,
            mime_type=mime_type or guessed_type or "application/octet-stream",
            content_hash=hashlib.sha1(content).hexdigest(),
        )


@dataclass
class DocumentBlock:
    block_id: str
    block_type: BlockType
    text: str
    page_start: int
    page_end: int
    line_start: int | None = None
    line_end: int | None = None
    section_path: list[str] = field(default_factory=list)
    confidence: float = 1.0
    structured_payload: dict[str, Any] = field(default_factory=dict)
    bbox: list[float] | None = None

    @property
    def primary_section(self) -> str:
        return " / ".join(self.section_path)


@dataclass
class DocumentPage:
    page_number: int
    page_type: str
    text_density: float
    quality_score: float
    extracted_chars: int
    block_ids: list[str] = field(default_factory=list)
    width: float | None = None
    height: float | None = None


@dataclass
class DocumentAst:
    doc_type: str
    filename: str
    content_hash: str
    pages: list[DocumentPage]
    blocks: list[DocumentBlock]
    metadata: dict[str, Any] = field(default_factory=dict)

    def plain_text(self) -> str:
        return "\n\n".join(block.text for block in self.blocks if block.text.strip())


@dataclass
class ParseArtifact:
    document: DocumentAst
    page_signals: list[PageSignal]
    parse_profile: dict[str, Any]
