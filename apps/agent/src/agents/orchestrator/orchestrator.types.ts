import type { Message } from '../../harness/core/types.js';

export type IntentType = 'qa' | 'video_request' | 'knowledge_query' | 'learning_report' | 'unknown';

export interface SubjectOption {
  id: string;
  name: string;
  code?: string;
}

export interface OrchestratorInput {
  userMessage: string;
  /** 多模态附件（图片 URL），最多 9 张 */
  images?: Array<{ url: string; mediaType?: string }>;
  /** 前端显式请求生成视频 */
  generateVideo?: boolean;
  subjectId?: string;
  availableSubjects?: SubjectOption[];
  conversationId?: string;
  messageCount?: number;
}

export interface IntentClassification {
  intent: IntentType;
  subjectId?: string;
  confidence: number;
  videoRequired?: boolean;
  reasoning?: string;
  title?: string;
}

export interface IntentRaw {
  intent: string;
  subject_id?: string;
  confidence: number;
  video_required?: boolean;
  reasoning?: string;
  title?: string;
}

export interface ImageSemanticRaw {
  problem_text: string;
  visual_description: string;
  known_conditions: string[];
  target_question: string;
  semantic_summary: string;
}

export interface ImageSemanticOutput {
  problemText: string;
  visualDescription: string;
  knownConditions: string[];
  targetQuestion: string;
  semanticSummary: string;
}

export interface VideoRunRecord {
  runId: string;
  workflowId: string;
  traceId: string;
  artifactRunDir: string;
  artifactObjectPrefix: string;
  artifactBundleUrl?: string;
  artifactManifestUrl?: string;
}

export interface OrchestratorOutput {
  intent: IntentType;
  reply: string;
  subjectId?: string;
  videoUrl?: string;
  videoRunId?: string;
  artifactBundleUrl?: string;
  artifactManifestUrl?: string;
  conversationId: string;
  title?: string;
}

export interface OrchestratorState {
  input: OrchestratorInput;
  history: Message[];
  intent: IntentClassification;
  imageSemantic?: ImageSemanticOutput;
  videoRunRecord?: VideoRunRecord;
  subAgentReply?: string;
  videoUrl?: string;
}
