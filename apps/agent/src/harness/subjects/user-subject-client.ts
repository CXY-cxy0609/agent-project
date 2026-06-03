const DEFAULT_TIMEOUT_MS = 3000;

export interface UserSubject {
  id: string;
  name: string;
}

type SubjectPayload = {
  id?: string | number;
  name?: string;
};

export class HttpUserSubjectClient {
  constructor(
    private readonly serverUrl: string,
    private readonly internalToken: string,
  ) {}

  async listUserSubjects(userId: string | undefined): Promise<UserSubject[]> {
    const normalizedUserId = userId?.trim();
    if (!normalizedUserId || normalizedUserId === 'anonymous') return [];

    try {
      const res = await fetch(`${this.serverUrl}/api/internal/subjects/my/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': this.internalToken,
        },
        body: JSON.stringify({ userId: normalizedUserId }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      if (!res.ok) return [];
      const payload = await res.json() as unknown;
      return this.unwrapSubjects(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[HttpUserSubjectClient] list user subjects failed: ${msg}`);
      return [];
    }
  }

  private unwrapSubjects(payload: unknown): UserSubject[] {
    const list = this.extractList(payload);
    return list
      .map((item) => ({
        id: String(item.id ?? '').trim(),
        name: String(item.name ?? '').trim(),
      }))
      .filter((item) => item.id && item.name);
  }

  private extractList(payload: unknown): SubjectPayload[] {
    if (Array.isArray(payload)) return payload as SubjectPayload[];
    if (typeof payload !== 'object' || payload === null) return [];
    const data = (payload as { data?: unknown }).data;
    if (typeof data !== 'object' || data === null) return [];
    const list = (data as { list?: unknown }).list;
    return Array.isArray(list) ? list as SubjectPayload[] : [];
  }
}
