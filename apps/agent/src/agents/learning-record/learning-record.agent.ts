/**
 * Learning Record Agent — 异步后台 Agent
 * 从 QA 对话中提取知识点，持久化学情数据，生成学情报告
 * 推理模式：Direct（单次 LLM 调用）
 */

import { BaseAgent } from '../../harness/core/agent.js';
import { PromptBuilder } from '../../harness/prompt/builder.js';
import { SchemaParser } from '../../harness/output/schema-parser.js';
import type { StructuredMemory, AgentContext } from '../../harness/core/types.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { Observer } from '../../harness/observer/tracer.js';
import { MODELS } from '../../constants/models.js';
import {
  LEARNING_RECORD_PERSONA,
  EXTRACT_KNOWLEDGE_TASK,
  GENERATE_REPORT_TASK,
  KNOWLEDGE_POINT_SCHEMA,
} from './learning-record.prompts.js';
import type {
  LearningRecordInput,
  LearningRecordOutput,
  ConversationSummary,
  KnowledgePointExtraction,
} from './learning-record.types.js';

export class LearningRecordAgent extends BaseAgent<LearningRecordInput, LearningRecordOutput> {
  private readonly schemaParser = new SchemaParser();

  constructor(
    llm: LLMClient,
    observer: Observer,
    private readonly structuredMemory: StructuredMemory,
  ) {
    super(llm, observer);
  }

  async execute(input: LearningRecordInput, ctx: AgentContext): Promise<LearningRecordOutput> {
    switch (input.action) {
      case 'record':
        return this.recordConversation(input.conversationSummary!, ctx);
      case 'generate_report':
        return this.generateReport(input.userId, input.subjectId, ctx);
    }
  }

  private async recordConversation(
    summary: ConversationSummary,
    ctx: AgentContext,
  ): Promise<LearningRecordOutput> {
    const { messages, systemPrompt } = new PromptBuilder()
      .setPersona(LEARNING_RECORD_PERSONA, {})
      .setTask(EXTRACT_KNOWLEDGE_TASK, {
        question: summary.question,
        answer: summary.answer.slice(0, 1000), // 控制 token 用量
        subject: summary.subject,
      })
      .setOutputFormat(KNOWLEDGE_POINT_SCHEMA)
      .build();

    const response = await this.llm.call({
      model: MODELS.HAIKU,
      messages,
      systemPrompt,
      maxTokens: 1000,
    });

    try {
      const extraction = this.schemaParser.parse<KnowledgePointExtraction>(
        response.content,
        KNOWLEDGE_POINT_SCHEMA,
      );

      const recordedPoints: string[] = [];

      for (const kp of extraction.knowledge_points) {
        const point = kp as Record<string, unknown>;
        await this.structuredMemory.write({
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          subject: String(point.subject ?? summary.subject),
          chapter: String(point.chapter ?? ''),
          knowledgePoint: String(point.point ?? ''),
          difficulty: (point.difficulty as 'easy' | 'medium' | 'hard') ?? 'medium',
          askedAt: new Date(),
        });
        recordedPoints.push(String(point.point ?? ''));
      }

      return { success: true, recordedPoints };
    } catch {
      return { success: false };
    }
  }

  private async generateReport(
    userId: string,
    subjectId: string | undefined,
    _ctx: AgentContext,
  ): Promise<LearningRecordOutput> {
    const records = await this.structuredMemory.query(userId, {
      subject: subjectId,
      limit: 30,
    });

    if (records.length === 0) {
      return {
        success: true,
        report: '暂无学习记录，开始向老师提问，系统将自动记录你的学习轨迹！',
      };
    }

    const recordsText = records
      .map(
        (r) =>
          `- [${r.subject}/${r.chapter ?? ''}] ${r.knowledgePoint} (${r.difficulty ?? 'medium'})`,
      )
      .join('\n');

    const { messages, systemPrompt } = new PromptBuilder()
      .setPersona(LEARNING_RECORD_PERSONA, {})
      .setTask(GENERATE_REPORT_TASK, {
        userId,
        subject: subjectId ?? '所有科目',
        records: recordsText,
      })
      .build();

    const response = await this.llm.call({
      model: MODELS.HAIKU,
      messages,
      systemPrompt,
      maxTokens: 1000,
    });

    return { success: true, report: response.content };
  }
}
