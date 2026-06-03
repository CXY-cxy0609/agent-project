from __future__ import annotations

import csv
import html
import io
import re
import zipfile
from xml.etree import ElementTree


def extract_office_or_text(content: bytes, filename: str) -> tuple[str, str]:
    lower = filename.lower()
    if lower.endswith(".docx"):
        return _extract_docx(content), "docx"
    if lower.endswith(".pptx"):
        return _extract_pptx(content), "pptx"
    if lower.endswith(".xlsx"):
        return _extract_xlsx(content), "xlsx"
    if lower.endswith(".csv"):
        return _extract_csv(content), "csv"
    if lower.endswith((".html", ".htm")):
        return _extract_html(content), "html"
    return content.decode("utf-8", errors="ignore"), "plain_text"


def _extract_docx(content: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        xml = archive.read("word/document.xml")
    root = ElementTree.fromstring(xml)
    paragraphs: list[str] = []
    for paragraph in root.iter(_ns("w:p")):
        texts = [node.text or "" for node in paragraph.iter(_ns("w:t"))]
        if texts:
            paragraphs.append("".join(texts).strip())
    return "\n\n".join(p for p in paragraphs if p)


def _extract_pptx(content: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        slide_names = sorted(
            name
            for name in archive.namelist()
            if name.startswith("ppt/slides/slide") and name.endswith(".xml")
        )
        slides: list[str] = []
        for index, name in enumerate(slide_names, start=1):
            root = ElementTree.fromstring(archive.read(name))
            texts = [node.text or "" for node in root.iter(_ns("a:t"))]
            body = "\n".join(text.strip() for text in texts if text.strip())
            if body:
                slides.append(f"[第 {index} 页]\n{body}")
    return "\n\n".join(slides)


def _extract_xlsx(content: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        shared_strings = _xlsx_shared_strings(archive)
        sheet_names = sorted(
            name
            for name in archive.namelist()
            if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
        )
        sheets: list[str] = []
        for index, name in enumerate(sheet_names, start=1):
            root = ElementTree.fromstring(archive.read(name))
            rows: list[str] = []
            for row in root.iter(_ns("main:row")):
                values = [_xlsx_cell_value(cell, shared_strings) for cell in row.iter(_ns("main:c"))]
                values = [value for value in values if value]
                if values:
                    rows.append(" | ".join(values))
            if rows:
                sheets.append(f"# Sheet {index}\n" + "\n".join(rows))
    return "\n\n".join(sheets)


def _xlsx_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    try:
        root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    values: list[str] = []
    for item in root.iter(_ns("main:si")):
        text = "".join(node.text or "" for node in item.iter(_ns("main:t")))
        values.append(text)
    return values


def _xlsx_cell_value(cell: ElementTree.Element, shared_strings: list[str]) -> str:
    value_node = cell.find(_ns("main:v"))
    if value_node is None or value_node.text is None:
        return ""
    if cell.attrib.get("t") == "s":
        try:
            return shared_strings[int(value_node.text)]
        except (ValueError, IndexError):
            return ""
    return value_node.text


def _extract_csv(content: bytes) -> str:
    text = content.decode("utf-8-sig", errors="ignore")
    rows = csv.reader(io.StringIO(text))
    return "\n".join(" | ".join(cell.strip() for cell in row) for row in rows)


def _extract_html(content: bytes) -> str:
    text = content.decode("utf-8", errors="ignore")
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", text)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(p|div|li|h[1-6]|tr)>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return html.unescape(re.sub(r"[ \t]+", " ", text)).strip()


def _ns(name: str) -> str:
    namespaces = {
        "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    }
    if ":" in name:
        prefix, local = name.split(":", 1)
        return f"{{{namespaces[prefix]}}}{local}"
    return f"{{{namespaces['w']}}}{name.split(':')[-1]}"
