import type { SubgraphDefinition } from '../harness/runtime/types.js';
import type { LearningRecordAgent } from '../agents/learning-record/learning-record.agent.js';
import type { LearningRecordOutput } from '../agents/learning-record/learning-record.types.js';

export interface LearningRecordInput {
  userId: string;
  sessionId: string;
  question: string;
  answer: string;
  subject: string;
  knowledgePoints: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

export function createLearningRecordSubgraph(
  learningRecordAgent: LearningRecordAgent,
): SubgraphDefinition<LearningRecordInput, LearningRecordOutput> {
  return {
    id: 'learning_record',
    async run(input, context) {
      context.emitEvent('learning_record.node.started', 'learning_record.run', {
        user_id: input.userId,
      });
      const output = await learningRecordAgent.run(
        {
          action: 'record',
          userId: input.userId,
          conversationSummary: {
            sessionId: input.sessionId,
            traceId: context.agentContext.traceId,
            question: input.question,
            answer: input.answer,
            subject: input.subject,
            knowledgePoints: input.knowledgePoints,
            difficulty: input.difficulty,
          },
        },
        context.agentContext,
      );
      context.stateStore.setNodeState(context.workflowId, 'learning_record.output', {
        success: output.success,
      });
      context.emitEvent('learning_record.node.completed', 'learning_record.run', {
        success: output.success,
      });
      return output;
    },
  };
}
