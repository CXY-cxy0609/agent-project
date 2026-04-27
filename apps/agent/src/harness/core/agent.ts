/**
 * BaseAgent — Agent 基类
 * 只提供：上下文透传、可观测性钩子、子 Agent 调用辅助
 * 核心执行逻辑由子类自由实现，不强制使用 Graph
 */

import { EventEmitter } from 'events';
import type { AgentContext } from './types.js';
import type { LLMClient } from './llm-client.js';
import type { Observer } from '../observer/tracer.js';

export abstract class BaseAgent<TInput, TOutput> {
  /** 可选的事件发射器，用于 fire-and-forget 异步通信 */
  protected emitter?: EventEmitter;

  constructor(
    protected readonly llm: LLMClient,
    protected readonly observer: Observer,
    emitter?: EventEmitter,
  ) {
    this.emitter = emitter;
  }

  /** 子类必须实现的核心执行逻辑 */
  abstract execute(input: TInput, ctx: AgentContext): Promise<TOutput>;

  /**
   * 框架层入口：在 execute() 外自动包裹 tracing、metrics、错误处理
   * 调用方使用 run()，不直接调用 execute()
   */
  async run(input: TInput, ctx: AgentContext): Promise<TOutput> {
    const agentName = this.constructor.name;
    const span = this.observer.startSpan(agentName, ctx.traceId);

    try {
      const result = await this.execute(input, ctx);
      span.end({ success: true });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      span.end({ success: false, error: error.message });
      throw error;
    }
  }

  /** 同步调用子 Agent，自动传递 traceId */
  protected async callAgent<I, O>(
    agent: BaseAgent<I, O>,
    input: I,
    ctx: AgentContext,
  ): Promise<O> {
    return agent.run(input, ctx);
  }

  /** 异步事件派发，fire-and-forget，不阻塞主链路 */
  protected emit(event: string, payload: unknown): void {
    if (!this.emitter) return;
    const emitter = this.emitter;
    setImmediate(() => {
      emitter.emit(event, payload);
    });
  }
}
