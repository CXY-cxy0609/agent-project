from __future__ import annotations

from prometheus_client import Counter, Histogram, Gauge


REQUEST_TOTAL = Counter(
    "rag_request_total",
    "Total HTTP requests",
    ["path", "method", "status"],
)

REQUEST_LATENCY_SECONDS = Histogram(
    "rag_request_latency_seconds",
    "HTTP request latency in seconds",
    ["path", "method"],
    buckets=(0.01, 0.03, 0.05, 0.1, 0.2, 0.4, 0.8, 1.5, 3, 5, 10),
)

RETRIEVE_STAGE_LATENCY_SECONDS = Histogram(
    "rag_retrieve_stage_latency_seconds",
    "Latency of retrieve pipeline stage",
    ["stage"],
    buckets=(0.01, 0.03, 0.05, 0.1, 0.2, 0.4, 0.8, 1.5, 3, 5),
)

DEGRADE_TOTAL = Counter(
    "rag_degrade_total",
    "Total degrade events by level",
    ["level"],
)

QDRANT_HEALTH = Gauge(
    "rag_qdrant_health",
    "Qdrant health status (1 healthy, 0 unhealthy)",
)

INDEX_TASK_TOTAL = Counter(
    "rag_index_task_total",
    "Total index tasks by status",
    ["status"],
)
