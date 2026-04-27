/**
 * LLMClient — Anthropic SDK 薄包装
 * 只做三件事：调用 API、处理流式输出、统一错误
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMCallOptions,
  LLMResponse,
  StreamChunk,
  ToolCall,
  TokenUsage,
} from './types.js';
import { withRetry, isRetryableLLMError } from './retry.js';

export class LLMClient {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  /** 非流式调用，等待完整响应 */
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

  /** 流式调用，返回 AsyncGenerator，调用方用 for-await-of 消费 */
  async *stream(options: LLMCallOptions): AsyncGenerator<StreamChunk> {
    const start = Date.now();
    const params = this.buildParams(options);

    const stream = await this.client.messages.stream({
      ...params,
      stream: true,
    } as Parameters<typeof this.client.messages.stream>[0]);

    let fullText = '';
    let toolCalls: ToolCall[] = [];

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullText += event.delta.text;
          yield { type: 'text_delta', delta: event.delta.text };
        }
      } else if (event.type === 'message_stop') {
        const finalMsg = await stream.finalMessage();
        const usage = extractUsage(finalMsg.usage);
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
      usage: extractUsage(response.usage),
      model: response.model,
      latencyMs: Date.now() - start,
      stopReason: (response.stop_reason ?? 'end_turn') as LLMResponse['stopReason'],
    };
  }

  private buildParams(options: LLMCallOptions): Anthropic.MessageCreateParamsNonStreaming {
    const messages = buildMessagesWithCache(options);

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
      (params as Record<string, unknown>).thinking = {
        type: 'enabled',
        budget_tokens: options.thinkingBudgetTokens ?? 8000,
      };
    }

    return params;
  }
}

function buildMessagesWithCache(
  options: LLMCallOptions,
): Anthropic.MessageParam[] {
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

function extractUsage(usage: Anthropic.Usage): TokenUsage {
  return {
    promptTokens: usage.input_tokens,
    completionTokens: usage.output_tokens,
    cacheReadTokens: (usage as Record<string, unknown>).cache_read_input_tokens as
      | number
      | undefined,
    cacheWriteTokens: (usage as Record<string, unknown>).cache_creation_input_tokens as
      | number
      | undefined,
  };
}
