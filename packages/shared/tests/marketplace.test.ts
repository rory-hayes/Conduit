import { describe, expect, it, vi } from 'vitest';
import { computeRetrySchedule, isInstallClaimable, isPermanentFailure } from '../src/marketplace';

describe('marketplace helpers', () => {
  it('validates claimability for pending non-expired installs', () => {
    expect(isInstallClaimable({ status: 'pending', expires_at: '2099-01-01T00:00:00.000Z' }, new Date('2026-01-01T00:00:00.000Z'))).toBe(true);
    expect(isInstallClaimable({ status: 'claimed', expires_at: '2099-01-01T00:00:00.000Z' }, new Date('2026-01-01T00:00:00.000Z'))).toBe(false);
    expect(isInstallClaimable({ status: 'pending', expires_at: '2020-01-01T00:00:00.000Z' }, new Date('2026-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('computes bounded exponential schedule with deterministic jitter in test', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = computeRetrySchedule(2, new Date('2026-01-01T00:00:00.000Z'), 1000, 32000, 0.1);
    expect(result.retryCount).toBe(3);
    expect(result.delayMs).toBeGreaterThanOrEqual(1000);
    expect(result.delayMs).toBeLessThanOrEqual(32000);
    expect(result.nextRetryAt).toContain('2026-01-01T00:00:');
  });

  it('marks permanent failure at threshold', () => {
    expect(isPermanentFailure(7, 8)).toBe(false);
    expect(isPermanentFailure(8, 8)).toBe(true);
  });
});
