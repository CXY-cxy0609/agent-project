/**
 * Orchestrator Agent — 系统统一入口，意图识别与任务路由
 * 推理模式：Direct（单次 LLM 调用），不需要 Graph
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseAgent } from '../../harness/core/agent.js';
import { PromptBuilder } from '../../harness/prompt/builder.js';
import { SchemaParser } from '../../harness/output/schema-parser.js';
import type { ShortTermMemory, AgentContext } from '../../harness/core/types.js';
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
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { Observer } from '../../harness/observer/tracer.js';
import type { WorkflowScheduler } from '../../harness/runtime/scheduler.js';
import type { ModelGovernanceConfig } from '../../harness/runtime/model-governance.js';
import type { QAInput, QAOutput } from '../qa/qa.types.js';
import type { VideoAgentInput, VideoAgentOutput } from '../video/video.types.js';
import type { LearningReportInput } from '../../subgraphs/learning-report.subgraph.js';
import type { LearningRecordOutput } from '../learning-record/learning-record.types.js';

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
    private readonly scheduler: WorkflowScheduler,
    private readonly modelConfig: ModelGovernanceConfig['orchestrator'],
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
    if (input.generateVideo === true) {
      return {
        intent: 'video_request',
        subjectId: input.subjectId,
        confidence: 1,
        reasoning: '前端显式开启生成视频开关',
      };
    }
    if (hasVideoIntent(input.userMessage, Boolean(input.imageBase64))) {
      return {
        intent: 'video_request',
        subjectId: input.subjectId,
        confidence: 0.95,
        reasoning: '命中视频生成/修复意图关键词规则',
      };
    }

    const availableSubjectsHint = (input.availableSubjects ?? [])
      .map((item) => `- ${item.id}: ${item.name}${item.code ? ` (code: ${item.code})` : ''}`)
      .join('\n');
    const { messages, systemPrompt } = new PromptBuilder()
      .setPersona(ORCHESTRATOR_PERSONA, {})
      .setTask(ORCHESTRATOR_TASK, {
        userMessage: input.userMessage,
        subjectHint: input.subjectId ? `### 当前科目\n\n${input.subjectId}` : '',
        availableSubjectsHint: availableSubjectsHint
          ? `### 可选科目（仅可从以下列表选择）\n\n${availableSubjectsHint}`
          : '',
      })
      .setOutputFormat(INTENT_OUTPUT_SCHEMA)
      .build();

    const response = await this.llm.call({
      model: this.modelConfig.classifyIntent,
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
    const workflowId = `${ctx.sessionId}:${ctx.traceId}`;

    switch (intent.intent) {
      case 'qa': {
        const qaInput: QAInput = {
          question: input.userMessage,
          imageBase64: input.imageBase64,
          imageMediaType: input.imageMediaType,
          subjectId: intent.subjectId ?? input.subjectId ?? 'general',
          history: state.history,
          generateVideo: false,
        };

        const qaResult = await this.scheduler.executeSubgraph<QAInput, QAOutput>(
          'qa',
          qaInput,
          ctx,
          { workflowId },
        );

        return {
          reply: qaResult.answer,
          subjectId: qaResult.subject || intent.subjectId,
        };
      }

      case 'video_request': {
        const videoResult = await this.scheduler.executeSubgraph<VideoAgentInput, VideoAgentOutput>(
          'video',
          {
            knowledgeDescription: input.userMessage,
            subject: intent.subjectId ?? input.subjectId ?? '通用',
            useVideoCache: true,
          },
          ctx,
          { workflowId },
        );

        return {
          reply: videoResult.success
            ? '已为你生成讲解视频。'
            : `视频生成失败：${videoResult.failureReason ?? '未知错误'}`,
          subjectId: intent.subjectId ?? input.subjectId,
          videoUrl: videoResult.videoUrl,
        };
      }

      case 'learning_report': {
        const reportResult = await this.scheduler.executeSubgraph<LearningReportInput, LearningRecordOutput>(
          'learning_report',
          {
            userId: ctx.userId,
            subjectId: intent.subjectId,
          },
          ctx,
          { workflowId },
        );

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

function hasVideoIntent(userMessage: string, hasImage: boolean): boolean {
  const text = userMessage.toLowerCase().replace(/\s+/g, '');

  const directVideoKeywords = [
    '生成视频',
    '讲解视频',
    '做个视频',
    '出视频',
    '视频讲解',
    '视频版',
    '录个视频',
    '制作视频',
    '生成动画',
    '做个动画',
    '重生成视频',
    '重新生成视频',
    '重新渲染',
    '重渲染',
    '重新跑视频',
    '修视频',
    '修复视频',
    '视频有问题',
    '视频不对',
    '视频错误',
    '渲染失败',
    '渲染报错',
    'manim',
  ];
  if (directVideoKeywords.some((keyword) => text.includes(keyword))) return true;

  const frameKeywords = ['帧', '第几帧', '某一帧', '哪一帧', '卡住', '花屏', '抖动'];
  const fixKeywords = ['修', '修复', '改', '调整', '重做', '重生成', '重新生成', '重新渲染', '定位代码'];
  if (frameKeywords.some((keyword) => text.includes(keyword)) && fixKeywords.some((keyword) => text.includes(keyword))) {
    return true;
  }

  // 用户带截图反馈视频问题，通常是希望定位并重生成视频。
  if (hasImage && (text.includes('视频') || text.includes('帧')) && fixKeywords.some((keyword) => text.includes(keyword))) {
    return true;
  }

  return false;
}
