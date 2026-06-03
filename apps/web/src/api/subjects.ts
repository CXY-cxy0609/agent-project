import http from './http';
import type { Subject, UserSubject, CreateSubjectDto, UpdateSubjectDto, SubjectOutline } from '@tutor/shared';
import { USE_MOCK } from '@/mock/config';
import { mockSubjectsApi } from '@/mock/handlers/subjects';

interface ServerSubject {
  id?: string | number;
  subject_id?: string | number;
  name?: string;
  education_stage?: string;
  parentId?: number | null;
  parent_id?: number | null;
  level?: number;
  description?: string;
  outline?: SubjectOutline;
  createdAt?: string;
  updatedAt?: string;
}

function toNumber(value: unknown, fallback = 0): number {
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : fallback;
}

function normalizeSubject(item: ServerSubject, index: number): UserSubject {
  const id = toNumber(item.id ?? item.subject_id, index + 1);
  const now = item.createdAt ?? new Date().toISOString();
  const parentId = item.parentId ?? item.parent_id ?? null;
  const level = item.level === 2 || parentId ? 2 : 1;
  return {
    id,
    name: item.name ?? `未命名学科 ${id}`,
    parentId,
    level,
    description: item.description ?? item.education_stage ?? '',
    outline: item.outline ?? { modules: [] },
    createdAt: now,
    updatedAt: item.updatedAt ?? now,
    isOwner: true,
  };
}

const realSubjectsApi = {
  getMySubjects: () =>
    http
      .post<{ list?: ServerSubject[] }, { list?: ServerSubject[] }>('/subjects/list', {})
      .then((payload) => (payload.list ?? []).map(normalizeSubject)),

  searchSubjects: (keyword: string) =>
    http
      .post<{ list?: ServerSubject[] }, { list?: ServerSubject[] }>('/subjects/search', { keyword })
      .then((payload) => (payload.list ?? []).map((item, idx) => normalizeSubject(item, idx))),

  createSubject: (data: CreateSubjectDto) =>
    http.post<Subject, Subject>('/subjects', data),

  updateSubject: (id: number, data: UpdateSubjectDto) =>
    http.post<Subject, Subject>('/subjects/update', { id, ...data }),

  deleteSubject: (id: number) =>
    http.post('/subjects/delete', { id }),

  addMySubject: (subjectId: number) =>
    http.post('/subjects/my', { subjectId }),

  removeMySubject: (subjectId: number) =>
    http.post('/subjects/my/remove', { id: subjectId }),

  getOutline: (id: number) =>
    http.post<SubjectOutline, SubjectOutline>('/subjects/outline/get', { id }),

  updateOutline: (id: number, outline: SubjectOutline) =>
    http.post('/subjects/outline/update', { id, outline }),

  adminGetAll: () =>
    http
      .post<{ list?: ServerSubject[] }, { list?: ServerSubject[] }>('/admin/subjects/list', {})
      .then((payload) => (payload.list ?? []).map((item, idx) => normalizeSubject(item, idx))),

  adminDeleteSubject: (id: number) =>
    http.post('/admin/subjects/delete', { id }),
};

export const subjectsApi = USE_MOCK ? mockSubjectsApi : realSubjectsApi;
