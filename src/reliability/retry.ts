export interface RetryPolicy {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  action: () => Promise<T>,
  policy: RetryPolicy,
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= policy.retries) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt === policy.retries) {
        break;
      }
      const delay = Math.min(policy.baseDelayMs * 2 ** attempt, policy.maxDelayMs);
      await sleep(delay);
    }
    attempt += 1;
  }
  throw lastError instanceof Error ? lastError : new Error("retry failed");
}
