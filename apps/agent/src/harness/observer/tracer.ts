/**
 * 轻量链路追踪 — 结构化日志 + Span 模型
 * 接口兼容 OpenTelemetry 语义，可在需要时替换为 OTel SDK
 */

export interface SpanOptions {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export interface Span {
  end(options: SpanOptions): void;
}

export interface Observer {
  startSpan(name: string, traceId: string): Span;
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  traceId: string;
  agentName: string;
  nodeName: string;
  message: string;
  data?: Record<string, unknown>;
  latencyMs?: number;
}

export class ConsoleObserver implements Observer {
  private currentTraceId = '';
  private currentAgentName = '';

  startSpan(name: string, traceId: string): Span {
    this.currentTraceId = traceId;
    this.currentAgentName = name;
    const startTime = Date.now();

    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      traceId,
      agentName: name,
      nodeName: 'start',
      message: `[${name}] span started`,
    });

    return {
      end: (options: SpanOptions) => {
        const latencyMs = Date.now() - startTime;
        this.writeLog({
          timestamp: new Date().toISOString(),
          level: options.success ? 'info' : 'error',
          traceId,
          agentName: name,
          nodeName: 'end',
          message: options.success
            ? `[${name}] span completed`
            : `[${name}] span failed: ${options.error}`,
          data: options.data,
          latencyMs,
        });
      },
    };
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level,
      traceId: this.currentTraceId,
      agentName: this.currentAgentName,
      nodeName: '-',
      message,
      data,
    });
  }

  private writeLog(log: StructuredLog): void {
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(log));
    } else {
      const emoji = { debug: '🔍', info: '📌', warn: '⚠️', error: '❌' }[log.level];
      const parts = [`${emoji} [${log.level.toUpperCase()}]`, `[${log.agentName}]`, log.message];
      if (log.latencyMs !== undefined) parts.push(`(${log.latencyMs}ms)`);
      console.log(parts.join(' '));
      if (log.data) console.log('  data:', JSON.stringify(log.data));
    }
  }
}

export const defaultObserver: Observer = new ConsoleObserver();
