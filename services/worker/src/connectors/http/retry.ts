export interface RetryOptions {
  maxAttempts?: number;
  shouldRetry?: (error: unknown) => boolean;
  baseDelayMs?: number;
}

export const defaultShouldRetry = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return /429|5\d\d|rate.?limit|timeout/i.test(error.message);
};

export const withRetry = async <T>(fn: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> => {
  const maxAttempts = options.maxAttempts ?? 3;
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;
  const baseDelayMs = options.baseDelayMs ?? 150;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Retry attempts exhausted');
};
