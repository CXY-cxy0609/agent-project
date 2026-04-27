/**
 * 通用重试工具
 */

export interface RetryOptions {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential';
  initialDelayMs: number;
  retryOn: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  backoff: 'exponential',
  initialDelayMs: 1000,
  retryOn: () => true,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === opts.maxAttempts || !opts.retryOn(lastError)) {
        throw lastError;
      }

      const delay =
        opts.backoff === 'exponential'
          ? opts.initialDelayMs * 2 ** (attempt - 1)
          : opts.initialDelayMs;

      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 判断 LLM API 错误是否值得重试 */
export function isRetryableLLMError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('overloaded') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('timeout')
  );
}
