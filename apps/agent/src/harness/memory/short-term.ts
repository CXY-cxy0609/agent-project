/**
 * 短期记忆 — 维护当前会话的多轮上下文
 * 存储：Redis（支持 TTL 自动过期）
 * 策略：保留最近 N 轮，超出时 FIFO 淘汰
 */

import type { ShortTermMemory, Message } from '../core/types.js';
import type Redis from 'ioredis';

const DEFAULT_MAX_TURNS = 10;
const DEFAULT_TTL_SECONDS = 3600; // 1 小时

export class RedisShortTermMemory implements ShortTermMemory {
  constructor(
    private readonly redis: Redis,
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
    private readonly ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ) {}

  async getHistory(sessionId: string): Promise<Message[]> {
    const key = this.makeKey(sessionId);
    const raw = await this.redis.get(key);
    if (!raw) return [];

    try {
      return JSON.parse(raw) as Message[];
    } catch {
      return [];
    }
  }

  async appendHistory(sessionId: string, messages: Message[]): Promise<void> {
    const key = this.makeKey(sessionId);
    const existing = await this.getHistory(sessionId);

    const updated = [...existing, ...messages];
    const trimmed = this.trim(updated);

    await this.redis.set(key, JSON.stringify(trimmed), 'EX', this.ttlSeconds);
  }

  async clearHistory(sessionId: string): Promise<void> {
    await this.redis.del(this.makeKey(sessionId));
  }

  private trim(messages: Message[]): Message[] {
    const maxMessages = this.maxTurns * 2; // 每轮 user + assistant
    if (messages.length <= maxMessages) return messages;
    return messages.slice(messages.length - maxMessages);
  }

  private makeKey(sessionId: string): string {
    return `session:memory:${sessionId}`;
  }
}

/** 内存版短期记忆（开发/测试用，不依赖 Redis） */
export class InMemoryShortTermMemory implements ShortTermMemory {
  private store = new Map<string, Message[]>();

  constructor(private readonly maxTurns: number = DEFAULT_MAX_TURNS) {}

  async getHistory(sessionId: string): Promise<Message[]> {
    return this.store.get(sessionId) ?? [];
  }

  async appendHistory(sessionId: string, messages: Message[]): Promise<void> {
    const existing = await this.getHistory(sessionId);
    const updated = [...existing, ...messages];
    const maxMessages = this.maxTurns * 2;
    this.store.set(
      sessionId,
      updated.length > maxMessages ? updated.slice(updated.length - maxMessages) : updated,
    );
  }

  async clearHistory(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }
}
