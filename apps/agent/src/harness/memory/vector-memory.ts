/**
 * 向量记忆 — 通过 RAG 服务 HTTP 接口实现语义检索
 * 两种用途：用户级历史记忆 + 内容级视频缓存
 */

import type { UserVectorMemory, ContentVectorCache, CachedContent } from '../core/types.js';

const DEFAULT_TIMEOUT_MS = 3000;

interface RagSearchResponse {
  results: Array<{ content: string; score: number; payload?: unknown }>;
}

export class HttpUserVectorMemory implements UserVectorMemory {
  constructor(private readonly ragServiceUrl: string) {}

  async search(query: string, userId: string, topK: number): Promise<string[]> {
    try {
      const res = await fetchWithTimeout(
        `${this.ragServiceUrl}/memory/user/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, user_id: userId, top_k: topK }),
        },
        DEFAULT_TIMEOUT_MS,
      );

      if (!res.ok) return [];
      const data = (await res.json()) as RagSearchResponse;
      return data.results.map((r) => r.content);
    } catch {
      return [];
    }
  }

  async store(userId: string, content: string): Promise<void> {
    try {
      await fetchWithTimeout(
        `${this.ragServiceUrl}/memory/user/store`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, content }),
        },
        DEFAULT_TIMEOUT_MS,
      );
    } catch {
      // 写入失败不影响主链路
    }
  }
}

export class HttpContentVectorCache implements ContentVectorCache {
  constructor(private readonly ragServiceUrl: string) {}

  async search(query: string, topK: number): Promise<CachedContent[]> {
    try {
      const res = await fetchWithTimeout(
        `${this.ragServiceUrl}/memory/content/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, top_k: topK }),
        },
        DEFAULT_TIMEOUT_MS,
      );

      if (!res.ok) return [];
      const data = (await res.json()) as RagSearchResponse;
      return data.results.map((r) => ({
        contentKey: r.content,
        payload: r.payload,
        score: r.score,
      }));
    } catch {
      return [];
    }
  }

  async store(content: string, cachedContent: CachedContent): Promise<void> {
    try {
      await fetchWithTimeout(
        `${this.ragServiceUrl}/memory/content/store`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, payload: cachedContent }),
        },
        DEFAULT_TIMEOUT_MS,
      );
    } catch {
      // 写入失败不影响主链路
    }
  }
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}
