import crypto from 'node:crypto';

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }

  return JSON.stringify(value);
};

export interface CrmIdempotencyInput {
  workspace_id: string;
  crm_system: 'hubspot' | 'salesforce';
  object_type: string;
  object_id: string;
  action: string;
  source_event_id: string;
}

export const buildIdempotencyKey = (parts: string[]): string => {
  const value = parts.join(':');
  return crypto.createHash('sha256').update(value).digest('hex');
};

export const buildCrmIdempotencyKey = (input: CrmIdempotencyInput): string => {
  return buildIdempotencyKey([
    input.workspace_id,
    input.crm_system,
    input.object_type,
    input.object_id,
    input.action,
    input.source_event_id
  ]);
};

export const hashPayload = (payload: unknown): string => {
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
};
