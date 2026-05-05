import type { LearningAnalytics } from '@tutor/shared';
import { MOCK_ANALYTICS } from '../data';

const delay = (ms = 400) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const _analytics: Record<number, LearningAnalytics> = JSON.parse(JSON.stringify(MOCK_ANALYTICS));

export const mockAnalyticsApi = {
  async getAnalytics(subjectId: number): Promise<LearningAnalytics> {
    await delay();
    const data = _analytics[subjectId];
    if (!data) {
      return {
        userId: 'mock-user-001',
        subjectId: Number(subjectId),
        subjectName: '未知学科',
        weakPoints: [],
        wordCloud: [],
        updatedAt: new Date().toISOString(),
      };
    }
    return { ...data };
  },

  async generateSummary(subjectId: number): Promise<{ summary: string }> {
    await delay(1200);
    const summary =
      _analytics[subjectId]?.summary ??
      '（Mock 模式）根据您的学习记录，建议重点复习薄弱知识点，结合真题进行针对性训练。';
    if (_analytics[subjectId]) {
      _analytics[subjectId].summary = summary;
      _analytics[subjectId].summaryGeneratedAt = new Date().toISOString();
    }
    return { summary };
  },
};
