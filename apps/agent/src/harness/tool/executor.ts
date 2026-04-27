/**
 * ToolExecutor — Function Calling 执行引擎
 * 含 maxSteps 保护，防止无限 agentic loop
 */

import type { Message, LLMCallOptions, ToolCall, ToolResult } from '../core/types.js';
import type { LLMClient } from '../core/llm-client.js';
import type { ToolRegistry } from './tool.js';

export interface AgenticStep {
  stepIndex: number;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  assistantMessage: string;
}

export interface AgenticLoopOptions {
  /** 默认 10，超出后强制终止并抛出 MaxStepsExceededError */
  maxSteps?: number;
  onStep?: (step: AgenticStep) => void;
}

export interface AgenticLoopResult {
  finalContent: string;
  steps: AgenticStep[];
  stoppedBy: 'llm' | 'maxSteps';
}

export class MaxStepsExceededError extends Error {
  constructor(maxSteps: number) {
    super(`Agentic loop exceeded maxSteps (${maxSteps})`);
    this.name = 'MaxStepsExceededError';
  }
}

export class ToolExecutor {
  constructor(private readonly registry: ToolRegistry) {}

  /** 单次执行：LLM 返回 tool_calls → 并发执行 → 返回 tool results */
  async execute(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(
      toolCalls.map(async (tc): Promise<ToolResult> => {
        const tool = this.registry.get(tc.name);
        if (!tool) {
          return {
            tool_use_id: tc.id,
            content: `Tool "${tc.name}" not found`,
            is_error: true,
          };
        }

        try {
          const output = await tool.execute(tc.input);
          return {
            tool_use_id: tc.id,
            content: typeof output === 'string' ? output : JSON.stringify(output),
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { tool_use_id: tc.id, content: msg, is_error: true };
        }
      }),
    );
  }

  /** Agentic Loop：自动循环直到 LLM 停止调用工具或达到 maxSteps */
  async agenticLoop(
    messages: Message[],
    options: LLMCallOptions,
    llm: LLMClient,
    loopOptions: AgenticLoopOptions = {},
  ): Promise<AgenticLoopResult> {
    const maxSteps = loopOptions.maxSteps ?? 10;
    const steps: AgenticStep[] = [];
    let currentMessages = [...messages];

    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
      const response = await llm.call({ ...options, messages: currentMessages });

      if (!response.toolCalls || response.toolCalls.length === 0) {
        return { finalContent: response.content, steps, stoppedBy: 'llm' };
      }

      const toolResults = await this.execute(response.toolCalls);

      const step: AgenticStep = {
        stepIndex,
        toolCalls: response.toolCalls,
        toolResults,
        assistantMessage: response.content,
      };
      steps.push(step);
      loopOptions.onStep?.(step);

      // 将工具调用结果追加到消息历史，继续循环
      currentMessages = [
        ...currentMessages,
        {
          role: 'assistant',
          content: response.content || buildToolUseContent(response.toolCalls),
        },
        {
          role: 'user',
          content: buildToolResultContent(toolResults),
        },
      ];
    }

    return {
      finalContent: '',
      steps,
      stoppedBy: 'maxSteps',
    };
  }
}

function buildToolUseContent(toolCalls: ToolCall[]): string {
  return toolCalls.map((tc) => `[Tool: ${tc.name}] Input: ${JSON.stringify(tc.input)}`).join('\n');
}

function buildToolResultContent(results: ToolResult[]): string {
  return results
    .map((r) => `[ToolResult${r.is_error ? ' (error)' : ''}]: ${r.content}`)
    .join('\n');
}
