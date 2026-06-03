import type { AnalyticsSummaryStreamEvent, LearningAnalytics } from '@tutor/shared';
import { MOCK_ANALYTICS } from '../data';

const delay = (ms = 400) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const _analytics: Record<number, LearningAnalytics> = JSON.parse(JSON.stringify(MOCK_ANALYTICS));

export const mockAnalyticsApi = {
  async getAnalytics(subjectId: number | null): Promise<LearningAnalytics> {
    await delay();
    const data = subjectId ? _analytics[subjectId] : undefined;
    if (!data) {
      return {
        userId: 'mock-user-001',
        scope: subjectId ? 'subject' : 'overall',
        subjectId,
        subjectName: subjectId ? '未知学科' : null,
        weakPoints: [],
        wordCloud: [],
        updatedAt: new Date().toISOString(),
      };
    }
    return { ...data };
  },

  async generateSummary(subjectId: number | null): Promise<{ summary: string }> {
    await delay(1200);
    const summary =
      (subjectId ? _analytics[subjectId]?.summary : undefined) ??
      '（Mock 模式）根据您的学习记录，建议重点复习薄弱知识点，结合真题进行针对性训练。';
    if (subjectId && _analytics[subjectId]) {
      _analytics[subjectId].summary = summary;
      _analytics[subjectId].summaryGeneratedAt = new Date().toISOString();
    }
    return { summary };
  },

  streamSummary(
    subjectId: number | null,
    _scope: 'overall' | 'subject',
    onEvent: (event: AnalyticsSummaryStreamEvent) => void,
    onError: (err: Error) => void,
  ) {
    const streamId = `mock-summary-stream-${Date.now()}`;
    const summaryId = `mock-summary-${Date.now()}`;
    let sequence = 0;
    let cancelled = false;
    const emit = (event: Record<string, unknown>) => {
      if (cancelled) return;
      onEvent({ ...event, streamId, sequence: ++sequence } as AnalyticsSummaryStreamEvent);
    };
    const text =
      _analytics[subjectId ?? 101]?.summary ??
      '## 整体诊断\n当前学习记录仍在积累中，建议先完成一次专项测试以提升诊断可信度。\n\n## 下一步行动\n- 继续进行问答学习\n- 生成一次薄弱点测试';
    const timer = window.setTimeout(async () => {
      try {
        emit({ type: 'summary.start', summaryId, startedAt: new Date().toISOString() });
        emit({ type: 'summary.stage', summaryId, stage: 'generating', message: '正在生成学情总结...' });
        for (const chunk of text.match(/.{1,12}/g) ?? [text]) {
          await delay(80);
          emit({ type: 'summary.delta', summaryId, delta: chunk });
        }
        const summary = {
          summary: text,
          highlights: ['学习记录已纳入分析'],
          weakPointAnalysis: ['建议继续补充测评数据，提高薄弱点识别准确度'],
          recommendedActions: [{ type: 'assessment' as const, title: '生成专项测试', reason: '通过测评校准掌握度' }],
          riskLevel: 'medium' as const,
          generatedAt: new Date().toISOString(),
        };
        emit({ type: 'summary.saved', summaryId, summary });
        emit({ type: 'summary.done', summaryId });
      } catch (err) {
        onError(err instanceof Error ? err : new Error('mock summary stream failed'));
      }
    }, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  },
};
