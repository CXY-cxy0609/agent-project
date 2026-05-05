import http from './http';
import type { Subject, UserSubject, CreateSubjectDto, UpdateSubjectDto, SubjectOutline } from '@tutor/shared';
import { USE_MOCK } from '@/mock/config';
import { mockSubjectsApi } from '@/mock/handlers/subjects';

const realSubjectsApi = {
  getMySubjects: () =>
    http.get<UserSubject[], UserSubject[]>('/subjects/my'),

  searchSubjects: (keyword: string) =>
    http.get<Subject[], Subject[]>('/subjects/search', { params: { keyword } }),

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
    http.get<Subject[], Subject[]>('/admin/subjects'),

  adminDeleteSubject: (id: number) =>
    http.delete(`/admin/subjects/${id}`),
};

export const subjectsApi = USE_MOCK ? mockSubjectsApi : realSubjectsApi;
