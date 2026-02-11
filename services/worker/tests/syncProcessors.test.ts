import { beforeEach, describe, expect, it, vi } from 'vitest';

const inserted: any[] = [];
const audits: any[] = [];
const dbRows: Record<string, any> = { status: 'queued' };

vi.mock('../src/db.js', () => ({
  withClient: async (fn: any) =>
    fn({
      query: async (sql: string, params: unknown[]) => {
        inserted.push({ sql, params });
        if (sql.includes('SELECT id, status FROM crm_write_log')) {
          return { rows: [{ id: 'l1', status: dbRows.status }] };
        }
        return { rows: [] };
      }
    })
}));

vi.mock('../src/audit/audit.js', () => ({
  writeAuditEvent: async (input: unknown) => {
    audits.push(input);
  }
}));

const hubspotCalls = { upsert: 0, task: 0, note: 0 };
const salesforceCalls = { upsertLead: 0, task: 0 };
const hubspotError = { message: '' };
const salesforceError = { message: '' };

vi.mock('../src/connectors/hubspot/client.js', () => ({
  createHubSpotClient: () => ({
    upsertContactByEmail: async () => {
      hubspotCalls.upsert += 1;
      if (hubspotError.message) throw new Error(hubspotError.message);
      return { record: { id: 'c1' } };
    },
    createTask: async () => {
      hubspotCalls.task += 1;
      return { id: 't1' };
    },
    createNote: async () => {
      hubspotCalls.note += 1;
      return { id: 'n1' };
    }
  })
}));

vi.mock('../src/connectors/salesforce/client.js', () => ({
  createSalesforceClient: () => ({
    upsertLeadMinimal: async () => {
      salesforceCalls.upsertLead += 1;
      if (salesforceError.message) throw new Error(salesforceError.message);
      return { id: 'l1', mode: 'updated' };
    },
    createTask: async () => {
      salesforceCalls.task += 1;
      return { id: 'task1' };
    }
  })
}));

vi.mock('../src/connectors/hubspot/tokenManager.js', () => ({ createHubSpotTokenManager: () => ({ getAccessToken: async () => 'token' }) }));
vi.mock('../src/connectors/salesforce/tokenManager.js', () => ({ createSalesforceTokenManager: () => ({ getAccessToken: async () => ({ accessToken: 'token', instanceUrl: 'https://sf.local' }) }) }));

const { syncHubSpot } = await import('../src/jobs/processors/syncHubSpot.js');
const { syncSalesforce } = await import('../src/jobs/processors/syncSalesforce.js');

const baseJob = {
  id: 'job1',
  workspaceId: 'w1',
  type: 'sync_hubspot',
  status: 'running',
  payload: { thread_id: 't1', schema_version: 'v1', primary_contact_email: 'a@b.com' },
  attempts: 1,
  lockedAt: null,
  createdAt: '',
  updatedAt: ''
};

describe('sync processors', () => {
  beforeEach(() => {
    inserted.length = 0;
    audits.length = 0;
    dbRows.status = 'queued';
    hubspotCalls.upsert = 0;
    hubspotCalls.task = 0;
    hubspotCalls.note = 0;
    salesforceCalls.upsertLead = 0;
    salesforceCalls.task = 0;
    hubspotError.message = '';
    salesforceError.message = '';
    process.env.DRY_RUN = 'true';
  });

  it('writes dry-run hubspot log and audits', async () => {
    await syncHubSpot({ clientId: 'x', job: baseJob as any });
    expect(inserted[0].sql).toContain('INSERT INTO crm_write_log');
    expect(audits).toHaveLength(2);
  });

  it('skips real sync when idempotent status already succeeded', async () => {
    process.env.DRY_RUN = 'false';
    dbRows.status = 'succeeded';

    await syncHubSpot({ clientId: 'x', job: baseJob as any });
    expect(hubspotCalls.upsert).toBe(0);
  });

  it('executes salesforce sync when dry run disabled', async () => {
    process.env.DRY_RUN = 'false';
    await syncSalesforce({ clientId: 'x', job: { ...baseJob, type: 'sync_salesforce' } as any });
    expect(salesforceCalls.upsertLead).toBe(1);
    expect(salesforceCalls.task).toBe(1);
  });

  it('marks auth errors by surfacing exception for retry handling', async () => {
    process.env.DRY_RUN = 'false';
    salesforceError.message = 'Salesforce API 401';
    await expect(syncSalesforce({ clientId: 'x', job: { ...baseJob, type: 'sync_salesforce' } as any })).rejects.toThrow('401');
  });
});
