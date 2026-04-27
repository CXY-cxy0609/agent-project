/**
 * Orchestrator Agent — 系统统一入口，意图识别与任务路由
 * 推理模式：Direct（单次 LLM 调用），不需要 Graph
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseAgent } from '../../harness/core/agent.js';
import { PromptBuilder } from '../../harness/prompt/builder.js';
import { SchemaParser } from '../../harness/output/schema-parser.js';
import type { ShortTermMemory, AgentContext } from '../../harness/core/types.js';
import { MODELS } from '../../constants/models.js';
import {
  ORCHESTRATOR_PERSONA,
  ORCHESTRATOR_TASK,
  INTENT_OUTPUT_SCHEMA,
} from './orchestrator.prompts.js';
import type {
  OrchestratorInput,
  OrchestratorOutput,
  IntentClassification,
  OrchestratorState,
} from './orchestrator.types.js';
import type { QAAgent } from '../qa/qa.agent.js';
import type { LearningRecordAgent } from '../learning-record/learning-record.agent.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { Observer } from '../../harness/observer/tracer.js';

interface IntentRaw {
  intent: string;
  subject_id?: string;
  confidence: number;
  reasoning?: string;
}

export class OrchestratorAgent extends BaseAgent<OrchestratorInput, OrchestratorOutput> {
  private readonly schemaParser = new SchemaParser();

  constructor(
    llm: LLMClient,
    observer: Observer,
    private readonly memory: ShortTermMemory,
    private readonly qaAgent: QAAgent,
    private readonly learningRecordAgent: LearningRecordAgent,
  ) {
    super(llm, observer);
  }

  async execute(input: OrchestratorInput, ctx: AgentContext): Promise<OrchestratorOutput> {
    const conversationId = input.conversationId ?? uuidv4();

    // 1. 加载对话历史
    const history = await this.memory.getHistory(ctx.sessionId);

    // 2. 意图分类
    const intent = await this.classifyIntent(input, ctx);

    // 3. 根据意图路由
    const state: OrchestratorState = { input, history, intent };
    const result = await this.routeAndExecute(state, ctx);

    // 4. 更新对话历史
    await this.memory.appendHistory(ctx.sessionId, [
      { role: 'user', content: input.userMessage },
      { role: 'assistant', content: result.reply },
    ]);

    return {
      ...result,
      conversationId,
      intent: intent.intent as OrchestratorOutput['intent'],
    };
  }

  private async classifyIntent(
    input: OrchestratorInput,
    _ctx: AgentContext,
  ): Promise<IntentClassification> {
    const { messages, systemPrompt } = new PromptBuilder()
      .setPersona(ORCHESTRATOR_PERSONA, {})
      .setTask(ORCHESTRATOR_TASK, {
        userMessage: input.userMessage,
        subjectHint: input.subjectId ? `（用户当前科目：${input.subjectId}）` : '',
      })
      .setOutputFormat(INTENT_OUTPUT_SCHEMA)
      .build();

    const response = await this.llm.call({
      model: MODELS.HAIKU,
      messages,
      systemPrompt,
      temperature: 0,
      maxTokens: 256,
    });

    try {
      const raw = this.schemaParser.parse<IntentRaw>(response.content, INTENT_OUTPUT_SCHEMA);
      return {
        intent: raw.intent as IntentClassification['intent'],
        subjectId: raw.subject_id ?? input.subjectId,
        confidence: raw.confidence,
        reasoning: raw.reasoning,
      };
    } catch {
      // 解析失败时降级为 qa
      return { intent: 'qa', subjectId: input.subjectId, confidence: 0.5 };
    }
  }

  private async routeAndExecute(
    state: OrchestratorState,
    ctx: AgentContext,
  ): Promise<Omit<OrchestratorOutput, 'conversationId' | 'intent'>> {
    const { intent, input } = state;

    switch (intent.intent) {
      case 'qa':
      case 'video_request': {
        const qaResult = await this.callAgent(this.qaAgent, {
          question: input.userMessage,
          imageBase64: input.imageBase64,
          imageMediaType: input.imageMediaType,
          subjectId: intent.subjectId ?? input.subjectId ?? 'general',
          history: state.history,
          generateVideo: intent.intent === 'video_request',
        }, ctx);

        return {
          reply: qaResult.answer,
          subjectId: intent.subjectId,
          videoUrl: qaResult.videoUrl,
        };
      }

      case 'learning_report': {
        const reportResult = await this.callAgent(this.learningRecordAgent, {
          action: 'generate_report',
          userId: ctx.userId,
          subjectId: intent.subjectId,
        }, ctx);

        return {
          reply: reportResult.report ?? '暂无学情数据。',
          subjectId: intent.subjectId,
        };
      }

      case 'knowledge_query':
        return {
          reply: '知识库查询功能正在建设中，请直接提问您想了解的知识点。',
          subjectId: intent.subjectId,
        };

      default:
        return {
          reply: '抱歉，我只能回答与考研备考相关的问题，包括数学、英语、政治等科目的知识点和题目解析。',
        };
    }
  }
}
