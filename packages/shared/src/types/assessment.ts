export type AssessmentSource = 'weak_point' | 'manual';
export type AssessmentMode = 'quick_practice' | 'exam' | 'gap_check';
export type AssessmentStatus = 'draft' | 'generating' | 'answering' | 'submitted' | 'graded' | 'failed';
export type AssessmentDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type QuestionType = 'single_choice' | 'multiple_choice' | 'fill_blank' | 'true_false' | 'short_answer';
export type ExplanationPolicy = 'after_each_submit' | 'after_submit';
export type KnowledgeBasePolicy = 'none' | 'prefer_authorized' | 'required';
export type QuestionStyle = 'concept_check' | 'basic_review' | 'application' | 'comprehensive';

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
  mode: AssessmentMode;
  difficulty: AssessmentDifficulty;
  questionTypes: QuestionTypeConfig[];
  showExplanationPolicy: ExplanationPolicy;
  timeLimitSeconds?: number | null;
  knowledgeBasePolicy: KnowledgeBasePolicy;
  style: QuestionStyle;
}

export interface GenerateAssessmentRequest {
  subjectId?: number | null;
  source: AssessmentSource;
  knowledgePoints: AssessmentKnowledgePoint[];
  generationConfig: AssessmentGenerationConfig;
}

export interface RegenerateAssessmentRequest {
  assessmentId: string;
}

export interface AssessmentQuestionOption {
  id: string;
  text: string;
}

export interface AssessmentRubricItem {
  criterion: string;
  points: number;
}

export interface AssessmentQuestion {
  id: string;
  assessmentId: string;
  knowledgeKey: string;
  questionType: QuestionType;
  stem: string;
  options?: AssessmentQuestionOption[];
  answer: unknown;
  rubric?: AssessmentRubricItem[];
  difficulty: Exclude<AssessmentDifficulty, 'mixed'>;
  score: number;
  explanation: string;
}

export interface AssessmentAnswerInput {
  questionId: string;
  answer: string | string[] | boolean;
  attachments?: AssessmentAnswerAttachment[];
}

export interface AssessmentAnswerAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image';
  size: number;
  mimeType: string;
  storageKey?: string;
  thumbnailUrl?: string;
  hash?: string;
  status?: 'done' | 'deleted';
}

export interface SubmitAssessmentRequest {
  assessmentId: string;
  answers: AssessmentAnswerInput[];
}

export interface GradeAssessmentRequest {
  assessmentId: string;
}

export interface AssessmentAnswerResult {
  questionId: string;
  isCorrect: boolean;
  score: number;
  maxScore?: number;
  scoreRatio?: number;
  feedback: string;
  rubricScores?: AssessmentRubricScore[];
}

export interface AssessmentRubricScore {
  criterion: string;
  score: number;
  maxScore: number;
  comment?: string;
}

export interface AssessmentGradeResult {
  assessmentId: string;
  totalScore: number;
  maxScore: number;
  answers: AssessmentAnswerResult[];
  weakPointChanges: Array<{
    knowledgeKey: string;
    weaknessScore: number;
    masteryScore: number;
  }>;
  recommendations: string[];
}

export type AssessmentGradeStreamEvent =
  | {
      type: 'assessment.grade.start';
      streamId: string;
      sequence: number;
      assessmentId: string;
      startedAt: string;
    }
  | {
      type: 'assessment.grade.stage';
      streamId: string;
      sequence: number;
      assessmentId: string;
      stage: 'loading' | 'grading' | 'saving' | string;
      message: string;
    }
  | {
      type: 'assessment.grade.done';
      streamId: string;
      sequence: number;
      assessmentId: string;
      result: AssessmentGradeResult;
    }
  | {
      type: 'assessment.grade.error';
      streamId: string;
      sequence: number;
      assessmentId?: string;
      message: string;
    };

export interface Assessment {
  id: string;
  title?: string;
  userId: string;
  subjectId: number | null;
  subjectName?: string | null;
  source: AssessmentSource;
  sourceLabel?: string;
  mode: AssessmentMode;
  status: AssessmentStatus;
  statusLabel?: string;
  knowledgePoints: AssessmentKnowledgePoint[];
  generationConfig: AssessmentGenerationConfig;
  questions: AssessmentQuestion[];
  questionCount?: number;
  generatedCount?: number;
  answeredCount?: number;
  totalScore?: number;
  maxScore?: number;
  createdAt: string;
  displayTime?: string;
  submittedAt?: string;
  gradedAt?: string;
  answers?: AssessmentAnswerInput[];
  gradeResults?: AssessmentAnswerResult[];
}

export interface AssessmentDetailRequest {
  assessmentId: string;
}

export interface AssessmentListRequest {
  scope?: 'overall' | 'subject' | 'unassigned';
  subjectId?: number | null;
  status?: AssessmentStatus;
  source?: AssessmentSource;
  page: number;
  pageSize: number;
}

export type AssessmentGenerationStreamEvent =
  | {
      type: 'assessment.start';
      streamId: string;
      sequence: number;
      assessmentId: string;
      totalCount: number;
      assessment: Assessment;
    }
  | {
      type: 'assessment.stage';
      streamId: string;
      sequence: number;
      assessmentId: string;
      message: string;
      generatedCount?: number;
      totalCount?: number;
    }
  | {
      type: 'assessment.question.created';
      streamId: string;
      sequence: number;
      assessmentId: string;
      question: AssessmentQuestion;
      generatedCount: number;
      totalCount: number;
    }
  | {
      type: 'assessment.saved';
      streamId: string;
      sequence: number;
      assessmentId: string;
      assessment: Assessment;
    }
  | {
      type: 'assessment.done';
      streamId: string;
      sequence: number;
      assessmentId: string;
    }
  | {
      type: 'assessment.error';
      streamId: string;
      sequence: number;
      assessmentId?: string;
      message: string;
    };
