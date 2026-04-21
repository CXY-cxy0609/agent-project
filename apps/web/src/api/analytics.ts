import http from './http';
import type { LearningAnalytics } from '@kaoyan/shared';
import { USE_MOCK } from '@/mock/config';
import { mockAnalyticsApi } from '@/mock/handlers/analytics';

const realAnalyticsApi = {
  getAnalytics: (subjectId: string) =>
    http.get<LearningAnalytics, LearningAnalytics>(`/analytics/${subjectId}`),

  generateSummary: (subjectId: string) =>
    http.post<{ summary: string }, { summary: string }>(`/analytics/${subjectId}/summary`),
};

export const analyticsApi = USE_MOCK ? mockAnalyticsApi : realAnalyticsApi;
