export type InstallStatus = 'pending' | 'claimed' | 'expired';

export interface PendingInstallRecord {
  status: InstallStatus;
  expires_at: string;
}

export const isInstallClaimable = (install: PendingInstallRecord, now = new Date()): boolean => {
  if (install.status !== 'pending') return false;
  return new Date(install.expires_at).getTime() > now.getTime();
};

export const computeRetrySchedule = (
  retryCount: number,
  now = new Date(),
  baseDelayMs = 60_000,
  maxDelayMs = 24 * 60 * 60 * 1000,
  jitterRatio = 0.2
) => {
  const nextRetryCount = retryCount + 1;
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(retryCount, 0));
  const jitterRange = Math.floor(exponential * jitterRatio);
  const jitter = jitterRange > 0 ? Math.floor((Math.random() * (jitterRange * 2 + 1)) - jitterRange) : 0;
  const delay = Math.max(baseDelayMs, exponential + jitter);

  return {
    retryCount: nextRetryCount,
    nextRetryAt: new Date(now.getTime() + delay).toISOString(),
    delayMs: delay
  };
};

export const isPermanentFailure = (retryCount: number, maxRetries = 8): boolean => retryCount >= maxRetries;
