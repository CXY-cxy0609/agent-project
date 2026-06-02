import type { SubgraphDefinition } from '../harness/runtime/types.js';
import type { VideoAgent } from '../agents/video/video.agent.js';
import type { VideoAgentInput, VideoAgentOutput } from '../agents/video/video.types.js';
import type { GraphNodeExecutionEvent } from '../harness/core/graph.js';

export function createVideoSubgraph(
  videoAgent: VideoAgent,
): SubgraphDefinition<VideoAgentInput, VideoAgentOutput> {
  return {
    id: 'video',
    async run(input, context) {
      const childContext = {
        ...context.agentContext,
        metadata: {
          ...(context.agentContext.metadata ?? {}),
          nodeEventEmitter: (event: GraphNodeExecutionEvent) => {
            context.stateStore.setNodeState(context.workflowId, `video.${event.node}`, {
              event: event.event,
              attempt: event.attempt,
              elapsed_ms: event.elapsedMs,
              error: event.error,
              updated_at: new Date().toISOString(),
            });
            context.emitEvent(`video.node.${event.event}`, event.node, event);
          },
        },
      };
      context.stateStore.setNodeState(context.workflowId, 'video.input', {
        subject: input.subject,
        use_video_cache: input.useVideoCache ?? true,
        run_id: input.runId ?? '',
        artifact_run_dir: input.artifactRunDir ?? '',
      });
      context.emitEvent('video.node.started', 'video.run', {
        subject: input.subject,
      });
      const output = await videoAgent.run(input, childContext);
      context.stateStore.setArtifact(context.workflowId, 'video.last_result', output);
      context.emitEvent('video.node.completed', 'video.run', {
        success: output.success,
      });
      return output;
    },
  };
}
