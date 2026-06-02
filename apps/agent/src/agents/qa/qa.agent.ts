/**
 * QA Agent — 核心业务 Agent（节点消息驱动 + 状态分区）
 * 流程：Prepare → RAG 检索 → LLM 生成
 */

import { BaseAgent } from '../../harness/core/agent.js';
import type { NodeGovernancePolicy } from '../../harness/core/graph.js';
import type { AgentContext } from '../../harness/core/types.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { Observer } from '../../harness/observer/tracer.js';
import type { RagClient } from '../../harness/rag-client/rag-client.js';
import type { ToolRegistry } from '../../harness/tool/tool.js';
import { MessageDrivenGraph } from '../../harness/runtime/message-graph.js';
import type { MessageEnvelope } from '../../harness/runtime/message-graph.js';
import { buildQAMessageGraphNodes } from './qa.message-graph.js';
import { eventBus } from '../../events/event-bus.js';
import type { QAInput, QAOutput } from './qa.types.js';
import type { QARetrievalPolicyConfig } from './retrieval-policy.js';
import type { ModelGovernanceConfig } from '../../harness/runtime/model-governance.js';

const QA_RAG_EVENT = 'qa.rag.completed';
const QA_GENERATE_EVENT = 'qa.generate.completed';

export class QAAgent extends BaseAgent<QAInput, QAOutput> {
  constructor(
    llm: LLMClient,
    observer: Observer,
    private readonly ragClient: RagClient,
    private readonly toolRegistry: ToolRegistry,
    private readonly retrievalPolicyConfig: QARetrievalPolicyConfig,
    private readonly modelConfig: ModelGovernanceConfig['qa'],
    private readonly nodePolicies?: Record<string, NodeGovernancePolicy>,
  ) {
    super(llm, observer, eventBus);
  }

  async execute(input: QAInput, ctx: AgentContext): Promise<QAOutput> {
    const tokenEmitter = ctx.metadata?.tokenEmitter;
    const nodes = buildQAMessageGraphNodes(
      this.llm,
      this.ragClient,
      this.toolRegistry,
      this.retrievalPolicyConfig,
      this.modelConfig,
      typeof tokenEmitter === 'function'
        ? (token: string) => {
            (tokenEmitter as (value: string) => void)(token);
          }
        : undefined,
    );
    const graph = new MessageDrivenGraph({
      question: input.question,
      images: input.images,
      subjectId: input.subjectId,
      history: input.history,
      generateVideo: input.generateVideo ?? false,
    })
      .addNode('prepare', nodes.prepareNode)
      .addNode('rag', nodes.ragNode)
      .addNode('generate', nodes.generateNode)
      .addEdge('prepare', 'rag')
      .addEdge('rag', 'generate')
      .addEdge('generate', '__end__');

    const delegatedEmitter = ctx.metadata?.nodeEventEmitter;
    const { events } = await graph.run({
      nodePolicies: this.nodePolicies,
      onNodeEvent: async (event) => {
        if (typeof delegatedEmitter === 'function') {
          delegatedEmitter(event);
        }
      },
    });

    const generated = this.findLatestEvent<{
      answer: string;
      knowledgePoints: string[];
      difficulty: 'easy' | 'medium' | 'hard';
      subject: string;
      needsVideo: boolean;
    }>(events, QA_GENERATE_EVENT);

    const output: QAOutput = {
      answer: generated?.answer ?? '抱歉，无法生成回答，请重试。',
      knowledgePoints: generated?.knowledgePoints ?? [],
      difficulty: generated?.difficulty ?? 'medium',
      subject: generated?.subject ?? input.subjectId,
      videoUrl: undefined,
      needsVideo: generated?.needsVideo ?? false,
    };

    const workflowId = typeof ctx.metadata?.workflowId === 'string'
      ? ctx.metadata.workflowId
      : `${ctx.sessionId}:${ctx.traceId}`;
    const subgraphId = typeof ctx.metadata?.subgraphId === 'string'
      ? ctx.metadata.subgraphId
      : 'qa';

    eventBus.emitQaCompleted({
      workflowId,
      subgraphId,
      nodeId: 'finalize',
      traceId: ctx.traceId,
      payload: {
        user_id: ctx.userId,
        session_id: ctx.sessionId,
        question: input.question,
        answer: output.answer,
        subject: output.subject,
        knowledge_points: output.knowledgePoints,
        difficulty: output.difficulty,
      },
    });

    return output;
  }

  private findLatestEvent<TPayload>(events: MessageEnvelope[], eventType: string): TPayload | undefined {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i]?.event_type === eventType) {
        return events[i].payload as TPayload;
      }
    }
    return undefined;
  }
}
