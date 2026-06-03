import http from './http';
import type {
  Assessment,
  AssessmentAnswerAttachment,
  AssessmentGenerationStreamEvent,
  AssessmentGradeResult,
  AssessmentGradeStreamEvent,
  AssessmentListRequest,
  GenerateAssessmentRequest,
  RegenerateAssessmentRequest,
  SubmitAssessmentRequest,
} from '@tutor/shared';

export const assessmentsApi = {
  generate: (data: GenerateAssessmentRequest) =>
    http.post<{ assessmentId: string; questions: Assessment['questions'] }, { assessmentId: string; questions: Assessment['questions'] }>(
      '/assessments/generate',
      data,
    ),

  streamGenerate(
    data: GenerateAssessmentRequest,
    onEvent: (event: AssessmentGenerationStreamEvent) => void,
    onError: (err: Error) => void,
  ) {
    return streamAssessment('/api/assessments/generate/stream', data, onEvent, onError);
  },

  streamRegenerate(
    assessmentId: string,
    onEvent: (event: AssessmentGenerationStreamEvent) => void,
    onError: (err: Error) => void,
  ) {
    const data: RegenerateAssessmentRequest = { assessmentId };
    return streamAssessment('/api/assessments/regenerate/stream', data, onEvent, onError);
  },

  submit: (data: SubmitAssessmentRequest) =>
    http.post<{ submitted: boolean }, { submitted: boolean }>('/assessments/submit', data),

  grade: (assessmentId: string) =>
    http.post<AssessmentGradeResult, AssessmentGradeResult>('/assessments/grade', { assessmentId }),

  streamGrade(
    assessmentId: string,
    onEvent: (event: AssessmentGradeStreamEvent) => void,
    onError: (err: Error) => void,
  ) {
    return streamAssessment('/api/assessments/grade/stream', { assessmentId }, onEvent, onError);
  },

  detail: (assessmentId: string) =>
    http.post<Assessment, Assessment>('/assessments/detail', { assessmentId, id: assessmentId }),

  list: (data: AssessmentListRequest) =>
    http.post<{ list: Assessment[]; page: number; pageSize: number }, { list: Assessment[]; page: number; pageSize: number }>(
      '/assessments/list',
      data,
    ),

  uploadAnswerAttachment: (data: { assessmentId: string; questionId: string; file: File }) => {
    const form = new FormData();
    form.append('assessmentId', data.assessmentId);
    form.append('questionId', data.questionId);
    form.append('file', data.file);
    return http.post<{ attachment: AssessmentAnswerAttachment }, { attachment: AssessmentAnswerAttachment }>(
      '/assessments/answers/attachments/upload',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },
};

function streamAssessment<TEvent extends AssessmentGenerationStreamEvent | AssessmentGradeStreamEvent>(
  url: string,
  data: GenerateAssessmentRequest | RegenerateAssessmentRequest,
  onEvent: (event: TEvent) => void,
  onError: (err: Error) => void,
) {
  const ctrl = new AbortController();
  const token = getAccessToken();
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
    signal: ctrl.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) throw new Error(`assessment stream failed: ${res.status}`);
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
          const event = JSON.parse(payload) as TEvent;
          if (event.type === 'assessment.error' || event.type === 'assessment.grade.error') {
            throw new Error(event.message);
          }
          onEvent(event);
        }
      }
    })
    .catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      onError(error instanceof Error ? error : new Error('assessment stream failed'));
    });
  return () => ctrl.abort();
}

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
