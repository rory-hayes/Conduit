import { describe, expect, it } from 'vitest';
import { buildDealLinkIdempotencyKey } from '../src/idempotency';

describe('deal link idempotency key', () => {
  it('is deterministic for same input', () => {
    const input = {
      workspace_id: 'w1',
      thread_id: 't1',
      deal_id: 'd1',
      source_event_id: 'evt-1'
    };

    expect(buildDealLinkIdempotencyKey(input)).toBe(buildDealLinkIdempotencyKey(input));
  });

  it('changes when thread changes', () => {
    const a = buildDealLinkIdempotencyKey({ workspace_id: 'w1', thread_id: 't1', deal_id: 'd1', source_event_id: 'evt-1' });
    const b = buildDealLinkIdempotencyKey({ workspace_id: 'w1', thread_id: 't2', deal_id: 'd1', source_event_id: 'evt-1' });
    expect(a).not.toBe(b);
  });
});
