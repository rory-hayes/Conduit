import { describe, expect, it } from 'vitest';
import { inboundEmailSchema } from '../src/zod';

describe('inboundEmailSchema', () => {
  it('parses valid payload', () => {
    const parsed = inboundEmailSchema.safeParse({
      to: 'acme-7f3k@inbound.conduit.com',
      from: 'jamie@acme.com',
      subject: 'Pricing request',
      text: 'Name: Jamie',
      message_id: '<msg-123@sender>',
      received_at: '2026-01-01T10:17:00Z'
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects invalid payload', () => {
    const parsed = inboundEmailSchema.safeParse({ subject: 'x' });
    expect(parsed.success).toBe(false);
  });
});
