import http from './http';
import type { KnowledgeBase, KnowledgeFile, CreateKnowledgeBaseDto, UpdateKnowledgeBaseDto, KnowledgeBaseQuery } from '@tutor/shared';
import { USE_MOCK } from '@/mock/config';
import { mockKnowledgeApi } from '@/mock/handlers/knowledge';

const realKnowledgeApi = {
  getKnowledgeBases: (params?: KnowledgeBaseQuery) =>
    http
      .get<{ list?: KnowledgeBase[] }, { list?: KnowledgeBase[] }>('/knowledge-bases', { params })
      .then((payload) => payload.list ?? []),

  getKnowledgeBase: (id: string) =>
    http
      .get<{ knowledgeBase?: KnowledgeBase } & Partial<KnowledgeBase>, { knowledgeBase?: KnowledgeBase } & Partial<KnowledgeBase>>(`/knowledge-bases/${id}`)
      .then((payload) => payload.knowledgeBase ?? (payload as KnowledgeBase)),

  createKnowledgeBase: (data: CreateKnowledgeBaseDto) =>
    http
      .post<{ knowledgeBase?: KnowledgeBase } & Partial<KnowledgeBase>, { knowledgeBase?: KnowledgeBase } & Partial<KnowledgeBase>>('/knowledge-bases', data)
      .then((payload) => payload.knowledgeBase ?? (payload as KnowledgeBase)),

  updateKnowledgeBase: (id: string, data: UpdateKnowledgeBaseDto) =>
    http
      .put<{ knowledgeBase?: KnowledgeBase } & Partial<KnowledgeBase>, { knowledgeBase?: KnowledgeBase } & Partial<KnowledgeBase>>(`/knowledge-bases/${id}`, data)
      .then((payload) => payload.knowledgeBase ?? (payload as KnowledgeBase)),

  deleteKnowledgeBase: (id: string) =>
    http.delete(`/knowledge-bases/${id}`),

  uploadFile: (knowledgeBaseId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<{ file?: KnowledgeFile } & Partial<KnowledgeFile>, { file?: KnowledgeFile } & Partial<KnowledgeFile>>(`/knowledge-bases/${knowledgeBaseId}/files`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((payload) => payload.file ?? (payload as KnowledgeFile));
  },

  updateFile: (knowledgeBaseId: string, fileId: string, data: { displayName?: string; content?: string; order?: number }) =>
    http
      .put<{ file?: KnowledgeFile } & Partial<KnowledgeFile>, { file?: KnowledgeFile } & Partial<KnowledgeFile>>(`/knowledge-bases/${knowledgeBaseId}/files/${fileId}`, data)
      .then((payload) => payload.file ?? (payload as KnowledgeFile)),

  deleteFile: (knowledgeBaseId: string, fileId: string) =>
    http.delete(`/knowledge-bases/${knowledgeBaseId}/files/${fileId}`),

  reorderFiles: (knowledgeBaseId: string, fileIds: string[]) =>
    http.put(`/knowledge-bases/${knowledgeBaseId}/files/reorder`, { fileIds }),

  getFileContent: (knowledgeBaseId: string, fileId: string) =>
    http.get<{ content: string }, { content: string }>(`/knowledge-bases/${knowledgeBaseId}/files/${fileId}/content`),
};

export const knowledgeApi = USE_MOCK ? mockKnowledgeApi : realKnowledgeApi;
