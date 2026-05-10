export interface ReasoningLoopRunArgs {
  attempt: number;
  feedback?: string;
}

export interface ReasoningLoopAttempt<T> {
  attempt: number;
  output?: T;
  verificationErrors: string[];
  error?: string;
}

export interface ReasoningLoopOptions<T> {
  maxAttempts?: number;
  run: (args: ReasoningLoopRunArgs) => Promise<T>;
  verify?: (output: T) => Promise<string[]> | string[];
}

export interface ReasoningLoopResult<T> {
  success: boolean;
  result?: T;
  attempts: ReasoningLoopAttempt<T>[];
  failureReason?: string;
}

export async function runReasoningLoop<T>(
  options: ReasoningLoopOptions<T>,
): Promise<ReasoningLoopResult<T>> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const attempts: ReasoningLoopAttempt<T>[] = [];
  let feedback: string | undefined;

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const output = await options.run({ attempt: i, feedback });
      const verificationErrors = options.verify ? await options.verify(output) : [];
      const attempt: ReasoningLoopAttempt<T> = { attempt: i, output, verificationErrors };
      attempts.push(attempt);

      if (verificationErrors.length === 0) {
        return { success: true, result: output, attempts };
      }

      feedback = `校验失败：${verificationErrors.join('；')}`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({
        attempt: i,
        verificationErrors: [],
        error: message,
      });
      feedback = `执行失败：${message}`;
    }
  }

  const last = attempts[attempts.length - 1];
  const failureReason =
    last?.verificationErrors.length
      ? `达到最大尝试次数，仍未通过校验：${last.verificationErrors.join('；')}`
      : `达到最大尝试次数，最后一次错误：${last?.error ?? '未知错误'}`;

  return {
    success: false,
    attempts,
    failureReason,
  };
}
