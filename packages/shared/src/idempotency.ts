import crypto from 'node:crypto';

export const buildIdempotencyKey = (parts: string[]): string => {
  const value = parts.join(':');
  return crypto.createHash('sha256').update(value).digest('hex');
};

export const hashPayload = (payload: unknown): string => {
  const serialized = JSON.stringify(payload);
  return crypto.createHash('sha256').update(serialized).digest('hex');
};
