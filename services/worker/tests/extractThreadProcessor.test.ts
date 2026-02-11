import { beforeEach, describe, expect, it, vi } from 'vitest';

const queries: Array<{ sql: string; params: unknown[] }> = [];
let messageText = 'Name: J\nEmail: j@x.com\nCompany: ACME';
let messageSubject = 'Pricing update';
let historyQuality: number | undefined;
const enqueueCalls: any[] = [];
const audits: any[] = [];

vi.mock('../src/db.js', () => ({
  withClient: async (fn: any) =>
    fn({
      query: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (sql.includes('FROM messages')) {
          return {
            rows: [
              { thread_id: 't1', workspace_id: 'w1', text: messageText, from_email: 'rep@example.com', subject: messageSubject }
            ]
          };
        }
        if (sql.includes('FROM policies')) {
          return { rows: [{ policy: { pause_on_drift: true, drift_thresholds: { historical_min: 0.85, current_max: 0.6 } } }] };
        }
        if (sql.includes('FROM extraction_quality_history')) {
          return { rows: historyQuality === undefined ? [] : [{ last_good_quality: historyQuality }] };
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
    messageText = 'Name: J\nEmail: j@x.com\nCompany: ACME';
    messageSubject = 'Pricing update';
    enqueueCalls.length = 0;
    audits.length = 0;
    historyQuality = undefined;
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

    expect(enqueueCalls).toHaveLength(3);
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

  it('triggers drift pause flow and does not enqueue crm sync', async () => {
    historyQuality = 0.9;
    messageText = 'Name: J';

    await extractThread({
      clientId: 'c',
      job: {
        id: 'j4',
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

    expect(queries.some((q) => q.sql.includes('INSERT INTO drift_alerts'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('INSERT INTO write_pause'))).toBe(true);
    expect(queries.some((q) => q.sql.includes("'drift_pause_review'"))).toBe(true);
    expect(enqueueCalls.some((call) => call[1] === 'sync_hubspot')).toBe(false);
    expect(enqueueCalls.some((call) => call[1] === 'sync_salesforce')).toBe(false);
    expect(audits.some((a) => a.type === 'crm_writes_paused')).toBe(true);
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
