/**
 * 短期记忆 — 维护当前会话的多轮上下文
 * 存储：Redis（支持 TTL 自动过期）
 * 策略：保留最近 N 轮，超出时 FIFO 淘汰
 */

import type { ShortTermMemory, Message } from '../core/types.js';
import type Redis from 'ioredis';

const DEFAULT_MAX_TURNS = 10;
const DEFAULT_TTL_SECONDS = 3600; // 1 小时
const DEFAULT_SUMMARY_MAX_CHARS = 1800;
const SUMMARY_SAMPLE_MESSAGES = 8;

export class RedisShortTermMemory implements ShortTermMemory {
  constructor(
    private readonly redis: Redis,
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
    private readonly ttlSeconds: number = DEFAULT_TTL_SECONDS,
    private readonly summaryMaxChars: number = DEFAULT_SUMMARY_MAX_CHARS,
  ) {}

  async getHistory(sessionId: string): Promise<Message[]> {
    const [recent, summary] = await Promise.all([
      this.getRawHistory(sessionId),
      this.getSummary(sessionId),
    ]);
    if (!summary) return recent;
    return [buildSummaryMessage(summary), ...recent];
  }

  async appendHistory(sessionId: string, messages: Message[]): Promise<void> {
    const existing = await this.getRawHistory(sessionId);
    const existingSummary = await this.getSummary(sessionId);

    const updated = [...existing, ...messages];
    const { kept, evicted } = splitForWindow(updated, this.maxTurns * 2);
    const nextSummary = evicted.length
      ? mergeSummary(
          existingSummary,
          buildSummaryFromMessages(evicted),
          this.summaryMaxChars,
        )
      : existingSummary;

    await this.redis.set(this.makeKey(sessionId), JSON.stringify(kept), 'EX', this.ttlSeconds);
    if (nextSummary) {
      await this.redis.set(this.makeSummaryKey(sessionId), nextSummary, 'EX', this.ttlSeconds);
    } else {
      await this.redis.del(this.makeSummaryKey(sessionId));
    }
  }

  async clearHistory(sessionId: string): Promise<void> {
    await this.redis.del(this.makeKey(sessionId), this.makeSummaryKey(sessionId));
  }

  private makeKey(sessionId: string): string {
    return `session:memory:${sessionId}`;
  }

  private makeSummaryKey(sessionId: string): string {
    return `session:memory:summary:${sessionId}`;
  }

  private async getRawHistory(sessionId: string): Promise<Message[]> {
    const raw = await this.redis.get(this.makeKey(sessionId));
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Message[];
    } catch {
      return [];
    }
  }

  private async getSummary(sessionId: string): Promise<string> {
    return (await this.redis.get(this.makeSummaryKey(sessionId))) ?? '';
  }
}

/** 内存版短期记忆（开发/测试用，不依赖 Redis） */
export class InMemoryShortTermMemory implements ShortTermMemory {
  private store = new Map<string, Message[]>();
  private summaries = new Map<string, string>();

  constructor(
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
    private readonly summaryMaxChars: number = DEFAULT_SUMMARY_MAX_CHARS,
  ) {}

  async getHistory(sessionId: string): Promise<Message[]> {
    const recent = this.store.get(sessionId) ?? [];
    const summary = this.summaries.get(sessionId) ?? '';
    if (!summary) return recent;
    return [buildSummaryMessage(summary), ...recent];
  }

  async appendHistory(sessionId: string, messages: Message[]): Promise<void> {
    const existing = this.store.get(sessionId) ?? [];
    const updated = [...existing, ...messages];
    const { kept, evicted } = splitForWindow(updated, this.maxTurns * 2);
    this.store.set(sessionId, kept);

    const existingSummary = this.summaries.get(sessionId) ?? '';
    const nextSummary = evicted.length
      ? mergeSummary(
          existingSummary,
          buildSummaryFromMessages(evicted),
          this.summaryMaxChars,
        )
      : existingSummary;

    if (nextSummary) {
      this.summaries.set(sessionId, nextSummary);
    } else {
      this.summaries.delete(sessionId);
    }
  }

  async clearHistory(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
    this.summaries.delete(sessionId);
  }
}

function splitForWindow(messages: Message[], maxMessages: number): {
  kept: Message[];
  evicted: Message[];
} {
  if (messages.length <= maxMessages) {
    return { kept: messages, evicted: [] };
  }
  const splitIndex = messages.length - maxMessages;
  return {
    evicted: messages.slice(0, splitIndex),
    kept: messages.slice(splitIndex),
  };
}

function buildSummaryMessage(summary: string): Message {
  return {
    role: 'assistant',
    content:
      `[较早对话摘要]\n${summary}\n\n` +
      '以上为早期轮次摘要，请结合后续原始对话继续回答。',
  };
}

function buildSummaryFromMessages(messages: Message[]): string {
  const sampled = messages.slice(-SUMMARY_SAMPLE_MESSAGES);
  const lines = sampled.map((msg) => {
    const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统';
    const content = truncateText(compactMessageContent(msg.content), 120);
    return `- ${role}：${content}`;
  });
  return lines.join('\n');
}

function mergeSummary(previous: string, incremental: string, maxChars: number): string {
  const merged = previous ? `${previous}\n${incremental}` : incremental;
  if (merged.length <= maxChars) return merged;
  return `...${merged.slice(merged.length - maxChars + 3)}`;
}

function compactMessageContent(content: Message['content']): string {
  const raw = typeof content === 'string'
    ? content
    : content
        .map((block) => (block.type === 'text' ? block.text : '[图片]'))
        .join(' ');
  return raw.replace(/\s+/g, ' ').trim();
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3)}...`;
}
