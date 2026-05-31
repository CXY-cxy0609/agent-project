import { BaseAgent } from '../../harness/core/agent.js';
import type { NodeGovernancePolicy } from '../../harness/core/graph.js';
import type { AgentContext, ContentVectorCache } from '../../harness/core/types.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { Observer } from '../../harness/observer/tracer.js';
import type { ToolRegistry } from '../../harness/tool/tool.js';
import { MessageDrivenGraph } from '../../harness/runtime/message-graph.js';
import type { MessageEnvelope } from '../../harness/runtime/message-graph.js';
import { buildVideoMessageGraphNodes } from './video.message-graph.js';
import type { VideoAgentInput, VideoAgentOutput } from './video.types.js';
import type { ModelGovernanceConfig } from '../../harness/runtime/model-governance.js';

const DEFAULT_CACHE_THRESHOLD = 0.92;
const VIDEO_UPLOAD_EVENT = 'video.upload.completed';
const VIDEO_RETURN_CACHED_EVENT = 'video.return_cached.completed';

export class VideoAgent extends BaseAgent<VideoAgentInput, VideoAgentOutput> {
  constructor(
    llm: LLMClient,
    observer: Observer,
    private readonly videoCache: ContentVectorCache,
    private readonly toolRegistry: ToolRegistry,
    private readonly modelConfig: ModelGovernanceConfig['video'],
    private readonly nodePolicies?: Record<string, NodeGovernancePolicy>,
  ) {
    super(llm, observer);
  }

  async execute(input: VideoAgentInput, ctx: AgentContext): Promise<VideoAgentOutput> {
    const nodes = buildVideoMessageGraphNodes(this.llm, this.videoCache, this.toolRegistry, this.modelConfig);
    const graph = new MessageDrivenGraph({
      knowledgeDescription: input.knowledgeDescription,
      subject: input.subject,
      useVideoCache: input.useVideoCache ?? true,
      cacheScoreThreshold: input.cacheScoreThreshold ?? DEFAULT_CACHE_THRESHOLD,
      retryCount: 0,
      scriptVersion: 0,
      success: false,
    })
      .addNode('checkCache', nodes.checkCacheNode)
      .addNode('returnCached', nodes.returnCachedNode)
      .addNode('generateStoryboard', nodes.generateStoryboardNode)
      .addNode('generateScript', nodes.generateScriptNode)
      .addNode('renderManim', nodes.renderNode)
      .addNode('fixScript', nodes.fixScriptNode)
      .addNode('uploadVideo', nodes.uploadNode)
      .addConditionalEdge('checkCache', nodes.shouldUseCached, {
        cached: 'returnCached',
        generate: 'generateStoryboard',
      })
      .addEdge('returnCached', '__end__')
      .addEdge('generateStoryboard', 'generateScript')
      .addEdge('generateScript', 'renderManim')
      .addConditionalEdge('renderManim', nodes.shouldRetryRender, {
        upload: 'uploadVideo',
        retry: 'fixScript',
        fail: '__end__',
      })
      .addEdge('fixScript', 'renderManim')
      .addEdge('uploadVideo', '__end__');

    const delegatedEmitter = ctx.metadata?.nodeEventEmitter;
    const { partitions, events } = await graph.run({
      nodePolicies: this.nodePolicies,
      onNodeEvent: async (event) => {
        if (typeof delegatedEmitter === 'function') {
          delegatedEmitter(event);
        }
      },
    });

    const cached = this.findLatestEvent<{ success: boolean; videoUrl?: string }>(events, VIDEO_RETURN_CACHED_EVENT);
    const uploaded = this.findLatestEvent<{ success: boolean; videoUrl?: string; failureReason?: string }>(
      events,
      VIDEO_UPLOAD_EVENT,
    );

    const output: VideoAgentOutput = cached
      ? { success: true, videoUrl: cached.videoUrl }
      : {
          success: uploaded?.success ?? Boolean(partitions.workflow_state.success),
          videoUrl: uploaded?.videoUrl ?? (typeof partitions.workflow_state.videoUrl === 'string' ? partitions.workflow_state.videoUrl : undefined),
          failureReason: uploaded?.failureReason
            ?? (typeof partitions.workflow_state.failureReason === 'string' ? partitions.workflow_state.failureReason : undefined),
        };

    if (output.success && output.videoUrl) {
      setImmediate(() => {
        this.videoCache
          .store(input.knowledgeDescription, {
            contentKey: input.knowledgeDescription,
            payload: {
              videoUrl: output.videoUrl,
              subject: input.subject,
              createdAt: new Date().toISOString(),
            },
          })
          .catch(() => {});
      });
    }

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
