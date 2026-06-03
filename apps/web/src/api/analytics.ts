import http from './http';
import type { AnalyticsScope, AnalyticsSummaryStreamEvent, LearningAnalytics } from '@tutor/shared';
import { USE_MOCK } from '@/mock/config';
import { mockAnalyticsApi } from '@/mock/handlers/analytics';

const realAnalyticsApi = {
  getAnalytics: (subjectId: number | null, scope: AnalyticsScope = subjectId ? 'subject' : 'overall') =>
    http.post<LearningAnalytics, LearningAnalytics>('/analytics/overview', { subjectId, scope }),

  generateSummary: (subjectId: number | null, scope: AnalyticsScope = subjectId ? 'subject' : 'overall') =>
    http.post<{ summary: string }, { summary: string }>('/analytics/summary/generate', { subjectId, scope }),

  streamSummary(
    subjectId: number | null,
    scope: AnalyticsScope = subjectId ? 'subject' : 'overall',
    onEvent: (event: AnalyticsSummaryStreamEvent) => void,
    onError: (err: Error) => void,
  ) {
    const ctrl = new AbortController();
    const token = getAccessToken();
    fetch('/api/analytics/summary/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ subjectId, scope }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          throw new Error(`analytics summary stream failed: ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === '[DONE]') continue;
            const event = JSON.parse(payload) as AnalyticsSummaryStreamEvent;
            if (event.type === 'summary.error') {
              throw new Error(event.message);
            }
            onEvent(event);
          }
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        onError(error instanceof Error ? error : new Error('analytics summary stream failed'));
      });
    return () => ctrl.abort();
  },
};

export const analyticsApi = USE_MOCK ? mockAnalyticsApi : realAnalyticsApi;

function getAccessToken(): string {
  const raw = localStorage.getItem('tutor-auth');
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as { token?: { accessToken?: string } };
    return parsed.token?.accessToken ?? '';
  } catch {
    return '';
  }
}
