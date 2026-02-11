import { beforeEach, describe, expect, it, vi } from 'vitest';

const queries: Array<{ sql: string; params: unknown[] }> = [];
let messageText = 'Name: J\nEmail: j@x.com';
const enqueueCalls: any[] = [];
const audits: any[] = [];

vi.mock('../src/db.js', () => ({
  withClient: async (fn: any) =>
    fn({
      query: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (sql.includes('FROM messages')) {
          return { rows: [{ thread_id: 't1', workspace_id: 'w1', text: messageText }] };
        }
        if (sql.includes('RETURNING id')) {
          return { rows: [{ id: 'er1' }] };
        }
        return { rows: [] };
      }
    })
}));

vi.mock('../src/jobs/queue.js', () => ({
  enqueueJob: async (...args: unknown[]) => {
    enqueueCalls.push(args);
    return 'job';
  }
}));

vi.mock('../src/audit/audit.js', () => ({
  writeAuditEvent: async (input: unknown) => audits.push(input)
}));

const { extractThread } = await import('../src/jobs/processors/extractThread.js');

describe('extractThread processor', () => {
  beforeEach(() => {
    queries.length = 0;
    messageText = 'Name: J\nEmail: j@x.com';
    enqueueCalls.length = 0;
    audits.length = 0;
  });

  it('enqueues sync jobs for high confidence', async () => {
    await extractThread({
      clientId: 'c',
      job: {
        id: 'j1',
        workspaceId: 'w1',
        type: 'extract_thread',
        status: 'running',
        payload: { thread_id: 't1' },
        attempts: 1,
        lockedAt: null,
        createdAt: '',
        updatedAt: ''
      }
    });

    expect(enqueueCalls).toHaveLength(2);
    expect(audits[audits.length - 1].type).toBe('policy.sync_enqueued');
  });



  it('creates review item when email missing', async () => {
    messageText = 'Name: J';
    await extractThread({
      clientId: 'c',
      job: {
        id: 'j3',
        workspaceId: 'w1',
        type: 'extract_thread',
        status: 'running',
        payload: { thread_id: 't1' },
        attempts: 1,
        lockedAt: null,
        createdAt: '',
        updatedAt: ''
      }
    });

    expect(queries.some((q) => q.sql.includes('INSERT INTO review_items'))).toBe(true);
  });

  it('throws when thread id payload missing', async () => {
    await expect(
      extractThread({
        clientId: 'c',
        job: {
          id: 'j2',
          workspaceId: 'w1',
          type: 'extract_thread',
          status: 'running',
          payload: {},
          attempts: 1,
          lockedAt: null,
          createdAt: '',
          updatedAt: ''
        }
      })
    ).rejects.toThrow('missing thread_id payload');
  });
});
