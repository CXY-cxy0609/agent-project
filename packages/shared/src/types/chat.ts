export type MessageRole = 'user' | 'assistant' | 'system';
export type ModelType = 'chat' | 'video';
export type MessageStatus = 'pending' | 'streaming' | 'done' | 'error';

export interface Conversation {
  id: string;
  title: string;
  subjectId: number;
  subjectName: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  seq?: number;
  role: MessageRole;
  content: string;
  attachments?: MessageAttachment[];
  status: MessageStatus;
  createdAt: string;
  turnId?: string;
  replyToMessageId?: string;
  metadata?: MessageMetadata;
}

export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'pdf' | 'file';
  size: number;
  mimeType?: string;
  storageKey?: string;
  thumbnailUrl?: string;
  hash?: string;
  status?: 'uploading' | 'done' | 'error';
}

export interface MessageMetadata {
  model?: string;
  tokens?: number;
  reasoning?: string;
  semanticSummary?: string;
  thoughtChain?: ThoughtStep[];
  videoUrl?: string;
  videoRunId?: string;
  artifactBundleUrl?: string;
  artifactManifestUrl?: string;
  videoProgress?: VideoProgress;
}

export interface ThoughtStep {
  title: string;
  content: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface VideoProgress {
  status: 'pending' | 'processing' | 'done' | 'error';
  percent: number;
  description: string;
  videoUrl?: string;
}

export interface SendMessageDto {
  conversationId?: string;
  subjectId: number;
  content: string;
  model: string;
  attachments?: File[];
  generateVideo?: boolean;
}

export interface ConversationListQuery {
  page?: number;
  pageSize?: number;
  title?: string;
  subjectId?: number;
  knowledgeKeyword?: string;
  startDate?: string;
  endDate?: string;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
