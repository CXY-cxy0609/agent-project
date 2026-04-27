export interface KnowledgeBaseInput {
  action: 'index_document' | 'index_text' | 'delete_document';
  knowledgeBaseId: string;
  subjectId: string;
  /** action = index_document 时需要 */
  fileContentBase64?: string;
  filename?: string;
  /** action = index_text 时需要 */
  text?: string;
  docName?: string;
  docId?: string;
}

export interface KnowledgeBaseOutput {
  success: boolean;
  docId?: string;
  chunkCount?: number;
  message?: string;
}
