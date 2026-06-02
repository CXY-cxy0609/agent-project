/**
 * LLMClient — 多 Provider 支持
 * 通过 LLM_PROVIDER 环境变量切换 anthropic | doubao
 * 对外暴露统一的 ILLMClient 接口，其余代码无需感知 Provider 差异
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type {
  LLMCallOptions,
  LLMResponse,
  StreamChunk,
  ToolCall,
  ToolDefinition,
  TokenUsage,
} from './types.js';
import { withRetry, isRetryableLLMError } from './retry.js';

const DEFAULT_LOG_MAX_CHARS = 4000;

// ─── 公共接口 ─────────────────────────────────────────────────────────────────

export interface ILLMClient {
  call(options: LLMCallOptions): Promise<LLMResponse>;
  stream(options: LLMCallOptions): AsyncGenerator<StreamChunk>;
}

/** 向后兼容别名：现有代码中 `LLMClient` 类型引用不变 */
export type LLMClient = ILLMClient;

// ─── 工厂配置 ─────────────────────────────────────────────────────────────────

export interface LLMClientConfig {
  provider?: 'anthropic' | 'doubao';
  anthropicApiKey?: string;
  doubaoApiKey?: string;
  /** 豆包 API BaseURL，默认为火山引擎北京区 */
  doubaoBaseUrl?: string;
}

export function createLLMClient(config?: LLMClientConfig): ILLMClient {
  const provider =
    config?.provider ??
    (process.env.LLM_PROVIDER as 'anthropic' | 'doubao' | undefined) ??
    'anthropic';

  if (provider === 'doubao') {
    return new DoubaoLLMClient(
      config?.doubaoApiKey ?? process.env.DOUBAO_API_KEY ?? '',
      config?.doubaoBaseUrl ??
        process.env.DOUBAO_BASE_URL ??
        'https://ark.cn-beijing.volces.com/api/v3',
    );
  }

  return new AnthropicLLMClient(config?.anthropicApiKey);
}

// ─── Anthropic 实现 ───────────────────────────────────────────────────────────

class AnthropicLLMClient implements ILLMClient {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  async call(options: LLMCallOptions): Promise<LLMResponse> {
    return withRetry(
      () => this.callOnce(options),
      {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelayMs: 1000,
        retryOn: isRetryableLLMError,
      },
    );
  }

  async *stream(options: LLMCallOptions): AsyncGenerator<StreamChunk> {
    const start = Date.now();
    const params = this.buildParams(options);

    const stream = await this.client.messages.stream({
      ...params,
      stream: true,
    } as Parameters<typeof this.client.messages.stream>[0]);

    let fullText = '';
    const toolCallAcc: Record<number, { id: string; name: string; args: string }> = {};
    beginLLMStreamResponseContent('anthropic');

    for await (const event of stream) {
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        toolCallAcc[event.index] = {
          id: event.content_block.id,
          name: event.content_block.name,
          args: '',
        };
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullText += event.delta.text;
          logLLMStreamDelta('anthropic', event.delta.text);
          yield { type: 'text_delta', delta: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          const toolCall = toolCallAcc[event.index];
          if (toolCall) {
            toolCall.args += event.delta.partial_json;
          }
        }
      }
    }

    endLLMStreamResponseContent();
    const finalMsg = await stream.finalMessage();
    const toolCalls = extractAnthropicToolCalls(finalMsg.content, toolCallAcc);
    const response: LLMResponse = {
      content: fullText,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: extractAnthropicUsage(finalMsg.usage),
      model: finalMsg.model,
      latencyMs: Date.now() - start,
      stopReason: (finalMsg.stop_reason ?? 'end_turn') as LLMResponse['stopReason'],
    };
    logLLMResponse('anthropic', 'stream', options, response);
    yield { type: 'done', finalResponse: response };
  }

  private async callOnce(options: LLMCallOptions): Promise<LLMResponse> {
    return collectStreamResponse(this.stream(options));
  }

  private buildParams(options: LLMCallOptions): Anthropic.MessageCreateParamsNonStreaming {
    const messages = buildAnthropicMessages(options);

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      messages,
    };

    if (options.systemPrompt) {
      params.system = options.systemPrompt;
    }

    if (options.temperature !== undefined) {
      params.temperature = options.temperature;
    }

    if (options.tools && options.tools.length > 0) {
      params.tools = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool['input_schema'],
      }));
    }

    if (options.extendedThinking) {
      (params as unknown as Record<string, unknown>).thinking = {
        type: 'enabled',
        budget_tokens: options.thinkingBudgetTokens ?? 8000,
      };
    }

    return params;
  }
}

// ─── Doubao 实现（兼容 OpenAI 接口）──────────────────────────────────────────

class DoubaoLLMClient implements ILLMClient {
  private client: OpenAI;

  constructor(apiKey: string, baseURL: string) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async call(options: LLMCallOptions): Promise<LLMResponse> {
    return collectStreamResponse(this.stream(options));
  }

  async *stream(options: LLMCallOptions): AsyncGenerator<StreamChunk> {
    const start = Date.now();
    const messages = buildOpenAIMessages(options);
    const tools = buildOpenAITools(options.tools);

    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(tools ? { tools } : {}),
      stream: true,
      stream_options: { include_usage: true },
    } as OpenAI.Chat.ChatCompletionCreateParamsStreaming);

    let fullText = '';
    let finishReason: string | null = null;
    let usage: TokenUsage = { promptTokens: 0, completionTokens: 0 };
    const toolCallAcc: Record<number, { id: string; name: string; args: string }> = {};
    beginLLMStreamResponseContent('doubao');

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];

      if (chunk.usage) {
        usage = {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
        };
      }

      if (!choice) continue;

      const delta = choice.delta;

      if (delta.content) {
        fullText += delta.content;
        logLLMStreamDelta('doubao', delta.content);
        yield { type: 'text_delta', delta: delta.content };
      }

      // 累积流式 tool_calls 的分片参数
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallAcc[idx]) {
            toolCallAcc[idx] = { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' };
          }
          if (tc.function?.arguments) {
            toolCallAcc[idx].args += tc.function.arguments;
          }
        }
      }

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }
    }

    endLLMStreamResponseContent();
    const toolCalls = Object.values(toolCallAcc).map((tc) => ({
      id: tc.id,
      name: tc.name,
      input: safeParseJSON(tc.args),
    }));

    const finalResponse: LLMResponse = {
      content: fullText,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
      model: options.model,
      latencyMs: Date.now() - start,
      stopReason: mapOpenAIStopReason(finishReason),
    };
    logLLMResponse('doubao', 'stream', options, finalResponse);
    yield {
      type: 'done',
      finalResponse,
    };
  }
}

// ─── Anthropic 工具函数 ───────────────────────────────────────────────────────

async function collectStreamResponse(stream: AsyncGenerator<StreamChunk>): Promise<LLMResponse> {
  let finalResponse: LLMResponse | undefined;
  for await (const chunk of stream) {
    if (chunk.type === 'done') {
      finalResponse = chunk.finalResponse;
    }
  }
  if (!finalResponse) {
    throw new Error('LLMStreamMissingFinalResponse');
  }
  return finalResponse;
}

function buildAnthropicMessages(options: LLMCallOptions): Anthropic.MessageParam[] {
  const { messages, cacheBreakpoint = 0 } = options;

  return messages
    .filter((m) => m.role !== 'system')
    .map((m, i): Anthropic.MessageParam => {
      const content =
        typeof m.content === 'string'
          ? m.content
          : (m.content as Array<{ type: string; text?: string }>);

      const shouldCache = cacheBreakpoint > 0 && i === cacheBreakpoint - 1;

      if (shouldCache && typeof content === 'string') {
        return {
          role: m.role as 'user' | 'assistant',
          content: [
            {
              type: 'text',
              text: content,
              cache_control: { type: 'ephemeral' },
            } as Anthropic.TextBlockParam,
          ],
        };
      }

      return {
        role: m.role as 'user' | 'assistant',
        content: content as Anthropic.MessageParam['content'],
      };
    });
}

function extractAnthropicUsage(usage: Anthropic.Usage): TokenUsage {
  const u = usage as unknown as Record<string, unknown>;
  return {
    promptTokens: usage.input_tokens,
    completionTokens: usage.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens as number | undefined,
    cacheWriteTokens: u.cache_creation_input_tokens as number | undefined,
  };
}

function extractAnthropicToolCalls(
  content: Anthropic.Message['content'],
  streamedToolCalls: Record<number, { id: string; name: string; args: string }>,
): ToolCall[] {
  const finalToolCalls = content
    .filter((block) => block.type === 'tool_use')
    .map((block) => {
      if (block.type !== 'tool_use') throw new Error('unreachable');
      return {
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      };
    });
  if (finalToolCalls.length > 0) return finalToolCalls;

  return Object.values(streamedToolCalls).map((toolCall) => ({
    id: toolCall.id,
    name: toolCall.name,
    input: safeParseJSON(toolCall.args),
  }));
}

// ─── OpenAI/Doubao 工具函数 ───────────────────────────────────────────────────

function buildOpenAIMessages(
  options: LLMCallOptions,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (options.systemPrompt) {
    result.push({ role: 'system', content: options.systemPrompt });
  }

  for (const m of options.messages) {
    if (m.role === 'system') continue;

    if (typeof m.content === 'string') {
      result.push({ role: m.role as 'user' | 'assistant', content: m.content });
    } else {
      const parts: OpenAI.Chat.ChatCompletionContentPart[] = m.content.map((block) => {
        if (block.type === 'text') {
          return { type: 'text' as const, text: block.text };
        }
        return {
          type: 'image_url' as const,
          image_url: {
            url: block.source.url,
          },
        };
      });
      result.push({ role: 'user', content: parts });
    }
  }

  return result;
}

function buildOpenAITools(
  tools?: ToolDefinition[],
): OpenAI.Chat.ChatCompletionTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema as Record<string, unknown>,
    },
  }));
}

function extractOpenAIToolCalls(
  raw: OpenAI.Chat.ChatCompletionMessageToolCall[],
): ToolCall[] {
  return raw.map((tc) => {
    const fn = (tc as unknown as { function: { name: string; arguments: string } }).function;
    return {
      id: tc.id,
      name: fn.name,
      input: safeParseJSON(fn.arguments),
    };
  });
}

function mapOpenAIStopReason(reason: string | null | undefined): LLMResponse['stopReason'] {
  switch (reason) {
    case 'tool_calls':
      return 'tool_use';
    case 'length':
      return 'max_tokens';
    case 'stop':
    default:
      return 'end_turn';
  }
}

function safeParseJSON(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}

function logLLMResponse(
  provider: 'anthropic' | 'doubao',
  mode: 'call' | 'stream',
  options: LLMCallOptions,
  response: LLMResponse,
): void {
  if (!isLLMResponseLogEnabled()) return;
  const maxChars = getLogMaxChars();
  const content = truncateForLog(response.content ?? '', maxChars);
  const toolCalls = response.toolCalls?.map((item) => item.name).join(', ') ?? 'none';
  const requestMaxTokens = options.maxTokens ?? 4096;
  console.log('[LLM_RESPONSE] ==================================================');
  console.log(
    `[LLM_RESPONSE] provider=${provider} mode=${mode} model=${response.model} stopReason=${response.stopReason}`,
  );
  console.log(
    `[LLM_RESPONSE] promptTokens=${response.usage.promptTokens} completionTokens=${response.usage.completionTokens} latencyMs=${response.latencyMs} requestMaxTokens=${requestMaxTokens}`,
  );
  console.log(`[LLM_RESPONSE] toolCalls=${toolCalls}`);
  if (mode === 'stream') {
    console.log('[LLM_RESPONSE] content_streamed=true');
    return;
  }
  console.log('[LLM_RESPONSE] content_start');
  console.log(content || '[empty]');
  console.log('[LLM_RESPONSE] content_end');
}

function isLLMResponseLogEnabled(): boolean {
  const value = process.env.LLM_LOG_RESPONSES;
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function getLogMaxChars(): number {
  const raw = Number(process.env.LLM_LOG_MAX_CHARS ?? DEFAULT_LOG_MAX_CHARS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LOG_MAX_CHARS;
  return Math.floor(raw);
}

function truncateForLog(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...[truncated ${text.length - maxChars} chars]`;
}

function beginLLMStreamResponseContent(provider: 'anthropic' | 'doubao'): void {
  if (!isLLMResponseLogEnabled()) return;
  console.log(`[LLM_RESPONSE] content_start provider=${provider} mode=stream`);
}

function endLLMStreamResponseContent(): void {
  if (!isLLMResponseLogEnabled()) return;
  process.stdout.write('\n');
  console.log('[LLM_RESPONSE] content_end');
}

function logLLMStreamDelta(provider: 'anthropic' | 'doubao', delta: string): void {
  if (!delta) return;
  if (isLLMResponseLogEnabled()) {
    process.stdout.write(delta);
    return;
  }
  if (!isLLMStreamDeltaLogEnabled()) return;
  console.log(`[LLM_STREAM_DELTA] provider=${provider} delta=${JSON.stringify(delta)}`);
}

function isLLMStreamDeltaLogEnabled(): boolean {
  const value = process.env.LLM_LOG_STREAM_DELTAS;
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}
