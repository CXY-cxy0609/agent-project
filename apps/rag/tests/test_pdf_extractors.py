from src.document.pdf.formula_extractor import normalize_formula_block
from src.document.pdf.layout_analyzer import assign_columns, classify_text_block
from src.document.pdf.pdf_models import PdfTextBlock
from src.document.pdf.table_extractor import normalize_table_block


def test_table_block_normalizes_to_markdown() -> None:
    block = PdfTextBlock(
        text="科目  平均分  最高分\n数学  82  100\n英语  76  95",
        bbox=[0, 0, 200, 60],
        page_number=1,
        block_type="table",
    )

    normalized = normalize_table_block(block)

    assert normalized.block_type == "table"
    assert "| 科目 | 平均分 | 最高分 |" in normalized.text
    assert normalized.structured_payload["table"]["row_count"] == 2


def test_formula_block_adds_latex_payload() -> None:
    block = PdfTextBlock(
        text="∫_0^1 x^2 dx = 1/3",
        bbox=[0, 0, 200, 20],
        page_number=1,
        block_type="formula",
    )

    normalized = normalize_formula_block(block)

    assert normalized.block_type == "formula"
    assert "\\int" in normalized.structured_payload["formula"]["latex"]


def test_assign_columns_detects_two_columns() -> None:
    blocks = [
        PdfTextBlock(text="left 1", bbox=[10, 10, 120, 30], page_number=1),
        PdfTextBlock(text="left 2", bbox=[10, 40, 120, 60], page_number=1),
        PdfTextBlock(text="left 3", bbox=[10, 70, 120, 90], page_number=1),
        PdfTextBlock(text="right 1", bbox=[320, 10, 450, 30], page_number=1),
        PdfTextBlock(text="right 2", bbox=[320, 40, 450, 60], page_number=1),
        PdfTextBlock(text="right 3", bbox=[320, 70, 450, 90], page_number=1),
    ]

    column_count = assign_columns(blocks, page_width=500)

    assert column_count == 2
    assert {block.column_id for block in blocks} == {"left", "right"}


def test_classify_text_block_detects_formula() -> None:
    assert classify_text_block("f(x)=x^2") == "formula"
