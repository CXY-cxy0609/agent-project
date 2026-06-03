/**
 * DB 记忆 — 学情记录持久化，通过 HTTP 调用后端服务
 */

import type { StructuredMemory, LearningRecord, MemoryFilter } from '../core/types.js';

const DEFAULT_TIMEOUT_MS = 3000;

type LearningRecordPayload = Partial<LearningRecord> & {
  user_id?: string;
  session_id?: string;
  knowledge_point?: string;
  asked_at?: string;
};

export class HttpStructuredMemory implements StructuredMemory {
  constructor(
    private readonly serverUrl: string,
    private readonly internalToken: string,
  ) {}

  async write(record: LearningRecord): Promise<void> {
    try {
      const subjectId = this.normalizeSubjectId(record.subjectId);
      const res = await fetch(`${this.serverUrl}/api/learning-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': this.internalToken,
        },
        body: JSON.stringify({
          userId: record.userId,
          sessionId: record.sessionId,
          ...(subjectId !== undefined ? { subjectId } : {}),
          subjectNameSnapshot: record.subject,
          knowledgePoint: record.knowledgePoint,
          chapter: record.chapter,
          difficulty: record.difficulty ?? 'medium',
          sourceType: 'qa',
          eventType: 'qa_extracted',
          metadata: {
            legacySubject: record.subject,
          },
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      if (!res.ok) {
        const body = await this.readResponseText(res);
        throw new Error(`HTTP ${res.status}: ${body || res.statusText}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[HttpStructuredMemory] write learning record failed: ${msg}`);
      throw err;
    }
  }

  private normalizeSubjectId(subjectId: string | undefined): number | undefined {
    const parsed = Number(subjectId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  async query(userId: string, filters: MemoryFilter): Promise<LearningRecord[]> {
    try {
      const params = new URLSearchParams({ user_id: userId });
      if (filters.subject) params.set('subject', filters.subject);
      if (filters.chapter) params.set('chapter', filters.chapter);
      if (filters.limit) params.set('limit', String(filters.limit));

      const res = await fetch(
        `${this.serverUrl}/api/learning-records?${params.toString()}`,
        {
          headers: { 'x-internal-token': this.internalToken },
          signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        },
      );

      if (!res.ok) return [];
      const payload = (await res.json()) as unknown;
      const list = this.unwrapLearningRecords(payload);
      return list.map((record) => this.normalizeLearningRecord(record));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[HttpStructuredMemory] query learning records failed: ${msg}`);
      return [];
    }
  }

  private unwrapLearningRecords(payload: unknown): LearningRecordPayload[] {
    if (Array.isArray(payload)) {
      return payload as LearningRecordPayload[];
    }
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'data' in payload &&
      typeof (payload as { data?: unknown }).data === 'object' &&
      (payload as { data: { list?: unknown } }).data !== null &&
      Array.isArray((payload as { data: { list?: unknown } }).data.list)
    ) {
      return (payload as { data: { list: LearningRecordPayload[] } }).data.list;
    }
    return [];
  }

  private normalizeLearningRecord(record: LearningRecordPayload): LearningRecord {
    const askedAt = record.askedAt ?? record.asked_at;
    return {
      userId: String(record.userId ?? record.user_id ?? ''),
      sessionId: String(record.sessionId ?? record.session_id ?? ''),
      subject: String(record.subject ?? ''),
      chapter: record.chapter,
      knowledgePoint: String(record.knowledgePoint ?? record.knowledge_point ?? ''),
      difficulty: record.difficulty,
      askedAt: askedAt ? new Date(askedAt) : undefined,
    };
  }

  private async readResponseText(res: Response): Promise<string> {
    try {
      return await res.text();
    } catch {
      return '';
    }
  }
}
