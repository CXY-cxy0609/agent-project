from src.pipeline.retrieval_pipeline import _candidate_identity


def test_candidate_identity_prefers_chunk_id() -> None:
    assert _candidate_identity({"chunk_id": "c1", "doc_id": "d1"}) == "c1"


def test_candidate_identity_includes_version_scope() -> None:
    first = _candidate_identity(
        {
            "tenant_id": "t1",
            "knowledge_base_id": "kb1",
            "doc_id": "d1",
            "doc_version": 1,
            "chunk_index": 0,
        }
    )
    second = _candidate_identity(
        {
            "tenant_id": "t1",
            "knowledge_base_id": "kb1",
            "doc_id": "d1",
            "doc_version": 2,
            "chunk_index": 0,
        }
    )

    assert first != second
