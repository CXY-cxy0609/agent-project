"""
Query 预处理器
① 科目识别 — 从 Query 推断所属科目，缩小检索范围
② Query 扩展（HyDE）— 生成假设性答案，提升检索召回率
"""

from __future__ import annotations

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# 科目关键词映射（简单规则匹配，无需 LLM）
SUBJECT_KEYWORDS: dict[str, list[str]] = {
    "math": ["数学", "积分", "导数", "极限", "矩阵", "行列式", "概率", "微分", "函数", "方程"],
    "english": ["英语", "语法", "词汇", "阅读", "写作", "翻译", "完形", "听力"],
    "politics": ["政治", "马克思", "毛泽东", "邓小平", "习近平", "哲学", "经济学", "历史"],
    "history": ["历史", "朝代", "战争", "改革", "政策", "文化"],
}


def detect_subject(query: str, hint_subject_id: Optional[str] = None) -> Optional[str]:
    """
    从 Query 中推断科目
    优先使用 hint_subject_id，其次关键词匹配
    """
    if hint_subject_id:
        return hint_subject_id

    for subject, keywords in SUBJECT_KEYWORDS.items():
        for kw in keywords:
            if kw in query:
                return subject

    return None


def build_hyde_query(query: str, subject: Optional[str] = None) -> Optional[str]:
    """
    HyDE (Hypothetical Document Embeddings)：
    构造假设性答案文本，用于提升检索召回率

    当前实现：基于模板的简单扩展（避免调用 LLM 增加延迟）
    生产环境可替换为调用 claude-haiku 生成更高质量假设答案
    """
    subject_context = f"关于{subject}的" if subject else ""

    # 简单模板：将问题转化为答案形式
    hyde_text = f"以下是{subject_context}题目的解答思路：\n"

    # 提取问题中的数学公式（保留在扩展文本中）
    formulas = re.findall(r"\$[^$]+\$|\$\$[^$]+\$\$", query)
    if formulas:
        hyde_text += f"涉及公式：{' '.join(formulas)}\n"

    hyde_text += f"原始问题：{query}"
    return hyde_text


class QueryPreprocessor:
    def preprocess(
        self,
        query: str,
        subject_id: Optional[str] = None,
        use_hyde: bool = True,
    ) -> "PreprocessedQuery":
        detected_subject = detect_subject(query, subject_id)
        hyde_query = build_hyde_query(query, detected_subject) if use_hyde else None

        return PreprocessedQuery(
            original_query=query,
            processed_query=query,
            hyde_query=hyde_query,
            detected_subject=detected_subject,
        )


class PreprocessedQuery:
    def __init__(
        self,
        original_query: str,
        processed_query: str,
        hyde_query: Optional[str],
        detected_subject: Optional[str],
    ) -> None:
        self.original_query = original_query
        self.processed_query = processed_query
        self.hyde_query = hyde_query
        self.detected_subject = detected_subject


query_preprocessor = QueryPreprocessor()
