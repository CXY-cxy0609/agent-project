/**
 * QA Agent Graph 节点定义
 * 流程：OCR（可选）→ RAG 检索 → LLM 生成 → 视频（可选）
 */

import { PromptBuilder } from '../../harness/prompt/builder.js';
import { SchemaParser } from '../../harness/output/schema-parser.js';
import { END } from '../../harness/core/graph.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { RagClient } from '../../harness/rag-client/rag-client.js';
import type { ToolRegistry } from '../../harness/tool/tool.js';
import { MODELS } from '../../constants/models.js';
import { QA_PERSONA, QA_TASK, QA_OUTPUT_SCHEMA } from './qa.prompts.js';
import type { QAState, QAAnswerRaw } from './qa.types.js';
import type { VideoAgent } from '../video/video.agent.js';
import type { AgentContext } from '../../harness/core/types.js';
import { withRetry } from '../../harness/core/retry.js';
import {
  decideRetrievalPolicy,
  type QARetrievalPolicyConfig,
} from './retrieval-policy.js';

const schemaParser = new SchemaParser();

export function buildQANodes(
  llm: LLMClient,
  ragClient: RagClient,
  toolRegistry: ToolRegistry,
  videoAgent: VideoAgent,
  ctx: AgentContext,
  retrievalPolicyConfig: QARetrievalPolicyConfig,
) {
  async function ocrNode(state: Readonly<QAState>): Promise<Partial<QAState>> {
    if (!state.imageBase64) {
      return {
        processedQuestion: state.question,
        retrievalMode: 'text_only',
        ragBudgetTokens: undefined,
        ragMaxUpgradePages: undefined,
      };
    }

    const ocrTool = toolRegistry.get('image_ocr');
    if (!ocrTool) return { processedQuestion: state.question };

    const result = (await ocrTool.execute({
      image_base64: state.imageBase64,
      media_type: state.imageMediaType ?? 'image/jpeg',
    })) as { extracted_text: string; success: boolean };

    const ocrText = result.success ? result.extracted_text : '';
    const processedQuestion = ocrText
      ? `${state.question}\n\n[图片内容识别]\n${ocrText}`
      : state.question;

    const retrievalPolicy = decideRetrievalPolicy(
      state.question,
      ocrText,
      retrievalPolicyConfig,
    );
    return {
      ocrText,
      processedQuestion,
      retrievalMode: retrievalPolicy.mode,
      ragBudgetTokens: retrievalPolicy.budgetTokens,
      ragMaxUpgradePages: retrievalPolicy.maxUpgradePages,
    };
  }

  async function ragNode(state: Readonly<QAState>): Promise<Partial<QAState>> {
    const query = state.processedQuestion ?? state.question;
    try {
      const result = await ragClient.retrieve(query, {
        subjectId: state.subjectId,
        topK: 5,
        retrievalMode: state.retrievalMode ?? 'text_only',
        budgetTokens: state.ragBudgetTokens,
        maxUpgradePages: state.ragMaxUpgradePages,
      });
      return { ragContext: result.context || undefined };
    } catch {
      return { ragContext: undefined };
    }
  }

  async function generateNode(state: Readonly<QAState>): Promise<Partial<QAState>> {
    const question = state.processedQuestion ?? state.question;
    const subject = state.subjectId ?? '通用';

    const ragContext = state.ragContext
      ? `### 知识库参考资料\n\n${state.ragContext}`
      : '';

    const { messages, systemPrompt, cacheBreakpoint } = new PromptBuilder()
      .setPersona(QA_PERSONA, { subject })
      .setTask(QA_TASK, { question, ragContext })
      .setOutputFormat(QA_OUTPUT_SCHEMA)
      .build();

    const fullMessages = [
      ...state.history.filter((m) => m.role !== 'system'),
      ...messages,
    ];

    const raw = await withRetry(
      async () => {
        const response = await llm.call({
          model: MODELS.SONNET,
          messages: fullMessages,
          systemPrompt,
          cacheBreakpoint,
          maxTokens: 3000,
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

  async function videoNode(state: Readonly<QAState>): Promise<Partial<QAState>> {
    if (!state.needsVideo || !state.answer) return {};

    try {
      const videoResult = await videoAgent.run(
        {
          knowledgeDescription: state.processedQuestion ?? state.question,
          subject: state.subject ?? state.subjectId,
          useVideoCache: true,
        },
        ctx,
      );

      return { videoUrl: videoResult.videoUrl };
    } catch {
      return { videoUrl: undefined };
    }
  }

  function shouldGenerateVideo(state: Readonly<QAState>): 'yes' | 'no' {
    return state.needsVideo ? 'yes' : 'no';
  }

  return {
    ocrNode,
    ragNode,
    generateNode,
    videoNode,
    shouldGenerateVideo,
    END,
  };
}
