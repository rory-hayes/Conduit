const slots = new Map<string, number>();

export const waitForRateLimit = async (workspaceId: string, crm: 'hubspot' | 'salesforce', minIntervalMs = 100): Promise<void> => {
  const key = `${workspaceId}:${crm}`;
  const now = Date.now();
  const nextAvailable = slots.get(key) ?? 0;

  if (nextAvailable > now) {
    await new Promise((resolve) => setTimeout(resolve, nextAvailable - now));
  }

  slots.set(key, Date.now() + minIntervalMs);
};

export const clearRateLimiter = () => {
  slots.clear();
};
