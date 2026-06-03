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
  IntentRaw,
  OrchestratorState,
  ImageSemanticOutput,
  ImageSemanticRaw,
  SubjectOption,
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
import type { HttpUserSubjectClient } from '../../harness/subjects/user-subject-client.js';
import { emitIntentReasoning } from './orchestrator-events.js';
import { buildHeuristicConversationTitle, normalizeConversationTitle, shouldGenerateConversationTitle } from './orchestrator-title.js';
import {
  VIDEO_CONTEXT_STATE_KEY,
  buildKnowledgeDescription,
  buildUpdatedVideoContext,
  classifyVideoFollowUp,
  getInputImages,
  hasVideoIntent,
  resolveVideoContext,
  type VideoContextResolution,
  type VideoConversationContext,
} from './orchestrator-video-context.js';

export class OrchestratorAgent extends BaseAgent<OrchestratorInput, OrchestratorOutput> {
  private readonly schemaParser = new SchemaParser();

  constructor(
    llm: LLMClient,
    observer: Observer,
    private readonly memory: ShortTermMemory,
    private readonly scheduler: WorkflowScheduler,
    private readonly modelConfig: ModelGovernanceConfig['orchestrator'],
    private readonly videoRunMemory?: HttpVideoRunMemory,
    private readonly userSubjectClient?: HttpUserSubjectClient,
  ) {
    super(llm, observer);
  }

  async execute(input: OrchestratorInput, ctx: AgentContext): Promise<OrchestratorOutput> {
    const enrichedInput = await this.enrichInputWithUserSubjects(input, ctx);
    const conversationId = enrichedInput.conversationId ?? uuidv4();

    const history = await this.memory.getHistory(ctx.sessionId);
    const imageSemantic = await this.extractImageSemantic(enrichedInput);
    const intent = await this.classifyIntent(enrichedInput, imageSemantic);
    emitIntentReasoning(ctx, intent, imageSemantic?.semanticSummary);
    const state: OrchestratorState = { input: enrichedInput, history, intent, imageSemantic };
    const result = await this.routeAndExecute(state, ctx);
    await this.memory.appendHistory(ctx.sessionId, [
      { role: 'user', content: enrichedInput.userMessage },
      { role: 'assistant', content: result.reply },
    ]);
    const title = shouldGenerateConversationTitle(enrichedInput, history.length) ? intent.title : undefined;

    return {
      ...result,
      conversationId,
      intent: intent.intent as OrchestratorOutput['intent'],
      title,
    };
  }

  private async enrichInputWithUserSubjects(
    input: OrchestratorInput,
    ctx: AgentContext,
  ): Promise<OrchestratorInput> {
    const serverSubjects = await this.userSubjectClient?.listUserSubjects(ctx.userId) ?? [];
    const availableSubjects = serverSubjects.length > 0
      ? serverSubjects
      : this.normalizeSubjectOptions(input.availableSubjects);
    return {
      ...input,
      availableSubjects,
      subjectId: this.normalizeSubjectId(input.subjectId, availableSubjects),
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
        title: buildHeuristicConversationTitle(input.userMessage),
      };
    }
    if (hasVideoIntent(input.userMessage, getInputImages(input).length > 0)) {
      return {
        intent: 'video_request',
        subjectId: input.subjectId,
        confidence: 0.95,
        videoRequired: true,
        reasoning: '命中视频生成/修复意图关键词规则',
        title: buildHeuristicConversationTitle(input.userMessage),
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
          ? `### 可选科目（subject_id 优先从以下列表选择；无匹配时可留空，不影响 qa 意图）\n\n${availableSubjectsHint}`
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
      const subjectId = this.normalizeSubjectId(raw.subject_id, input.availableSubjects)
        ?? this.normalizeSubjectId(input.subjectId, input.availableSubjects);
      return {
        intent: raw.intent as IntentClassification['intent'],
        subjectId,
        confidence: raw.confidence,
        videoRequired: raw.video_required ?? raw.intent === 'video_request',
        reasoning: raw.reasoning,
        title: normalizeConversationTitle(raw.title),
      };
    } catch {
      // 解析失败时降级为 qa
      return {
        intent: 'qa',
        subjectId: this.normalizeSubjectId(input.subjectId, input.availableSubjects),
        confidence: 0.5,
        videoRequired: false,
        reasoning: '意图输出解析失败，降级为学习问答',
        title: buildHeuristicConversationTitle(input.userMessage),
      };
    }
  }

  private normalizeSubjectOptions(
    subjects: OrchestratorInput['availableSubjects'],
  ): SubjectOption[] {
    return (subjects ?? [])
      .map((item) => ({
        id: String(item.id ?? '').trim(),
        name: String(item.name ?? '').trim(),
        code: item.code !== undefined ? String(item.code).trim() : undefined,
      }))
      .filter((item) => item.id && item.name);
  }

  private normalizeSubjectId(
    subjectId: unknown,
    availableSubjects: SubjectOption[] | undefined,
  ): string | undefined {
    if (subjectId === null || subjectId === undefined) return undefined;
    const candidate = String(subjectId).trim();
    if (!candidate) return undefined;
    const subjects = availableSubjects ?? [];
    if (subjects.length === 0) return candidate;
    const matched = subjects.find(
      (subject) => subject.id === candidate || subject.name === candidate || subject.code === candidate,
    );
    return matched?.id;
  }

  private findSubjectOption(
    subjectId: string | undefined,
    availableSubjects: SubjectOption[] | undefined,
  ): SubjectOption | undefined {
    const normalizedSubjectId = this.normalizeSubjectId(subjectId, availableSubjects);
    return availableSubjects?.find((subject) => subject.id === normalizedSubjectId);
  }

  private async routeAndExecute(
    state: OrchestratorState,
    ctx: AgentContext,
  ): Promise<Omit<OrchestratorOutput, 'conversationId' | 'intent'>> {
    const { intent, input } = state;
    const workflowId = `${ctx.sessionId}:${ctx.traceId}`;

    switch (intent.intent) {
      case 'qa': {
        const selectedSubject = this.findSubjectOption(intent.subjectId ?? input.subjectId, input.availableSubjects);
        const resolvedSubjectId = selectedSubject?.id ?? intent.subjectId ?? input.subjectId ?? 'general';
        const enrichedQuestion = buildKnowledgeDescription(
          input.userMessage,
          state.imageSemantic,
        );
        const qaInput: QAInput = {
          question: enrichedQuestion,
          images: getInputImages(input),
          subjectId: resolvedSubjectId,
          subjectName: selectedSubject?.name,
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
          const videoResult = await this.executeContextualVideoSubgraph(state, ctx, workflowId, {
            subject: selectedSubject?.name ?? qaResult.subject ?? '通用',
            qaAnswer: qaResult.answer,
          });
          return {
            reply: qaResult.answer,
            subjectId: resolvedSubjectId,
            videoUrl: videoResult.videoUrl,
            videoRunId: videoResult.videoRunRecord?.runId,
            artifactBundleUrl: videoResult.videoRunRecord?.artifactBundleUrl,
            artifactManifestUrl: videoResult.videoRunRecord?.artifactManifestUrl,
          };
        }

        return {
          reply: qaResult.answer,
          subjectId: resolvedSubjectId,
        };
      }

      case 'video_request': {
        const previousContext = await this.memory.getState<VideoConversationContext>(
          ctx.sessionId,
          VIDEO_CONTEXT_STATE_KEY,
        );
        if (!previousContext && classifyVideoFollowUp(input.userMessage) && getInputImages(input).length === 0) {
          return {
            reply: '我没有找到上一条可复用的视频上下文。请重新发送题目或图片，我再为你生成视频。',
            subjectId: intent.subjectId ?? input.subjectId,
          };
        }
        const videoResult = await this.executeContextualVideoSubgraph(state, ctx, workflowId, {
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
          reply: '抱歉，我只能回答与学习相关的问题',
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
    params: {
      knowledgeDescription: string;
      subject: string;
      useVideoCache?: boolean;
      contextResolution?: VideoContextResolution;
    },
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
    if (params.contextResolution) {
      await writeRunJson(runContext.runDir, 'video-context.json', {
        mode: params.contextResolution.mode,
        reason: params.contextResolution.reason,
        subject: params.contextResolution.subject,
        useVideoCache: params.contextResolution.useVideoCache,
        modelFacingSummary: params.contextResolution.context.modelFacingSummary,
        hasPreviousVideoContent: Boolean(params.contextResolution.context.previousVideoContent),
        generatedAt: new Date().toISOString(),
      });
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
          useVideoCache: params.useVideoCache ?? true,
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

  private async executeContextualVideoSubgraph(
    state: OrchestratorState,
    ctx: AgentContext,
    workflowId: string,
    params: { subject: string; qaAnswer?: string },
  ): Promise<{
    success: boolean;
    videoUrl?: string;
    failureReason?: string;
    videoRunRecord?: VideoRunRecord;
  }> {
    const previousContext = await this.memory.getState<VideoConversationContext>(
      ctx.sessionId,
      VIDEO_CONTEXT_STATE_KEY,
    );
    const resolution = resolveVideoContext({
      input: state.input,
      subject: params.subject,
      imageSemantic: state.imageSemantic,
      previousContext,
      qaAnswer: params.qaAnswer,
    });
    const videoResult = await this.executeVideoSubgraph(state, ctx, workflowId, {
      knowledgeDescription: resolution.knowledgeDescription,
      subject: resolution.subject,
      useVideoCache: resolution.useVideoCache,
      contextResolution: resolution,
    });
    const nextContext = await buildUpdatedVideoContext({
      resolution,
      videoRunRecord: videoResult.videoRunRecord,
      success: videoResult.success,
      videoUrl: videoResult.videoUrl,
      failureReason: videoResult.failureReason,
    });
    await this.memory.setState(ctx.sessionId, VIDEO_CONTEXT_STATE_KEY, nextContext);
    return videoResult;
  }
}
