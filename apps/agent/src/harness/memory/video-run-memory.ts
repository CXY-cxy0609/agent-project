const DEFAULT_TIMEOUT_MS = 3000;

export interface VideoRunPersistenceInput {
  run_id: string;
  workflow_id: string;
  trace_id: string;
  session_id: string;
  user_id: string;
  subject?: string;
  status: 'running' | 'completed' | 'failed';
  intent_json?: Record<string, unknown>;
  artifact_bundle_url?: string;
  manifest_url?: string;
  video_url?: string;
  error_summary?: string;
}

export class HttpVideoRunMemory {
  constructor(
    private readonly serverUrl: string,
    private readonly internalToken: string,
  ) {}

  async write(record: VideoRunPersistenceInput): Promise<void> {
    try {
      await fetch(`${this.serverUrl}/api/video-runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': this.internalToken,
        },
        body: JSON.stringify(record),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch {
      // 写入失败不影响主链路
    }
  }
}

