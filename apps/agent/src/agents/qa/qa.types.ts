import type { Message } from '../../harness/core/types.js';
import type { RetrievalMode } from '../../harness/rag-client/rag-client.js';

export interface QAInput {
  question: string;
  images?: Array<{ url: string; mediaType?: string }>;
  subjectId: string;
  history: Message[];
  generateVideo?: boolean;
}

export interface QAOutput {
  answer: string;
  knowledgePoints: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  subject: string;
  videoUrl?: string;
  needsVideo: boolean;
}

export interface QAState {
  question: string;
  images?: Array<{ url: string; mediaType?: string }>;
  subjectId: string;
  history: Message[];
  generateVideo: boolean;
  /** 最终使用的问题文本 */
  processedQuestion?: string;
  /** 根据输入推断的检索模式 */
  retrievalMode?: RetrievalMode;
  /** 动态预算约束 */
  ragBudgetTokens?: number;
  ragMaxUpgradePages?: number;
  /** RAG 检索结果 */
  ragContext?: string;
  /** LLM 生成的结构化答案 */
  answer?: string;
  knowledgePoints?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  subject?: string;
  needsVideo?: boolean;
  /** 视频 Agent 返回的 URL */
  videoUrl?: string;
}

export interface QAAnswerRaw {
  answer: string;
  knowledge_points: string[];
  needs_video: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  subject: string;
}
