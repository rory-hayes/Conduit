import { describe, expect, it, vi } from 'vitest';

const query = vi.fn();
vi.mock('../src/db.js', () => ({
  withClient: async (fn: any) => fn({ query })
}));

const { writeAuditEvent } = await import('../src/audit/audit.js');

describe('audit writer', () => {
  it('inserts audit events', async () => {
    await writeAuditEvent({ workspaceId: 'w1', type: 'evt', data: { ok: true }, threadId: 't1', jobId: 'j1' });
    expect(query).toHaveBeenCalled();
  });
});
