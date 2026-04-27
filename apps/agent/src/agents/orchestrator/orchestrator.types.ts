import type { Message } from '../../harness/core/types.js';

export type IntentType = 'qa' | 'video_request' | 'knowledge_query' | 'learning_report' | 'unknown';

export interface OrchestratorInput {
  userMessage: string;
  /** 多模态附件（图片 base64） */
  imageBase64?: string;
  imageMediaType?: string;
  subjectId?: string;
  conversationId?: string;
}

export interface IntentClassification {
  intent: IntentType;
  subjectId?: string;
  confidence: number;
  reasoning?: string;
}

export interface OrchestratorOutput {
  intent: IntentType;
  reply: string;
  subjectId?: string;
  videoUrl?: string;
  conversationId: string;
}

export interface OrchestratorState {
  input: OrchestratorInput;
  history: Message[];
  intent?: IntentClassification;
  subAgentReply?: string;
  videoUrl?: string;
}
