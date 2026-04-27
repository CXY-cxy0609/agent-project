/**
 * Tool 系统
 * Tool 就是一个带有 JSON Schema 描述的异步函数
 */

import type { ToolDefinition, JsonSchema } from '../core/types.js';

export interface Tool<TInput = unknown, TOutput = unknown> extends ToolDefinition {
  execute(input: TInput): Promise<TOutput>;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /** 序列化成 LLM API 需要的 tools 格式 */
  toDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
  }
}

/** 构建 Tool 的辅助函数（避免每次手写接口） */
export function defineTool<TInput, TOutput>(def: {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (input: TInput) => Promise<TOutput>;
}): Tool<TInput, TOutput> {
  return {
    name: def.name,
    description: def.description,
    input_schema: def.inputSchema,
    execute: def.execute,
  };
}
