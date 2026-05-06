/**
 * RAG Client — HTTP 适配器，封装对 apps/rag（Python FastAPI）的调用
 * RAG 的检索/Rerank/上下文构建逻辑全在 apps/rag/ 中实现
 * 这里只做类型化的 HTTP 封装，不在 TS 层重复实现检索逻辑
 */

import type Redis from 'ioredis';
import { createHash } from 'crypto';

const DEFAULT_TIMEOUT_MS = 5000;
const CACHE_TTL_SECONDS = 300; // 5 分钟

export type RetrievalMode = 'text_only' | 'hybrid_visual';

export interface RetrievedChunk {
  content: string;
  source: 'document' | 'database';
  metadata: {
    subject: string;
    documentPath?: string;
    chapter?: string;
    pageNumber?: number;
    score: number;
  };
}

export interface RetrievalOptions {
  subjectId: string;
  knowledgeBaseId?: string;
  topK?: number;
  retrievalMode?: RetrievalMode;
  budgetTokens?: number;
  maxUpgradePages?: number;
}

export interface RetrieveResponse {
  context: string;
  chunks: RetrievedChunk[];
}

export class RagClient {
  constructor(
    private readonly ragServiceUrl: string,
    private readonly redis?: Redis,
  ) {}

  async retrieve(query: string, options: RetrievalOptions): Promise<RetrieveResponse> {
    const cacheKey = this.makeCacheKey(query, options);

    // 尝试从 Redis 缓存读取
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as RetrieveResponse;
      } catch {
        // 缓存失败不影响主链路
      }
    }

    const res = await fetchWithTimeout(
      `${this.ragServiceUrl}/retrieve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          subject_id: options.subjectId,
          knowledge_base_id: options.knowledgeBaseId,
          top_k: options.topK ?? 5,
          retrieval_mode: options.retrievalMode ?? 'text_only',
          budget_tokens: options.budgetTokens,
          max_upgrade_pages: options.maxUpgradePages,
        }),
      },
      DEFAULT_TIMEOUT_MS,
    );

    if (!res.ok) {
      throw new Error(`RAG service error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { context: string; chunks?: RetrievedChunk[] };
    const result: RetrieveResponse = {
      context: data.context,
      chunks: data.chunks ?? [],
    };

    // 写入缓存
    if (this.redis) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
      } catch {
        // 缓存写入失败不影响主链路
      }
    }

    return result;
  }

  private makeCacheKey(query: string, options: RetrievalOptions): string {
    const dynamicPolicyParts: string[] = [];
    if (options.retrievalMode) dynamicPolicyParts.push(`mode=${options.retrievalMode}`);
    if (typeof options.budgetTokens === 'number') {
      dynamicPolicyParts.push(`budget=${options.budgetTokens}`);
    }
    if (typeof options.maxUpgradePages === 'number') {
      dynamicPolicyParts.push(`pages=${options.maxUpgradePages}`);
    }
    const policySuffix = dynamicPolicyParts.length ? `:${dynamicPolicyParts.join('|')}` : '';
    const hash = createHash('md5')
      .update(`${query}:${options.subjectId}:${options.knowledgeBaseId ?? ''}${policySuffix}`)
      .digest('hex');
    return `rag:cache:${hash}`;
  }
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}
