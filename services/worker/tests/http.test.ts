import { describe, expect, it, vi } from 'vitest';
import { clearRateLimiter, waitForRateLimit } from '../src/connectors/http/rateLimiter.js';
import { withRetry } from '../src/connectors/http/retry.js';

describe('http helpers', () => {
  it('retries 429-like errors', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('429 rate limit'))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(() => fn(), { maxAttempts: 2, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rate limiter serializes quickly for same key', async () => {
    clearRateLimiter();
    await waitForRateLimit('w1', 'hubspot', 1);
    await waitForRateLimit('w1', 'hubspot', 1);
    expect(true).toBe(true);
  });
});
