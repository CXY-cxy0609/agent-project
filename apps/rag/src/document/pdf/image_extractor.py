from __future__ import annotations

from .pdf_models import PdfImageRegion


def describe_image_region(region: PdfImageRegion, nearby_caption: str = "") -> str:
    parts = [f"[第 {region.page_number} 页图片区域]"]
    if nearby_caption:
        parts.append(f"图注：{nearby_caption}")
    parts.append("该区域包含 PDF 图片内容，已作为视觉证据块入库；如需精确识别，请触发 OCR/视觉模型精处理。")
    return "\n".join(parts)


def enrich_image_region(region: PdfImageRegion, nearby_caption: str = "") -> PdfImageRegion:
    region.caption = nearby_caption
    region.structured_payload.update(
        {
            "image": {
                "image_type": "embedded_pdf_image",
                "caption": nearby_caption,
                "ocr_required": True,
                "vision_required": True,
                "image_hash": region.image_hash,
            },
            "extractor": "pdf-image-region-v1",
        }
    )
    return region
