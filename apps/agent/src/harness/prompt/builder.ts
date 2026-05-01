/**
 * 分层 Prompt 构建器
 *
 * 四层结构（system / user 两条消息）：
 *   system = [角色定义 Persona] + [输出要求 OutputFormat]
 *   user   = [任务要求 + 上下文信息 Task]
 *
 * 上下文信息（RAG、对话历史等）优先通过 task.md 模板变量（{{ragContext}} 等）注入，
 * 使 prompt 文件本身即为完整的结构文档。
 * setContext() 保留作为备用，适用于无法提前在模板中声明的动态上下文。
 */

import type { Message } from '../core/types.js';
import type { PromptTemplate } from './template.js';
import type { OutputSchema } from '../output/schema-parser.js';
import { renderer } from './template.js';
import { SchemaParser } from '../output/schema-parser.js';

const schemaParser = new SchemaParser();

interface BuildResult {
  messages: Message[];
  systemPrompt: string;
  /** 在第几条 message 后插入 cache_control（0 = 不缓存） */
  cacheBreakpoint: number;
}

export class PromptBuilder {
  private personaContent = '';
  private taskContent = '';
  private contextContent = '';
  private outputFormatContent = '';

  setPersona(template: PromptTemplate, vars: Record<string, string>): this {
    this.personaContent = renderer.render(template, vars);
    return this;
  }

  setPersonaText(text: string): this {
    this.personaContent = text;
    return this;
  }

  setTask(template: PromptTemplate, vars: Record<string, string>): this {
    this.taskContent = renderer.render(template, vars);
    return this;
  }

  setTaskText(text: string): this {
    this.taskContent = text;
    return this;
  }

  setContext(context: string): this {
    this.contextContent = context;
    return this;
  }

  setOutputFormat(schema: OutputSchema): this {
    this.outputFormatContent = schemaParser.toPromptInstruction(schema);
    return this;
  }

  build(): BuildResult {
    const systemParts: string[] = [];

    if (this.personaContent) systemParts.push(this.personaContent);
    if (this.outputFormatContent) systemParts.push(this.outputFormatContent);

    const systemPrompt = systemParts.join('\n\n');

    const userParts: string[] = [];
    if (this.contextContent) {
      userParts.push(`<context>\n${this.contextContent}\n</context>`);
    }
    if (this.taskContent) {
      userParts.push(this.taskContent);
    }

    const messages: Message[] = [
      { role: 'user', content: userParts.join('\n\n') || '请开始' },
    ];

    // Layer 1（Persona）是静态内容，设为 cache breakpoint
    // 系统提示通过 systemPrompt 字段传递，不放在 messages 里
    const cacheBreakpoint = systemPrompt.length > 100 ? 1 : 0;

    return { messages, systemPrompt, cacheBreakpoint };
  }
}
