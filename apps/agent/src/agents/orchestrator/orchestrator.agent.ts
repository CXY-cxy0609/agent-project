/**
 * Orchestrator Agent — 系统统一入口，意图识别与任务路由
 * 推理模式：Direct（单次 LLM 调用），不需要 Graph
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseAgent } from '../../harness/core/agent.js';
import { PromptBuilder } from '../../harness/prompt/builder.js';
import { SchemaParser } from '../../harness/output/schema-parser.js';
import type { ContentBlock, ShortTermMemory, AgentContext } from '../../harness/core/types.js';
import {
  ORCHESTRATOR_PERSONA,
  ORCHESTRATOR_TASK,
  ORCHESTRATOR_IMAGE_SEMANTIC_TASK,
  INTENT_OUTPUT_SCHEMA,
  IMAGE_SEMANTIC_OUTPUT_SCHEMA,
} from './orchestrator.prompts.js';
import type {
  OrchestratorInput,
  OrchestratorOutput,
  IntentClassification,
  OrchestratorState,
  ImageSemanticOutput,
  VideoRunRecord,
} from './orchestrator.types.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { Observer } from '../../harness/observer/tracer.js';
import type { WorkflowScheduler } from '../../harness/runtime/scheduler.js';
import type { ModelGovernanceConfig } from '../../harness/runtime/model-governance.js';
import type { QAInput, QAOutput } from '../qa/qa.types.js';
import type { VideoAgentInput, VideoAgentOutput } from '../video/video.types.js';
import type { LearningReportInput } from '../../subgraphs/learning-report.subgraph.js';
import type { LearningRecordOutput } from '../learning-record/learning-record.types.js';
import { initVideoRunArtifactContext, writeRunJson } from '../../harness/artifact/video-run-artifact.js';
import type { HttpVideoRunMemory } from '../../harness/memory/video-run-memory.js';

interface IntentRaw {
  intent: string;
  subject_id?: string;
  confidence: number;
  video_required?: boolean;
  reasoning?: string;
}

interface ImageSemanticRaw {
  problem_text: string;
  visual_description: string;
  known_conditions: string[];
  target_question: string;
  semantic_summary: string;
}

export class OrchestratorAgent extends BaseAgent<OrchestratorInput, OrchestratorOutput> {
  private readonly schemaParser = new SchemaParser();

  constructor(
    llm: LLMClient,
    observer: Observer,
    private readonly memory: ShortTermMemory,
    private readonly scheduler: WorkflowScheduler,
    private readonly modelConfig: ModelGovernanceConfig['orchestrator'],
    private readonly videoRunMemory?: HttpVideoRunMemory,
  ) {
    super(llm, observer);
  }

  async execute(input: OrchestratorInput, ctx: AgentContext): Promise<OrchestratorOutput> {
    const conversationId = input.conversationId ?? uuidv4();

    // 1. 加载对话历史
    const history = await this.memory.getHistory(ctx.sessionId);

    // 2. 图片语义抽取（仅当存在图片）
    const imageSemantic = await this.extractImageSemantic(input);

    // 3. 意图分类
    const intent = await this.classifyIntent(input, imageSemantic);

    // 4. 根据意图路由
    const state: OrchestratorState = { input, history, intent, imageSemantic };
    const result = await this.routeAndExecute(state, ctx);

    // 5. 更新对话历史
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
    imageSemantic?: ImageSemanticOutput,
  ): Promise<IntentClassification> {
    if (input.generateVideo === true) {
      return {
        intent: 'video_request',
        subjectId: input.subjectId,
        confidence: 1,
        videoRequired: true,
        reasoning: '前端显式开启生成视频开关',
      };
    }
    if (hasVideoIntent(input.userMessage, getInputImages(input).length > 0)) {
      return {
        intent: 'video_request',
        subjectId: input.subjectId,
        confidence: 0.95,
        videoRequired: true,
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
        imageSemanticHint: imageSemantic
          ? `### 图片语义信息（仅用于意图判断）\n\n${imageSemantic.semanticSummary}`
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
        videoRequired: raw.video_required ?? raw.intent === 'video_request',
        reasoning: raw.reasoning,
      };
    } catch {
      // 解析失败时降级为 qa
      return { intent: 'qa', subjectId: input.subjectId, confidence: 0.5, videoRequired: false };
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
        const enrichedQuestion = buildKnowledgeDescription(
          input.userMessage,
          state.imageSemantic,
        );
        const qaInput: QAInput = {
          question: enrichedQuestion,
          images: getInputImages(input),
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

        if (this.shouldRunVideoSubgraph(state, qaResult.needsVideo)) {
          const videoResult = await this.executeVideoSubgraph(state, ctx, workflowId, {
            knowledgeDescription: buildKnowledgeDescription(
              input.userMessage,
              state.imageSemantic,
              qaResult.answer,
            ),
            subject: intent.subjectId ?? input.subjectId ?? qaResult.subject ?? '通用',
          });
          return {
            reply: qaResult.answer,
            subjectId: qaResult.subject || intent.subjectId,
            videoUrl: videoResult.videoUrl,
            videoRunId: videoResult.videoRunRecord?.runId,
            artifactBundleUrl: videoResult.videoRunRecord?.artifactBundleUrl,
            artifactManifestUrl: videoResult.videoRunRecord?.artifactManifestUrl,
          };
        }

        return {
          reply: qaResult.answer,
          subjectId: qaResult.subject || intent.subjectId,
        };
      }

      case 'video_request': {
        const videoResult = await this.executeVideoSubgraph(state, ctx, workflowId, {
          knowledgeDescription: buildKnowledgeDescription(input.userMessage, state.imageSemantic),
          subject: intent.subjectId ?? input.subjectId ?? '通用',
        });

        return {
          reply: videoResult.success
            ? '已为你生成讲解视频。'
            : `视频生成失败：${videoResult.failureReason ?? '未知错误'}`,
          subjectId: intent.subjectId ?? input.subjectId,
          videoUrl: videoResult.videoUrl,
          videoRunId: videoResult.videoRunRecord?.runId,
          artifactBundleUrl: videoResult.videoRunRecord?.artifactBundleUrl,
          artifactManifestUrl: videoResult.videoRunRecord?.artifactManifestUrl,
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
          reply: '抱歉，我只能回答与学习相关的问题，包括数学、英语、政治等科目的知识点和题目解析。',
        };
    }
  }

  private async extractImageSemantic(input: OrchestratorInput): Promise<ImageSemanticOutput | undefined> {
    const images = getInputImages(input);
    if (images.length === 0) return undefined;

    const { messages, systemPrompt } = new PromptBuilder()
      .setPersona(ORCHESTRATOR_PERSONA, {})
      .setTask(ORCHESTRATOR_IMAGE_SEMANTIC_TASK, {
        userMessage: input.userMessage,
      })
      .setOutputFormat(IMAGE_SEMANTIC_OUTPUT_SCHEMA)
      .build();

    const userText = typeof messages[0]?.content === 'string' ? messages[0].content : '请解析图片语义';
    const multimodalContent: ContentBlock[] = [
      { type: 'text', text: userText },
      ...images.map((image) => ({
        type: 'image',
        source: {
          type: 'url',
          url: image.url,
        },
      }) satisfies ContentBlock),
    ];

    try {
      const response = await this.llm.call({
        model: this.modelConfig.classifyIntent,
        messages: [{ role: 'user', content: multimodalContent }],
        systemPrompt,
        temperature: 0,
        maxTokens: 800,
      });
      const raw = this.schemaParser.parse<ImageSemanticRaw>(response.content, IMAGE_SEMANTIC_OUTPUT_SCHEMA);
      return {
        problemText: raw.problem_text,
        visualDescription: raw.visual_description,
        knownConditions: raw.known_conditions,
        targetQuestion: raw.target_question,
        semanticSummary: raw.semantic_summary,
      };
    } catch {
      return undefined;
    }
  }

  private shouldRunVideoSubgraph(state: OrchestratorState, qaNeedsVideo: boolean): boolean {
    if (state.input.generateVideo === true) return true;
    if (state.intent.videoRequired === true) return true;
    return qaNeedsVideo;
  }

  private async executeVideoSubgraph(
    state: OrchestratorState,
    ctx: AgentContext,
    workflowId: string,
    params: { knowledgeDescription: string; subject: string },
  ): Promise<{
    success: boolean;
    videoUrl?: string;
    failureReason?: string;
    videoRunRecord?: VideoRunRecord;
  }> {
    const runContext = await initVideoRunArtifactContext({
      workflowId,
      traceId: ctx.traceId,
    });
    state.videoRunRecord = {
      runId: runContext.runId,
      workflowId: runContext.workflowId,
      traceId: runContext.traceId,
      artifactRunDir: runContext.runDir,
      artifactObjectPrefix: runContext.objectPrefix,
    };

    await writeRunJson(runContext.runDir, 'intent-classification.json', {
      intent: state.intent,
      userMessage: state.input.userMessage,
      generatedAt: new Date().toISOString(),
    });
    if (state.imageSemantic) {
      await writeRunJson(runContext.runDir, 'image-semantic.json', state.imageSemantic);
    }

    await this.videoRunMemory?.write({
      run_id: runContext.runId,
      workflow_id: workflowId,
      trace_id: ctx.traceId,
      session_id: ctx.sessionId,
      user_id: ctx.userId,
      subject: params.subject,
      status: 'running',
      intent_json: {
        intent: state.intent.intent,
        confidence: state.intent.confidence,
        video_required: state.intent.videoRequired ?? false,
      },
    });

    try {
      const videoResult = await this.scheduler.executeSubgraph<VideoAgentInput, VideoAgentOutput>(
        'video',
        {
          knowledgeDescription: params.knowledgeDescription,
          subject: params.subject,
          useVideoCache: true,
          runId: runContext.runId,
          artifactRunDir: runContext.runDir,
          artifactObjectPrefix: runContext.objectPrefix,
        },
        ctx,
        { workflowId },
      );

      state.videoRunRecord = {
        ...state.videoRunRecord,
        artifactBundleUrl: videoResult.artifactBundleUrl,
        artifactManifestUrl: videoResult.artifactManifestUrl,
      };

      await this.videoRunMemory?.write({
        run_id: runContext.runId,
        workflow_id: workflowId,
        trace_id: ctx.traceId,
        session_id: ctx.sessionId,
        user_id: ctx.userId,
        subject: params.subject,
        status: videoResult.success ? 'completed' : 'failed',
        video_url: videoResult.videoUrl,
        artifact_bundle_url: videoResult.artifactBundleUrl,
        manifest_url: videoResult.artifactManifestUrl,
        error_summary: videoResult.failureReason,
      });

      return {
        success: videoResult.success,
        videoUrl: videoResult.videoUrl,
        failureReason: videoResult.failureReason,
        videoRunRecord: state.videoRunRecord,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.videoRunMemory?.write({
        run_id: runContext.runId,
        workflow_id: workflowId,
        trace_id: ctx.traceId,
        session_id: ctx.sessionId,
        user_id: ctx.userId,
        subject: params.subject,
        status: 'failed',
        error_summary: message,
      });
      return {
        success: false,
        failureReason: message,
        videoRunRecord: state.videoRunRecord,
      };
    }
  }
}

function buildKnowledgeDescription(
  userMessage: string,
  imageSemantic?: ImageSemanticOutput,
  qaAnswer?: string,
): string {
  const sections = [userMessage.trim()];
  if (imageSemantic) {
    sections.push(
      [
        '[图片语义重建]',
        `题干: ${imageSemantic.problemText}`,
        `图像描述: ${imageSemantic.visualDescription}`,
        `已知条件: ${imageSemantic.knownConditions.join('；')}`,
        `目标问题: ${imageSemantic.targetQuestion}`,
        `语义摘要: ${imageSemantic.semanticSummary}`,
      ].join('\n'),
    );
  }
  if (qaAnswer && qaAnswer.trim().length > 0) {
    sections.push(`[问答结论]\n${qaAnswer.trim()}`);
  }
  return sections.join('\n\n');
}

function getInputImages(input: OrchestratorInput): Array<{ url: string; mediaType?: string }> {
  const images = (input.images ?? [])
    .filter((item) => item.url)
    .slice(0, 9);
  return images;
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
