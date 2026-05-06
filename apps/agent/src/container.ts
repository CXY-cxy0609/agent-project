/**
 * 依赖注入容器 — 组装所有 Agent 和工具实例
 * 集中管理所有服务的实例化和依赖关系
 */

import Redis from 'ioredis';
import { createLLMClient } from './harness/core/llm-client.js';
import { ToolRegistry } from './harness/tool/tool.js';
import { RagClient } from './harness/rag-client/rag-client.js';
import { InMemoryShortTermMemory, RedisShortTermMemory } from './harness/memory/short-term.js';
import { HttpUserVectorMemory, HttpContentVectorCache } from './harness/memory/vector-memory.js';
import { HttpStructuredMemory } from './harness/memory/db-memory.js';
import { defaultObserver } from './harness/observer/tracer.js';
import { OrchestratorAgent } from './agents/orchestrator/orchestrator.agent.js';
import { QAAgent } from './agents/qa/qa.agent.js';
import { VideoAgent } from './agents/video/video.agent.js';
import { KnowledgeBaseAgent } from './agents/knowledge-base/knowledge-base.agent.js';
import { LearningRecordAgent } from './agents/learning-record/learning-record.agent.js';
import { createRagRetrievalTool } from './tools/rag-retrieval.tool.js';
import { createImageOcrTool } from './tools/image-ocr.tool.js';
import { createFileParserTool } from './tools/file-parser.tool.js';
import { createManimRunnerTool } from './tools/manim-runner.tool.js';
import { createStorageUploadTool } from './tools/storage-upload.tool.js';
import { eventBus, EVENTS, type QaCompletedEvent } from './events/event-bus.js';
import {
  DEFAULT_QA_RETRIEVAL_POLICY,
  type QARetrievalPolicyConfig,
} from './agents/qa/retrieval-policy.js';

export interface AppConfig {
  /** LLM Provider 选择，默认 anthropic */
  llmProvider?: 'anthropic' | 'doubao';
  /** Anthropic API Key */
  anthropicApiKey?: string;
  /** 豆包（火山引擎）API Key */
  doubaoApiKey?: string;
  /** 豆包 API BaseURL，默认火山引擎北京区 */
  doubaoBaseUrl?: string;
  ragServiceUrl: string;
  serverUrl: string;
  internalToken: string;
  manimServiceUrl?: string;
  storageServiceUrl?: string;
  redisUrl?: string;
  qaRetrievalPolicy?: Partial<QARetrievalPolicyConfig>;
}

export interface AppContainer {
  orchestratorAgent: OrchestratorAgent;
  knowledgeBaseAgent: KnowledgeBaseAgent;
}

export function createContainer(config: AppConfig): AppContainer {
  // ─── 核心基础设施 ──────────────────────────────────────────────────
  const llm = createLLMClient({
    provider: config.llmProvider,
    anthropicApiKey: config.anthropicApiKey,
    doubaoApiKey: config.doubaoApiKey,
    doubaoBaseUrl: config.doubaoBaseUrl,
  });

  let redis: Redis | undefined;
  const memory = (() => {
    if (config.redisUrl) {
      try {
        redis = new Redis(config.redisUrl);
        return new RedisShortTermMemory(redis);
      } catch {
        console.warn('[container] Redis 不可用，降级为内存短期记忆');
      }
    }
    return new InMemoryShortTermMemory();
  })();

  const ragClient = new RagClient(
    config.ragServiceUrl,
    redis,
  );

  const userVectorMemory = new HttpUserVectorMemory(config.ragServiceUrl);
  const contentVectorCache = new HttpContentVectorCache(config.ragServiceUrl);
  const structuredMemory = new HttpStructuredMemory(config.serverUrl, config.internalToken);

  // ─── 工具注册 ──────────────────────────────────────────────────────
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(createRagRetrievalTool(ragClient));
  toolRegistry.register(createImageOcrTool(llm));
  toolRegistry.register(createFileParserTool(config.ragServiceUrl));

  if (config.manimServiceUrl) {
    toolRegistry.register(createManimRunnerTool(config.manimServiceUrl));
  }

  if (config.storageServiceUrl) {
    toolRegistry.register(createStorageUploadTool(config.storageServiceUrl));
  }

  // ─── Agent 实例 ────────────────────────────────────────────────────
  const videoAgent = new VideoAgent(llm, defaultObserver, contentVectorCache, toolRegistry);

  const learningRecordAgent = new LearningRecordAgent(
    llm,
    defaultObserver,
    structuredMemory,
  );

  const qaRetrievalPolicy: QARetrievalPolicyConfig = {
    ...DEFAULT_QA_RETRIEVAL_POLICY,
    ...config.qaRetrievalPolicy,
  };
  const qaAgent = new QAAgent(
    llm,
    defaultObserver,
    ragClient,
    toolRegistry,
    videoAgent,
    qaRetrievalPolicy,
  );

  const orchestratorAgent = new OrchestratorAgent(
    llm,
    defaultObserver,
    memory,
    qaAgent,
    learningRecordAgent,
  );

  const knowledgeBaseAgent = new KnowledgeBaseAgent(
    llm,
    defaultObserver,
    config.ragServiceUrl,
  );

  // ─── 异步事件订阅 ──────────────────────────────────────────────────
  // QA Agent 完成后，Learning Record Agent 异步提取知识点
  eventBus.onQaCompleted(async (event: QaCompletedEvent) => {
    const ctx = {
      userId: event.userId,
      sessionId: event.sessionId,
      traceId: event.traceId,
    };

    learningRecordAgent
      .run(
        {
          action: 'record',
          userId: event.userId,
          conversationSummary: {
            sessionId: event.sessionId,
            traceId: event.traceId,
            question: event.question,
            answer: event.answer,
            subject: event.subject,
            knowledgePoints: event.knowledgePoints,
            difficulty: event.difficulty,
          },
        },
        ctx,
      )
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[LearningRecordAgent] async record failed: ${msg}`);
      });
  });

  return { orchestratorAgent, knowledgeBaseAgent };
}

export function loadConfig(): AppConfig {
  return {
    llmProvider: (process.env.LLM_PROVIDER as 'anthropic' | 'doubao' | undefined) ?? 'anthropic',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    doubaoApiKey: process.env.DOUBAO_API_KEY,
    doubaoBaseUrl: process.env.DOUBAO_BASE_URL,
    ragServiceUrl: process.env.RAG_SERVICE_URL ?? 'http://localhost:8000',
    serverUrl: process.env.SERVER_URL ?? 'http://localhost:3000',
    internalToken: process.env.INTERNAL_TOKEN ?? '',
    manimServiceUrl: process.env.MANIM_SERVICE_URL,
    storageServiceUrl: process.env.STORAGE_SERVICE_URL,
    redisUrl: process.env.REDIS_URL,
    qaRetrievalPolicy: {
      minOcrLengthForTextOnly: Number(process.env.QA_MIN_OCR_LENGTH_FOR_TEXT_ONLY ?? 120),
      hybridBudgetTokens: Number(process.env.QA_HYBRID_BUDGET_TOKENS ?? 3000),
      hybridMaxUpgradePages: Number(process.env.QA_HYBRID_MAX_UPGRADE_PAGES ?? 3),
    },
  };
}
