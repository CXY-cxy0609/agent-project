/**
 * QA Agent — 核心业务 Agent，负责知识问答与解题
 * 推理模式：ReAct（Graph 驱动多步骤）
 * 流程：OCR（可选）→ RAG 检索 → LLM 生成 → 视频（可选）→ 异步学情记录
 */

import { BaseAgent } from '../../harness/core/agent.js';
import { StateGraph } from '../../harness/core/graph.js';
import type { RagClient } from '../../harness/rag-client/rag-client.js';
import type { ToolRegistry } from '../../harness/tool/tool.js';
import type { AgentContext } from '../../harness/core/types.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { Observer } from '../../harness/observer/tracer.js';
import type { QAInput, QAOutput, QAState } from './qa.types.js';
import type { VideoAgent } from '../video/video.agent.js';
import { buildQANodes } from './qa.graph.js';
import { eventBus, EVENTS, type QaCompletedEvent } from '../../events/event-bus.js';
import type { QARetrievalPolicyConfig } from './retrieval-policy.js';

export class QAAgent extends BaseAgent<QAInput, QAOutput> {
  constructor(
    llm: LLMClient,
    observer: Observer,
    private readonly ragClient: RagClient,
    private readonly toolRegistry: ToolRegistry,
    private readonly videoAgent: VideoAgent,
    private readonly retrievalPolicyConfig: QARetrievalPolicyConfig,
  ) {
    super(llm, observer, eventBus);
  }

  async execute(input: QAInput, ctx: AgentContext): Promise<QAOutput> {
    const nodes = buildQANodes(
      this.llm,
      this.ragClient,
      this.toolRegistry,
      this.videoAgent,
      ctx,
      this.retrievalPolicyConfig,
    );

    const graph = new StateGraph<QAState>({
      question: input.question,
      imageBase64: input.imageBase64,
      imageMediaType: input.imageMediaType,
      subjectId: input.subjectId,
      history: input.history,
      generateVideo: input.generateVideo ?? false,
    })
      .addNode('ocr', nodes.ocrNode)
      .addNode('rag', nodes.ragNode)
      .addNode('generate', nodes.generateNode)
      .addNode('video', nodes.videoNode)
      .addEdge('ocr', 'rag')
      .addEdge('rag', 'generate')
      .addConditionalEdge('generate', nodes.shouldGenerateVideo, {
        yes: 'video',
        no: nodes.END,
      })
      .addEdge('video', nodes.END)
      .compile();

    const finalState = await graph.run({});

    const output: QAOutput = {
      answer: finalState.answer ?? '抱歉，无法生成回答，请重试。',
      knowledgePoints: finalState.knowledgePoints ?? [],
      difficulty: finalState.difficulty ?? 'medium',
      subject: finalState.subject ?? input.subjectId,
      videoUrl: finalState.videoUrl,
      needsVideo: finalState.needsVideo ?? false,
    };

    // 异步通知 Learning Record Agent，不阻塞主链路
    this.emit(EVENTS.QA_COMPLETED, {
      traceId: ctx.traceId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      question: input.question,
      answer: output.answer,
      subject: output.subject,
      knowledgePoints: output.knowledgePoints,
      difficulty: output.difficulty,
    } satisfies QaCompletedEvent);

    return output;
  }
}
