from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Literal

from ..core.errors import NotFoundError
from ..core.metrics import INDEX_TASK_TOTAL

logger = logging.getLogger(__name__)

TaskStatus = Literal["queued", "running", "succeeded", "failed"]


@dataclass
class IndexTaskRecord:
    task_id: str
    task_type: str
    status: TaskStatus
    payload: dict[str, Any]
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


class IndexTaskService:
    def __init__(self) -> None:
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._records: dict[str, IndexTaskRecord] = {}
        self._events: dict[str, asyncio.Event] = {}
        self._handlers: dict[str, Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]] = {}
        self._worker: asyncio.Task | None = None
        self._stopping = False

    def register_handler(
        self,
        task_type: str,
        handler: Callable[[dict[str, Any]], Awaitable[dict[str, Any]]],
    ) -> None:
        self._handlers[task_type] = handler

    async def start(self) -> None:
        if self._worker and not self._worker.done():
            return
        self._stopping = False
        self._worker = asyncio.create_task(self._run_worker(), name="rag-index-worker")

    async def stop(self) -> None:
        self._stopping = True
        if self._worker and not self._worker.done():
            self._worker.cancel()
            try:
                await self._worker
            except asyncio.CancelledError:
                pass

    async def enqueue(self, task_type: str, payload: dict[str, Any]) -> IndexTaskRecord:
        if task_type not in self._handlers:
            raise ValueError(f"unsupported task type: {task_type}")
        task_id = str(uuid.uuid4())
        record = IndexTaskRecord(
            task_id=task_id,
            task_type=task_type,
            status="queued",
            payload=payload,
        )
        self._records[task_id] = record
        self._events[task_id] = asyncio.Event()
        await self._queue.put(task_id)
        INDEX_TASK_TOTAL.labels("queued").inc()
        return record

    def get(self, task_id: str) -> IndexTaskRecord:
        record = self._records.get(task_id)
        if not record:
            raise NotFoundError(f"task {task_id} not found")
        return record

    async def wait(self, task_id: str, timeout_seconds: float) -> IndexTaskRecord:
        event = self._events.get(task_id)
        if not event:
            return self.get(task_id)
        try:
            await asyncio.wait_for(event.wait(), timeout=timeout_seconds)
        except TimeoutError:
            return self.get(task_id)
        return self.get(task_id)

    async def _run_worker(self) -> None:
        while not self._stopping:
            task_id = await self._queue.get()
            record = self._records.get(task_id)
            if not record:
                self._queue.task_done()
                continue
            handler = self._handlers.get(record.task_type)
            if not handler:
                record.status = "failed"
                record.error = f"handler not found for {record.task_type}"
                record.updated_at = time.time()
                INDEX_TASK_TOTAL.labels("failed").inc()
                self._notify_done(task_id)
                self._queue.task_done()
                continue
            record.status = "running"
            record.updated_at = time.time()
            try:
                result = await handler(record.payload)
                record.status = "succeeded"
                record.result = result
                INDEX_TASK_TOTAL.labels("succeeded").inc()
            except Exception as exc:  # noqa: BLE001
                logger.exception("index task failed", extra={"task_id": task_id})
                record.status = "failed"
                record.error = str(exc)
                INDEX_TASK_TOTAL.labels("failed").inc()
            finally:
                record.updated_at = time.time()
                self._notify_done(task_id)
                self._queue.task_done()

    def _notify_done(self, task_id: str) -> None:
        event = self._events.get(task_id)
        if event:
            event.set()


index_task_service = IndexTaskService()
