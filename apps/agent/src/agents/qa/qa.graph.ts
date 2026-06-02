/**
 * QA Agent Graph 节点定义
 * 流程：Prepare → RAG 检索 → LLM 生成 → 视频（可选）
 */

import { PromptBuilder } from '../../harness/prompt/builder.js';
import { SchemaParser } from '../../harness/output/schema-parser.js';
import { END } from '../../harness/core/graph.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { RagClient } from '../../harness/rag-client/rag-client.js';
import type { ToolRegistry } from '../../harness/tool/tool.js';
import { MODELS } from '../../constants/models.js';
import { metrics, METRIC } from '../../harness/observer/metrics.js';
import { QA_PERSONA, QA_TASK, QA_OUTPUT_SCHEMA } from './qa.prompts.js';
import type { QAState, QAAnswerRaw } from './qa.types.js';
import type { AgentContext, ContentBlock, Message } from '../../harness/core/types.js';
import { withRetry } from '../../harness/core/retry.js';
import {
  decideRetrievalPolicy,
  type QARetrievalPolicyConfig,
} from './retrieval-policy.js';

const schemaParser = new SchemaParser();

export function buildQANodes(
  llm: LLMClient,
  ragClient: RagClient,
  _toolRegistry: ToolRegistry,
  _ctx: AgentContext,
  retrievalPolicyConfig: QARetrievalPolicyConfig,
) {
  async function prepareNode(state: Readonly<QAState>): Promise<Partial<QAState>> {
    const images = normalizeQAStateImages(state);
    const retrievalPolicy = decideRetrievalPolicy(state.question, '', retrievalPolicyConfig);
    return {
      processedQuestion: state.question,
      retrievalMode: images.length > 0 ? 'text_only' : retrievalPolicy.mode,
      ragBudgetTokens: retrievalPolicy.budgetTokens,
      ragMaxUpgradePages: retrievalPolicy.maxUpgradePages,
    };
  }

  async function ragNode(state: Readonly<QAState>): Promise<Partial<QAState>> {
    const query = state.processedQuestion ?? state.question;
    const start = Date.now();
    try {
      const result = await ragClient.retrieve(query, {
        subjectId: state.subjectId,
        topK: 5,
        retrievalMode: state.retrievalMode ?? 'text_only',
        budgetTokens: state.ragBudgetTokens,
        maxUpgradePages: state.ragMaxUpgradePages,
      });
      metrics.record(METRIC.RAG_LATENCY, Date.now() - start, { agentName: 'QAAgent' });
      metrics.increment(METRIC.RAG_RETRIEVE_SUCCESS, 1, { agentName: 'QAAgent' });
      metrics.record(METRIC.RAG_CONTEXT_TOKENS, estimateTokens(result.context), { agentName: 'QAAgent' });
      return { ragContext: result.context || undefined };
    } catch {
      metrics.record(METRIC.RAG_LATENCY, Date.now() - start, { agentName: 'QAAgent' });
      metrics.increment(METRIC.RAG_RETRIEVE_FAILURE, 1, { agentName: 'QAAgent' });
      return { ragContext: undefined };
    }
  }

  async function generateNode(state: Readonly<QAState>): Promise<Partial<QAState>> {
    const question = state.processedQuestion ?? state.question;
    const subject = state.subjectId ?? '通用';
    const conversationContext = buildConversationContext(state.history);

    const ragContext = state.ragContext
      ? `### 知识库参考资料\n\n${state.ragContext}`
      : '';

    metrics.record(METRIC.QA_CONTEXT_HISTORY_TOKENS, estimateTokens(conversationContext), { agentName: 'QAAgent' });
    metrics.record(METRIC.QA_CONTEXT_RAG_TOKENS, estimateTokens(ragContext), { agentName: 'QAAgent' });
    metrics.record(
      METRIC.QA_CONTEXT_TOTAL_TOKENS,
      estimateTokens(`${conversationContext}\n${ragContext}\n${question}`),
      { agentName: 'QAAgent' },
    );

    const images = normalizeQAStateImages(state);
    const { messages, systemPrompt, cacheBreakpoint } = new PromptBuilder()
      .setPersona(QA_PERSONA, { subject })
      .setTask(QA_TASK, { question, ragContext, conversationContext })
      .setOutputFormat(QA_OUTPUT_SCHEMA)
      .build();
    const multimodalMessages = appendImageUrlBlocks(messages, images);

    const raw = await withRetry(
      async () => {
        const response = await llm.call({
          model: MODELS.SONNET,
          messages: multimodalMessages,
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

    const needsVideo = state.generateVideo || raw.needs_video;

    return {
      answer: raw.answer,
      knowledgePoints: raw.knowledge_points,
      difficulty: raw.difficulty,
      subject: raw.subject,
      needsVideo,
    };
  }

  return {
    prepareNode,
    ragNode,
    generateNode,
    END,
  };
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
  if (summaryText) {
    sections.push(summaryText);
  }
  if (recent) {
    sections.push(`### 近期对话原文（最近6条）\n${recent}`);
  }
  return sections.join('\n\n') || '无历史对话。';
}

function compactContent(content: Message['content']): string {
  const raw = typeof content === 'string'
    ? content
    : content
        .map((block) => (block.type === 'text' ? block.text : '[图片]'))
        .join(' ');
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

function normalizeQAStateImages(state: Readonly<QAState>): Array<{ url: string; mediaType?: string }> {
  const images = (state.images ?? [])
    .filter((item) => item.url)
    .slice(0, 9);
  return images;
}

function appendImageUrlBlocks(messages: Message[], images: Array<{ url: string }>): Message[] {
  if (images.length === 0) return messages;
  const lastUserIndex = findLastUserMessageIndex(messages);
  if (lastUserIndex < 0) return messages;

  return messages.map((message, index) => {
    if (index !== lastUserIndex) return message;
    const textBlocks: ContentBlock[] = typeof message.content === 'string'
      ? [{ type: 'text', text: message.content }]
      : message.content;
    const imageBlocks: ContentBlock[] = images.map((image) => ({
      type: 'image',
      source: { type: 'url', url: image.url },
    }));
    return {
      ...message,
      content: [...imageBlocks, ...textBlocks],
    };
  });
}

function findLastUserMessageIndex(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return i;
  }
  return -1;
}
