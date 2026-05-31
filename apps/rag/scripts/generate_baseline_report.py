from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


def main() -> None:
    now = datetime.now(timezone.utc).isoformat()
    report = {
        "generated_at": now,
        "notes": [
            "请在运行 k6 压测后，将输出统计粘贴到本文件对应字段。",
            "建议记录 P50/P95/P99、error rate、RPS、CPU、内存、Qdrant 查询耗时。",
        ],
        "targets": {
            "retrieve_p95_ms": 800,
            "retrieve_p99_ms": 1500,
            "error_rate": "<1%",
        },
        "actual": {
            "retrieve_p95_ms": None,
            "retrieve_p99_ms": None,
            "error_rate": None,
            "rps": None,
        },
    }
    output_dir = Path("reports")
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / "capacity-baseline.json"
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"baseline report generated: {output_path}")


if __name__ == "__main__":
    main()
