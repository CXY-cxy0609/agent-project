import type { Message } from '../../harness/core/types.js';

export interface QAInput {
  question: string;
  imageBase64?: string;
  imageMediaType?: string;
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
  imageBase64?: string;
  imageMediaType?: string;
  subjectId: string;
  history: Message[];
  generateVideo: boolean;
  /** OCR 提取的文字（如果有图片） */
  ocrText?: string;
  /** 最终使用的问题文本（含 OCR 结果） */
  processedQuestion?: string;
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
