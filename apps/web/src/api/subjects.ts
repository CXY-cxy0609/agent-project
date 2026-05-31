import http from './http';
import type { Subject, UserSubject, CreateSubjectDto, UpdateSubjectDto, SubjectOutline } from '@tutor/shared';
import { USE_MOCK } from '@/mock/config';
import { mockSubjectsApi } from '@/mock/handlers/subjects';

interface ServerSubject {
  id?: string | number;
  subject_id?: string | number;
  name?: string;
  code?: string | number;
  education_stage?: string;
}

function toNumber(value: unknown, fallback = 0): number {
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : fallback;
}

function normalizeSubject(item: ServerSubject, index: number): UserSubject {
  const id = toNumber(item.id ?? item.subject_id, index + 1);
  const now = new Date().toISOString();
  return {
    id,
    name: item.name ?? `未命名学科 ${id}`,
    code: toNumber(item.code, id),
    parentId: null,
    level: 1,
    description: item.education_stage ?? '',
    outline: { modules: [] },
    createdAt: now,
    updatedAt: now,
    isOwner: true,
  };
}

const realSubjectsApi = {
  getMySubjects: () =>
    http
      .get<{ list?: ServerSubject[] }, { list?: ServerSubject[] }>('/subjects')
      .then((payload) => (payload.list ?? []).map(normalizeSubject)),

  searchSubjects: (keyword: string) =>
    http
      .get<{ list?: ServerSubject[] }, { list?: ServerSubject[] }>('/subjects/search', { params: { keyword } })
      .then((payload) => (payload.list ?? []).map((item, idx) => normalizeSubject(item, idx))),

  createSubject: (data: CreateSubjectDto) =>
    http.post<Subject, Subject>('/subjects', data),

  updateSubject: (id: number, data: UpdateSubjectDto) =>
    http.put<Subject, Subject>(`/subjects/${id}`, data),

  deleteSubject: (id: number) =>
    http.delete(`/subjects/${id}`),

  addMySubject: (subjectId: number) =>
    http.post('/subjects/my', { subjectId }),

  removeMySubject: (subjectId: number) =>
    http.delete(`/subjects/my/${subjectId}`),

  getOutline: (id: number) =>
    http.get<SubjectOutline, SubjectOutline>(`/subjects/${id}/outline`),

  updateOutline: (id: number, outline: SubjectOutline) =>
    http.put(`/subjects/${id}/outline`, { outline }),

  adminGetAll: () =>
    http
      .get<{ list?: ServerSubject[] }, { list?: ServerSubject[] }>('/admin/subjects')
      .then((payload) => (payload.list ?? []).map((item, idx) => normalizeSubject(item, idx))),

  adminDeleteSubject: (id: number) =>
    http.delete(`/admin/subjects/${id}`),
};

export const subjectsApi = USE_MOCK ? mockSubjectsApi : realSubjectsApi;
