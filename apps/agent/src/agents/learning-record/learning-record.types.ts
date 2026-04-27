export type LearningRecordAction = 'record' | 'generate_report';

export interface LearningRecordInput {
  action: LearningRecordAction;
  userId: string;
  subjectId?: string;
  /** action = 'record' 时需要 */
  conversationSummary?: ConversationSummary;
}

export interface ConversationSummary {
  sessionId: string;
  traceId: string;
  question: string;
  answer: string;
  subject: string;
  knowledgePoints: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface LearningRecordOutput {
  success: boolean;
  report?: string;
  recordedPoints?: string[];
}

export interface KnowledgePointExtraction {
  knowledge_points: Array<{
    subject: string;
    chapter: string;
    point: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
}
