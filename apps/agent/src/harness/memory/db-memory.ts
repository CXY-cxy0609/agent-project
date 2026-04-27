/**
 * DB 记忆 — 学情记录持久化，通过 HTTP 调用后端服务
 */

import type { StructuredMemory, LearningRecord, MemoryFilter } from '../core/types.js';

const DEFAULT_TIMEOUT_MS = 3000;

export class HttpStructuredMemory implements StructuredMemory {
  constructor(
    private readonly serverUrl: string,
    private readonly internalToken: string,
  ) {}

  async write(record: LearningRecord): Promise<void> {
    try {
      await fetch(`${this.serverUrl}/api/learning-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': this.internalToken,
        },
        body: JSON.stringify(record),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch {
      // 写入失败不影响主链路
    }
  }

  async query(userId: string, filters: MemoryFilter): Promise<LearningRecord[]> {
    try {
      const params = new URLSearchParams({ user_id: userId });
      if (filters.subject) params.set('subject', filters.subject);
      if (filters.chapter) params.set('chapter', filters.chapter);
      if (filters.limit) params.set('limit', String(filters.limit));

      const res = await fetch(
        `${this.serverUrl}/api/learning-records?${params.toString()}`,
        {
          headers: { 'x-internal-token': this.internalToken },
          signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        },
      );

      if (!res.ok) return [];
      return (await res.json()) as LearningRecord[];
    } catch {
      return [];
    }
  }
}
