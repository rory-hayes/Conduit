import { beforeEach, describe, expect, it, vi } from 'vitest';

const inserted: any[] = [];
const audits: any[] = [];

vi.mock('../src/db.js', () => ({
  withClient: async (fn: any) =>
    fn({
      query: async (sql: string, params: unknown[]) => {
        inserted.push({ sql, params });
        return { rows: [] };
      }
    })
}));

vi.mock('../src/audit/audit.js', () => ({
  writeAuditEvent: async (input: unknown) => {
    audits.push(input);
  }
}));

const { syncHubSpot } = await import('../src/jobs/processors/syncHubSpot.js');
const { syncSalesforce } = await import('../src/jobs/processors/syncSalesforce.js');

describe('sync processors dry run', () => {
  beforeEach(() => {
    inserted.length = 0;
    audits.length = 0;
  });

  it('writes hubspot crm log and audits', async () => {
    await syncHubSpot({
      clientId: 'x',
      job: {
        id: 'job1',
        workspaceId: 'w1',
        type: 'sync_hubspot',
        status: 'running',
        payload: { thread_id: 't1', schema_version: 'v1' },
        attempts: 1,
        lockedAt: null,
        createdAt: '',
        updatedAt: ''
      }
    });

    expect(inserted[0].sql).toContain('INSERT INTO crm_write_log');
    expect(audits).toHaveLength(2);
  });

  it('writes salesforce crm log and audits', async () => {
    await syncSalesforce({
      clientId: 'x',
      job: {
        id: 'job2',
        workspaceId: 'w1',
        type: 'sync_salesforce',
        status: 'running',
        payload: { thread_id: 't2', schema_version: 'v1' },
        attempts: 1,
        lockedAt: null,
        createdAt: '',
        updatedAt: ''
      }
    });

    expect(inserted[0].params[5]).toBeTypeOf('string');
    expect(audits[0].type).toBe('crm_write_planned');
  });
});
