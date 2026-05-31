import http from './http';
import type { KnowledgeBase, KnowledgeFile, CreateKnowledgeBaseDto, UpdateKnowledgeBaseDto, KnowledgeBaseQuery } from '@tutor/shared';
import { USE_MOCK } from '@/mock/config';
import { mockKnowledgeApi } from '@/mock/handlers/knowledge';

const realKnowledgeApi = {
  getKnowledgeBases: (params?: KnowledgeBaseQuery) =>
    http
      .post<{ list?: KnowledgeBase[] }, { list?: KnowledgeBase[] }>('/knowledge-bases/list', params ?? {})
      .then((payload) => payload.list ?? []),

  getKnowledgeBase: (id: string) =>
    http
      .post<{ knowledgeBase?: KnowledgeBase } & Partial<KnowledgeBase>, { knowledgeBase?: KnowledgeBase } & Partial<KnowledgeBase>>('/knowledge-bases/detail', { id })
      .then((payload) => payload.knowledgeBase ?? (payload as KnowledgeBase)),

  createKnowledgeBase: (data: CreateKnowledgeBaseDto) =>
    http
      .post<{ knowledgeBase?: KnowledgeBase } & Partial<KnowledgeBase>, { knowledgeBase?: KnowledgeBase } & Partial<KnowledgeBase>>('/knowledge-bases', data)
      .then((payload) => payload.knowledgeBase ?? (payload as KnowledgeBase)),

  updateKnowledgeBase: (id: string, data: UpdateKnowledgeBaseDto) =>
    http
      .post<{ knowledgeBase?: KnowledgeBase } & Partial<KnowledgeBase>, { knowledgeBase?: KnowledgeBase } & Partial<KnowledgeBase>>('/knowledge-bases/update', { id, ...data })
      .then((payload) => payload.knowledgeBase ?? (payload as KnowledgeBase)),

  deleteKnowledgeBase: (id: string) =>
    http.post('/knowledge-bases/delete', { id }),

  uploadFile: (knowledgeBaseId: string, file: File) => {
    const form = new FormData();
    form.append('knowledgeBaseId', knowledgeBaseId);
    form.append('file', file);
    return http
      .post<{ file?: KnowledgeFile } & Partial<KnowledgeFile>, { file?: KnowledgeFile } & Partial<KnowledgeFile>>('/knowledge-bases/files/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((payload) => payload.file ?? (payload as KnowledgeFile));
  },

  updateFile: (knowledgeBaseId: string, fileId: string, data: { displayName?: string; content?: string; order?: number }) =>
    http
      .post<{ file?: KnowledgeFile } & Partial<KnowledgeFile>, { file?: KnowledgeFile } & Partial<KnowledgeFile>>('/knowledge-bases/files/update', {
        knowledgeBaseId,
        fileId,
        ...data,
      })
      .then((payload) => payload.file ?? (payload as KnowledgeFile)),

  deleteFile: (knowledgeBaseId: string, fileId: string) =>
    http.post('/knowledge-bases/files/delete', { knowledgeBaseId, fileId }),

  reorderFiles: (knowledgeBaseId: string, fileIds: string[]) =>
    http.post('/knowledge-bases/files/reorder', { knowledgeBaseId, fileIds }),

  getFileContent: (knowledgeBaseId: string, fileId: string) =>
    http.post<{ content: string }, { content: string }>('/knowledge-bases/files/content', { knowledgeBaseId, fileId }),
};

export const knowledgeApi = USE_MOCK ? mockKnowledgeApi : realKnowledgeApi;
