from src.indexer.chunker import chunk_document
from src.indexer.document_parser import parse_document
from src.indexer.parser_models import ParseOptions


def test_parse_markdown_builds_document_ast() -> None:
    parsed = parse_document(
        b"# Chapter\n\nShort definition.\n\n| A | B |\n| - | - |\n| 1 | 2 |",
        "sample.md",
        options=ParseOptions(mode="balanced"),
    )

    assert parsed.document.doc_type == "markdown"
    assert parsed.document.pages[0].page_number == 1
    assert any(block.block_type == "heading" for block in parsed.document.blocks)
    assert any(block.block_type == "table" for block in parsed.document.blocks)


def test_chunk_document_preserves_short_structural_blocks() -> None:
    parsed = parse_document(b"# A\n\n$x$", "math.md")

    chunks = chunk_document(
        parsed.document,
        {"tenant_id": "t1", "doc_id": "d1", "knowledge_base_id": "kb1"},
        max_tokens=128,
        min_tokens=50,
        overlap_ratio=0.1,
    )

    assert chunks
    assert any("page_start" in chunk.metadata for chunk in chunks)
    assert any("block_ids" in chunk.metadata for chunk in chunks)
    assert "$x$" in "\n".join(chunk.text for chunk in chunks)
