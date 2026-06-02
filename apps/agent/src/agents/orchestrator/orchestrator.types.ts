import type { Message } from '../../harness/core/types.js';

export type IntentType = 'qa' | 'video_request' | 'knowledge_query' | 'learning_report' | 'unknown';

export interface OrchestratorInput {
  userMessage: string;
  /** 多模态附件（图片 base64） */
  imageBase64?: string;
  imageMediaType?: string;
  /** 前端显式请求生成视频 */
  generateVideo?: boolean;
  subjectId?: string;
  availableSubjects?: Array<{ id: string | number; name: string; code?: string | number }>;
  conversationId?: string;
}

export interface IntentClassification {
  intent: IntentType;
  subjectId?: string;
  confidence: number;
  videoRequired?: boolean;
  reasoning?: string;
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
