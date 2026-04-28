import http from './http';
import type { KnowledgeBase, KnowledgeFile, CreateKnowledgeBaseDto, UpdateKnowledgeBaseDto, KnowledgeBaseQuery } from '@tutor/shared';
import { USE_MOCK } from '@/mock/config';
import { mockKnowledgeApi } from '@/mock/handlers/knowledge';

const realKnowledgeApi = {
  getKnowledgeBases: (params?: KnowledgeBaseQuery) =>
    http.get<KnowledgeBase[], KnowledgeBase[]>('/knowledge-bases', { params }),

  getKnowledgeBase: (id: string) =>
    http.get<KnowledgeBase, KnowledgeBase>(`/knowledge-bases/${id}`),

  createKnowledgeBase: (data: CreateKnowledgeBaseDto) =>
    http.post<KnowledgeBase, KnowledgeBase>('/knowledge-bases', data),

  updateKnowledgeBase: (id: string, data: UpdateKnowledgeBaseDto) =>
    http.put<KnowledgeBase, KnowledgeBase>(`/knowledge-bases/${id}`, data),

  deleteKnowledgeBase: (id: string) =>
    http.delete(`/knowledge-bases/${id}`),

  uploadFile: (knowledgeBaseId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<KnowledgeFile, KnowledgeFile>(`/knowledge-bases/${knowledgeBaseId}/files`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  updateFile: (knowledgeBaseId: string, fileId: string, data: { displayName?: string; content?: string; order?: number }) =>
    http.put<KnowledgeFile, KnowledgeFile>(`/knowledge-bases/${knowledgeBaseId}/files/${fileId}`, data),

  deleteFile: (knowledgeBaseId: string, fileId: string) =>
    http.delete(`/knowledge-bases/${knowledgeBaseId}/files/${fileId}`),

  reorderFiles: (knowledgeBaseId: string, fileIds: string[]) =>
    http.put(`/knowledge-bases/${knowledgeBaseId}/files/reorder`, { fileIds }),

  getFileContent: (knowledgeBaseId: string, fileId: string) =>
    http.get<{ content: string }, { content: string }>(`/knowledge-bases/${knowledgeBaseId}/files/${fileId}/content`),
};

export const knowledgeApi = USE_MOCK ? mockKnowledgeApi : realKnowledgeApi;
