export interface LearningSummaryInput {
  scope: 'overall' | 'subject';
  subjectId?: number | null;
  subjectName?: string | null;
  analytics: Record<string, unknown>;
  recentEvents?: Array<Record<string, unknown>>;
  recentAssessments?: Array<Record<string, unknown>>;
}

export interface LearningSummaryOutput {
  summary: string;
  highlights: string[];
  weakPointAnalysis: string[];
  recommendedActions: Array<{
    type: 'review' | 'assessment' | 'knowledge_base' | 'subject_create';
    title: string;
    reason: string;
    knowledgeKey?: string;
    subjectId?: number | null;
  }>;
  riskLevel: 'low' | 'medium' | 'high';
}
