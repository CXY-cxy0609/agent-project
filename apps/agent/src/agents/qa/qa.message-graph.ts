import { PromptBuilder } from '../../harness/prompt/builder.js';
import { SchemaParser } from '../../harness/output/schema-parser.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { RagClient } from '../../harness/rag-client/rag-client.js';
import type { ToolRegistry } from '../../harness/tool/tool.js';
import type { Message } from '../../harness/core/types.js';
import type { MessageGraphNodeContext } from '../../harness/runtime/message-graph.js';
import { MODELS } from '../../constants/models.js';
import { withRetry } from '../../harness/core/retry.js';
import { metrics, METRIC } from '../../harness/observer/metrics.js';
import { QA_PERSONA, QA_TASK, QA_OUTPUT_SCHEMA } from './qa.prompts.js';
import type { QAAnswerRaw } from './qa.types.js';
import { decideRetrievalPolicy, type QARetrievalPolicyConfig } from './retrieval-policy.js';
import type { RetrievalMode } from '../../harness/rag-client/rag-client.js';

const schemaParser = new SchemaParser();

interface OcrEventPayload {
  processedQuestion: string;
  retrievalMode: RetrievalMode;
  ragBudgetTokens?: number;
  ragMaxUpgradePages?: number;
}

interface RagEventPayload {
  ragContext?: string;
}

export function buildQAMessageGraphNodes(
  llm: LLMClient,
  ragClient: RagClient,
  toolRegistry: ToolRegistry,
  retrievalPolicyConfig: QARetrievalPolicyConfig,
) {
  async function ocrNode(ctx: MessageGraphNodeContext): Promise<void> {
    const state = ctx.getWorkflowState();
    const question = String(state.question ?? '');
    const imageBase64 = typeof state.imageBase64 === 'string' ? state.imageBase64 : undefined;
    const imageMediaType = typeof state.imageMediaType === 'string' ? state.imageMediaType : 'image/jpeg';

    if (!imageBase64) {
      const payload: OcrEventPayload = {
        processedQuestion: question,
        retrievalMode: 'text_only',
      };
      ctx.setNodeState(payload);
      ctx.emitEvent('qa.ocr.completed', payload);
      return;
    }

    const ocrTool = toolRegistry.get('image_ocr');
    if (!ocrTool) {
      const payload: OcrEventPayload = {
        processedQuestion: question,
        retrievalMode: 'text_only',
      };
      ctx.setNodeState(payload);
      ctx.emitEvent('qa.ocr.completed', payload);
      return;
    }

    const result = (await ocrTool.execute({
      image_base64: imageBase64,
      media_type: imageMediaType,
    })) as { extracted_text: string; success: boolean };

    const ocrText = result.success ? result.extracted_text : '';
    const processedQuestion = ocrText
      ? `${question}\n\n[图片内容识别]\n${ocrText}`
      : question;
    const retrievalPolicy = decideRetrievalPolicy(
      question,
      ocrText,
      retrievalPolicyConfig,
    );
    const payload: OcrEventPayload = {
      processedQuestion,
      retrievalMode: retrievalPolicy.mode,
      ragBudgetTokens: retrievalPolicy.budgetTokens,
      ragMaxUpgradePages: retrievalPolicy.maxUpgradePages,
    };
    ctx.setNodeState(payload);
    ctx.emitEvent('qa.ocr.completed', payload);
  }

  async function ragNode(ctx: MessageGraphNodeContext): Promise<void> {
    const state = ctx.getWorkflowState();
    const ocr = findLatestEvent<OcrEventPayload>(ctx, 'qa.ocr.completed');
    const processedQuestion = ocr?.processedQuestion ?? String(state.question ?? '');
    const subjectId = String(state.subjectId ?? 'general');
    const retrievalMode = ocr?.retrievalMode ?? 'text_only';
    const startedAt = Date.now();
    try {
      const result = await ragClient.retrieve(processedQuestion, {
        subjectId,
        topK: 5,
        retrievalMode,
        budgetTokens: ocr?.ragBudgetTokens,
        maxUpgradePages: ocr?.ragMaxUpgradePages,
      });
      const payload: RagEventPayload = {
        ragContext: result.context || undefined,
      };
      metrics.record(METRIC.RAG_LATENCY, Date.now() - startedAt, { agentName: 'QAAgent' });
      metrics.increment(METRIC.RAG_RETRIEVE_SUCCESS, 1, { agentName: 'QAAgent' });
      ctx.setNodeState(payload);
      ctx.emitEvent('qa.rag.completed', payload);
    } catch {
      metrics.record(METRIC.RAG_LATENCY, Date.now() - startedAt, { agentName: 'QAAgent' });
      metrics.increment(METRIC.RAG_RETRIEVE_FAILURE, 1, { agentName: 'QAAgent' });
      const payload: RagEventPayload = { ragContext: undefined };
      ctx.setNodeState(payload);
      ctx.emitEvent('qa.rag.completed', payload);
    }
  }

  async function generateNode(ctx: MessageGraphNodeContext): Promise<void> {
    const state = ctx.getWorkflowState();
    const ocr = findLatestEvent<OcrEventPayload>(ctx, 'qa.ocr.completed');
    const rag = findLatestEvent<RagEventPayload>(ctx, 'qa.rag.completed');
    const question = ocr?.processedQuestion ?? String(state.question ?? '');
    const subject = String(state.subjectId ?? '通用');
    const history = Array.isArray(state.history) ? state.history as Message[] : [];
    const generateVideo = state.generateVideo === true;
    const conversationContext = buildConversationContext(history);
    const ragContext = rag?.ragContext
      ? `### 知识库参考资料\n\n${rag.ragContext}`
      : '';

    metrics.record(METRIC.QA_CONTEXT_HISTORY_TOKENS, estimateTokens(conversationContext), { agentName: 'QAAgent' });
    metrics.record(METRIC.QA_CONTEXT_RAG_TOKENS, estimateTokens(ragContext), { agentName: 'QAAgent' });
    metrics.record(
      METRIC.QA_CONTEXT_TOTAL_TOKENS,
      estimateTokens(`${conversationContext}\n${ragContext}\n${question}`),
      { agentName: 'QAAgent' },
    );

    const { messages, systemPrompt, cacheBreakpoint } = new PromptBuilder()
      .setPersona(QA_PERSONA, { subject })
      .setTask(QA_TASK, { question, ragContext, conversationContext })
      .setOutputFormat(QA_OUTPUT_SCHEMA)
      .build();

    const raw = await withRetry(
      async () => {
        const response = await llm.call({
          model: MODELS.SONNET,
          messages,
          systemPrompt,
          cacheBreakpoint,
          maxTokens: 3000,
        });
        metrics.record(METRIC.LLM_TOKENS, response.usage.promptTokens + response.usage.completionTokens, {
          agentName: 'QAAgent',
          model: response.model,
          subject,
        });
        return schemaParser.parse<QAAnswerRaw>(response.content, QA_OUTPUT_SCHEMA);
      },
      { maxAttempts: 2, backoff: 'fixed', initialDelayMs: 0, retryOn: () => true },
    );

    const payload = {
      answer: raw.answer,
      knowledgePoints: raw.knowledge_points,
      difficulty: raw.difficulty,
      subject: raw.subject,
      needsVideo: generateVideo || raw.needs_video,
    };
    ctx.setNodeState(payload);
    ctx.emitEvent('qa.generate.completed', payload);
  }

  return {
    ocrNode,
    ragNode,
    generateNode,
  };
}

function findLatestEvent<TPayload>(ctx: MessageGraphNodeContext, eventType: string): TPayload | undefined {
  const events = ctx.readEvents(eventType);
  if (!events.length) return undefined;
  return events[events.length - 1]?.payload as TPayload;
}

function buildConversationContext(history: Message[]): string {
  const normalized = history.filter((m) => m.role !== 'system');
  if (!normalized.length) return '无历史对话。';

  const summaryMessage = normalized.find(
    (m) => typeof m.content === 'string' && m.content.startsWith('[较早对话摘要]'),
  );
  const summaryText = summaryMessage && typeof summaryMessage.content === 'string'
    ? summaryMessage.content
    : '';
  const recent = normalized
    .filter((m) => m !== summaryMessage)
    .slice(-6)
    .map((m) => `${toChineseRole(m.role)}：${truncate(compactContent(m.content), 200)}`)
    .join('\n');

  const sections: string[] = [];
  if (summaryText) sections.push(summaryText);
  if (recent) sections.push(`### 近期对话原文（最近6条）\n${recent}`);
  return sections.join('\n\n') || '无历史对话。';
}

function compactContent(content: Message['content']): string {
  const raw = typeof content === 'string'
    ? content
    : content.map((block) => (block.type === 'text' ? block.text : '[图片]')).join(' ');
  return raw.replace(/\s+/g, ' ').trim();
}

function toChineseRole(role: Message['role']): string {
  if (role === 'user') return '用户';
  if (role === 'assistant') return '助手';
  return '系统';
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3)}...`;
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
