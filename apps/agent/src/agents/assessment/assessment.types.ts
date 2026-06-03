export type AssessmentDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type QuestionType = 'single_choice' | 'multiple_choice' | 'fill_blank' | 'true_false' | 'short_answer';

export interface AssessmentKnowledgePoint {
  knowledgeKey: string;
  label: string;
  subjectId?: number | null;
}

export interface QuestionTypeConfig {
  type: QuestionType;
  count: number;
  difficulty?: AssessmentDifficulty;
}

export interface AssessmentGenerationConfig {
  mode: 'quick_practice' | 'exam' | 'gap_check';
  difficulty: AssessmentDifficulty;
  questionTypes: QuestionTypeConfig[];
  showExplanationPolicy: 'after_each_submit' | 'after_submit';
  timeLimitSeconds?: number | null;
  knowledgeBasePolicy: 'none' | 'prefer_authorized' | 'required';
  style: 'concept_check' | 'basic_review' | 'application' | 'comprehensive';
}

export interface GenerateAssessmentInput {
  subjectId?: number | null;
  source: 'weak_point' | 'manual';
  knowledgePoints: AssessmentKnowledgePoint[];
  generationConfig: AssessmentGenerationConfig;
}

export interface AssessmentQuestion {
  id: string;
  knowledgeKey: string;
  questionType: QuestionType;
  stem: string;
  options?: Array<{ id: string; text: string }>;
  answer: unknown;
  rubric?: Array<{ criterion: string; points: number }>;
  difficulty: Exclude<AssessmentDifficulty, 'mixed'>;
  score: number;
  explanation: string;
}

export interface GenerateAssessmentOutput {
  questions: AssessmentQuestion[];
  metadata: {
    generatedBy: 'agent';
    promptVersion: string;
    model?: string;
  };
}

export interface GradeAssessmentInput {
  questions: AssessmentQuestion[];
  answers: Array<{ questionId: string; answer: unknown; attachments?: AssessmentAnswerAttachment[] }>;
}

export interface AssessmentAnswerAttachment {
  id: string;
  name?: string;
  url: string;
  type: 'image';
  mimeType?: string;
  storageKey?: string;
}

export interface GradeAssessmentOutput {
  totalScore: number;
  maxScore: number;
  answers: Array<{
    questionId: string;
    isCorrect: boolean;
    score: number;
    maxScore: number;
    scoreRatio: number;
    feedback: string;
    rubricScores?: Array<{ criterion: string; score: number; maxScore: number; comment?: string }>;
  }>;
  recommendations: string[];
}
