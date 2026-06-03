from __future__ import annotations


def ocr_placeholder_text(page_number: int, reason: str) -> str:
    return (
        f"[第 {page_number} 页 OCR 待处理]\n"
        f"触发原因：{reason}。\n"
        "当前页被识别为图片型或低文本覆盖率页面，已保留为低置信视觉证据块；"
        "后续可接入 RapidOCR/PaddleOCR/云 OCR 生成真实文本。"
    )
