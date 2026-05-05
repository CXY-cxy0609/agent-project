export type KnowledgeBaseType = 'public' | 'private';
export type KnowledgeFileType = 'pdf' | 'md';

export interface KnowledgeBase {
  id: string;
  name: string;
  subjectId: number;
  subjectName: string;
  type: KnowledgeBaseType;
  userId: string;
  description?: string;
  files: KnowledgeFile[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeFile {
  id: string;
  knowledgeBaseId: string;
  name: string;
  displayName: string;
  type: KnowledgeFileType;
  url: string;
  size: number;
  order: number;
  content?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBaseDto {
  name: string;
  subjectId: number;
  type: KnowledgeBaseType;
  description?: string;
}

export interface UpdateKnowledgeBaseDto {
  name?: string;
  description?: string;
}

export interface KnowledgeBaseQuery {
  subjectId?: number;
  name?: string;
  type?: KnowledgeBaseType;
}
