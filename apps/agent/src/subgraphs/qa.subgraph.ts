import type { SubgraphDefinition } from '../harness/runtime/types.js';
import type { QAInput, QAOutput } from '../agents/qa/qa.types.js';
import type { QAAgent } from '../agents/qa/qa.agent.js';
import type { GraphNodeExecutionEvent } from '../harness/core/graph.js';

export function createQASubgraph(qaAgent: QAAgent): SubgraphDefinition<QAInput, QAOutput> {
  return {
    id: 'qa',
    async run(input, context) {
      const childContext = {
        ...context.agentContext,
        metadata: {
          ...(context.agentContext.metadata ?? {}),
          nodeEventEmitter: (event: GraphNodeExecutionEvent) => {
            context.stateStore.setNodeState(context.workflowId, `qa.${event.node}`, {
              event: event.event,
              attempt: event.attempt,
              elapsed_ms: event.elapsedMs,
              error: event.error,
              updated_at: new Date().toISOString(),
            });
            context.emitEvent(`qa.node.${event.event}`, event.node, event);
          },
        },
      };
      context.stateStore.setNodeState(context.workflowId, 'qa.input', {
        subject_id: input.subjectId,
        generate_video: input.generateVideo ?? false,
      });
      context.emitEvent('qa.node.started', 'qa.run', {
        subject_id: input.subjectId,
      });
      const output = await qaAgent.run(input, childContext);
      context.stateStore.setNodeState(context.workflowId, 'qa.output', {
        needs_video: output.needsVideo,
        subject: output.subject,
      });
      context.emitEvent('qa.node.completed', 'qa.run', {
        needs_video: output.needsVideo,
      });
      return output;
    },
  };
}
