/**
 * Harness Core Types
 * 所有类型使用原生 { role, content } 结构，直接对应 Anthropic API 格式
 */

// ─── Message Types ─────────────────────────────────────────────────────────

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export type ContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: ImageMediaType; data: string };
    };

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentBlock[];
}

// ─── Tool Types ─────────────────────────────────────────────────────────────

export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  description?: string;
  enum?: string[];
  [key: string]: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JsonSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// ─── LLM Call & Response ─────────────────────────────────────────────────────

export interface LLMCallOptions {
  model: string;
  messages: Message[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  /** 在第 N 条 message 后插入 cache_control breakpoint（0 表示不缓存） */
  cacheBreakpoint?: number;
  /** 启用 extended thinking（Claude 3.7+） */
  extendedThinking?: boolean;
  thinkingBudgetTokens?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  latencyMs: number;
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

export interface StreamChunk {
  type: 'text_delta' | 'tool_call_delta' | 'done';
  delta?: string;
  finalResponse?: LLMResponse;
}

// ─── Agent Context ────────────────────────────────────────────────────────────

export interface AgentContext {
  userId: string;
  sessionId: string;
  traceId: string;
  metadata?: Record<string, unknown>;
}

// ─── Memory Interfaces ────────────────────────────────────────────────────────

export interface ShortTermMemory {
  getHistory(sessionId: string): Promise<Message[]>;
  appendHistory(sessionId: string, messages: Message[]): Promise<void>;
  clearHistory(sessionId: string): Promise<void>;
}

export interface UserVectorMemory {
  search(query: string, userId: string, topK: number): Promise<string[]>;
  store(userId: string, content: string): Promise<void>;
}

export interface CachedContent {
  contentKey: string;
  payload: unknown;
  score?: number;
}

export interface ContentVectorCache {
  search(query: string, topK: number): Promise<CachedContent[]>;
  store(content: string, payload: CachedContent): Promise<void>;
}

export interface LearningRecord {
  userId: string;
  sessionId: string;
  subject: string;
  chapter?: string;
  knowledgePoint: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  askedAt?: Date;
}

export interface MemoryFilter {
  subject?: string;
  chapter?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface StructuredMemory {
  write(record: LearningRecord): Promise<void>;
  query(userId: string, filters: MemoryFilter): Promise<LearningRecord[]>;
}

// ─── Graph Stream Events ────────────────────────────────────────────────────

export type GraphStreamEvent<S> =
  | { type: 'node_start'; node: string }
  | { type: 'node_done'; node: string; delta: Partial<S> }
  | { type: 'token'; node: string; token: string }
  | { type: 'graph_done'; finalState: S };
