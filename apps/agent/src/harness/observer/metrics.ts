/**
 * 指标采集 — 内存计数器，可替换为 Prometheus/OpenTelemetry 指标 SDK
 */

export interface MetricLabels {
  agentName?: string;
  model?: string;
  subject?: string;
}

export interface MetricSnapshot {
  name: string;
  value: number;
  labels: MetricLabels;
  timestamp: number;
}

class MetricsRegistry {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  increment(name: string, value = 1, _labels: MetricLabels = {}): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + value);
  }

  record(name: string, value: number, _labels: MetricLabels = {}): void {
    const existing = this.histograms.get(name) ?? [];
    existing.push(value);
    this.histograms.set(name, existing);
  }

  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  getP99(name: string): number {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.99);
    return sorted[idx];
  }

  snapshot(): MetricSnapshot[] {
    const result: MetricSnapshot[] = [];
    const now = Date.now();

    for (const [name, value] of this.counters) {
      result.push({ name, value, labels: {}, timestamp: now });
    }

    for (const [name, values] of this.histograms) {
      if (values.length === 0) continue;
      const sum = values.reduce((a, b) => a + b, 0);
      result.push({ name: `${name}.avg`, value: sum / values.length, labels: {}, timestamp: now });
      result.push({ name: `${name}.p99`, value: this.getP99(name), labels: {}, timestamp: now });
    }

    return result;
  }
}

export const metrics = new MetricsRegistry();

// 预定义指标名常量，避免拼写错误
export const METRIC = {
  AGENT_LATENCY: 'agent.latency_ms',
  LLM_TOKENS: 'llm.token_usage',
  LLM_ERRORS: 'llm.error_count',
  RAG_LATENCY: 'rag.latency_ms',
  VIDEO_RENDER_SUCCESS: 'video.render_success',
  VIDEO_RENDER_FAILURE: 'video.render_failure',
  OUTPUT_PARSE_FAILURE: 'output.parse_failure',
} as const;
