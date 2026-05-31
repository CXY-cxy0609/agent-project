import type { SubgraphDefinition } from '../harness/runtime/types.js';
import type { LearningRecordAgent } from '../agents/learning-record/learning-record.agent.js';
import type { LearningRecordOutput } from '../agents/learning-record/learning-record.types.js';

export interface LearningReportInput {
  userId: string;
  subjectId?: string;
}

export function createLearningReportSubgraph(
  learningRecordAgent: LearningRecordAgent,
): SubgraphDefinition<LearningReportInput, LearningRecordOutput> {
  return {
    id: 'learning_report',
    async run(input, context) {
      context.emitEvent('learning_report.node.started', 'learning_report.run', {
        user_id: input.userId,
      });
      const output = await learningRecordAgent.run(
        {
          action: 'generate_report',
          userId: input.userId,
          subjectId: input.subjectId,
        },
        context.agentContext,
      );
      context.stateStore.setNodeState(context.workflowId, 'learning_report.output', {
        success: output.success,
      });
      context.emitEvent('learning_report.node.completed', 'learning_report.run', {
        success: output.success,
      });
      return output;
    },
  };
}
