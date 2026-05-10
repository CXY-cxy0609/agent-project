/**
 * Video Agent — 负责完整的 Manim 视频生成流水线
 * 推理模式：Plan-and-Execute（Graph 串行多步骤，含 Manim 重试机制）
 * 作为 QA Agent 的子 Agent 调用
 */

import { BaseAgent } from '../../harness/core/agent.js';
import { StateGraph } from '../../harness/core/graph.js';
import type { GraphCheckpointStore } from '../../harness/core/checkpoint.js';
import { resolveGraphExecutionControl } from '../../harness/core/workflow-control.js';
import type { ContentVectorCache, AgentContext } from '../../harness/core/types.js';
import type { ToolRegistry } from '../../harness/tool/tool.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { Observer } from '../../harness/observer/tracer.js';
import type { VideoAgentInput, VideoAgentOutput, VideoState } from './video.types.js';
import { buildVideoNodes } from './video.graph.js';

const DEFAULT_CACHE_THRESHOLD = 0.92;

export class VideoAgent extends BaseAgent<VideoAgentInput, VideoAgentOutput> {
  constructor(
    llm: LLMClient,
    observer: Observer,
    private readonly videoCache: ContentVectorCache,
    private readonly toolRegistry: ToolRegistry,
    private readonly checkpointStore?: GraphCheckpointStore<VideoState>,
  ) {
    super(llm, observer);
  }

  async execute(input: VideoAgentInput, ctx: AgentContext): Promise<VideoAgentOutput> {
    const nodes = buildVideoNodes(this.llm, this.videoCache, this.toolRegistry);

    const graph = new StateGraph<VideoState>({
      knowledgeDescription: input.knowledgeDescription,
      subject: input.subject,
      useVideoCache: input.useVideoCache ?? true,
      cacheScoreThreshold: input.cacheScoreThreshold ?? DEFAULT_CACHE_THRESHOLD,
      cacheHit: false,
      retryCount: 0,
      scriptVersion: 0,
      fixHistory: [],
      success: false,
    })
      .addNode('checkCache', nodes.checkCacheNode)
      .addNode('generateStoryboard', nodes.generateStoryboardNode)
      .addNode('generateScript', nodes.generateManimScriptNode)
      .addNode('renderManim', nodes.renderManimNode)
      .addNode('fixScript', nodes.fixManimScriptNode)
      .addNode('uploadVideo', nodes.uploadVideoNode)
      .addNode('returnCached', async (s) => ({ videoUrl: s.videoUrl }))

      .addConditionalEdge('checkCache', nodes.shouldUseCached, {
        cached: 'returnCached',
        generate: 'generateStoryboard',
      })
      .addEdge('returnCached', nodes.END)
      .addEdge('generateStoryboard', 'generateScript')
      .addEdge('generateScript', 'renderManim')
      .addConditionalEdge('renderManim', nodes.shouldRetryRender, {
        upload: 'uploadVideo',
        retry: 'fixScript',
        fail: nodes.END,
      })
      .addEdge('fixScript', 'renderManim')
      .addEdge('uploadVideo', nodes.END)
      .compile();

    const graphControl = resolveGraphExecutionControl(ctx, 'video');
    const finalState = await graph.run({}, this.checkpointStore
      ? {
          workflowId: graphControl.workflowId,
          checkpointStore: this.checkpointStore,
          resumeFromCheckpoint: graphControl.resumeFromCheckpoint,
          clearCheckpointOnDone: graphControl.clearCheckpointOnDone,
        }
      : undefined);

    // 成功时异步写入视频缓存
    if (finalState.success && finalState.videoUrl) {
      setImmediate(() => {
        this.videoCache
          .store(input.knowledgeDescription, {
            contentKey: input.knowledgeDescription,
            payload: {
              videoUrl: finalState.videoUrl,
              subject: input.subject,
              createdAt: new Date().toISOString(),
            },
          })
          .catch(() => {});
      });
    }

    return {
      videoUrl: finalState.videoUrl,
      success: finalState.success,
      failureReason: finalState.failureReason,
    };
  }
}
