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
    const toolCalls: ToolCall[] = [];

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullText += event.delta.text;
          yield { type: 'text_delta', delta: event.delta.text };
        }
      } else if (event.type === 'message_stop') {
        const finalMsg = await stream.finalMessage();
        const usage = extractAnthropicUsage(finalMsg.usage);
        const response: LLMResponse = {
          content: fullText,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          usage,
          model: finalMsg.model,
          latencyMs: Date.now() - start,
          stopReason: (finalMsg.stop_reason ?? 'end_turn') as LLMResponse['stopReason'],
        };
        yield { type: 'done', finalResponse: response };
      }
    }
  }

  private async callOnce(options: LLMCallOptions): Promise<LLMResponse> {
    const start = Date.now();
    const params = this.buildParams(options);
    const response = await this.client.messages.create(params);

    const toolCalls: ToolCall[] = response.content
      .filter((b) => b.type === 'tool_use')
      .map((b) => {
        if (b.type !== 'tool_use') throw new Error('unreachable');
        return { id: b.id, name: b.name, input: b.input as Record<string, unknown> };
      });

    const textContent = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('');

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: extractAnthropicUsage(response.usage),
      model: response.model,
      latencyMs: Date.now() - start,
      stopReason: (response.stop_reason ?? 'end_turn') as LLMResponse['stopReason'],
    };
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
    const start = Date.now();
    const messages = buildOpenAIMessages(options);
    const tools = buildOpenAITools(options.tools);

    const response = await this.client.chat.completions.create({
      model: options.model,
      messages,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(tools ? { tools } : {}),
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

    const choice = response.choices[0];
    const toolCalls = extractOpenAIToolCalls(choice.message.tool_calls ?? []);

    return {
      content: choice.message.content ?? '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
      },
      model: response.model,
      latencyMs: Date.now() - start,
      stopReason: mapOpenAIStopReason(choice.finish_reason),
    };
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

    const toolCalls = Object.values(toolCallAcc).map((tc) => ({
      id: tc.id,
      name: tc.name,
      input: safeParseJSON(tc.args),
    }));

    yield {
      type: 'done',
      finalResponse: {
        content: fullText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage,
        model: options.model,
        latencyMs: Date.now() - start,
        stopReason: mapOpenAIStopReason(finishReason),
      },
    };
  }
}

// ─── Anthropic 工具函数 ───────────────────────────────────────────────────────

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
            url: `data:${block.source.media_type};base64,${block.source.data}`,
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
