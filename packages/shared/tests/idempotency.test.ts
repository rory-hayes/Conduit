import { describe, expect, it } from 'vitest';
import { buildCrmIdempotencyKey, buildIdempotencyKey, hashPayload } from '../src/idempotency';

describe('idempotency helpers', () => {
  it('builds deterministic key from fixed parts', () => {
    const one = buildIdempotencyKey(['a', 'b', 'c']);
    const two = buildIdempotencyKey(['a', 'b', 'c']);
    expect(one).toEqual(two);
  });

  it('builds CRM keys from canonical tuple', () => {
    const key = buildCrmIdempotencyKey({
      workspace_id: 'w1',
      crm_system: 'hubspot',
      object_type: 'thread',
      object_id: 't1',
      action: 'sync',
      source_event_id: 'event1'
    });

    expect(key).toHaveLength(64);
  });

  it('hashes payload with stable key order', () => {
    const a = hashPayload({ b: 2, a: 1 });
    const b = hashPayload({ a: 1, b: 2 });
    expect(a).toEqual(b);
  });
});
