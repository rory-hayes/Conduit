import { beforeEach, describe, expect, it, vi } from 'vitest';

const queries: Array<{ sql: string; params?: unknown[] }> = [];
const state = {
  connections: [{ workspace_id: 'w1', crm: 'hubspot' }],
  writes: [{ id: 'log1', workspace_id: 'w1', thread_id: 't1', crm: 'hubspot', retry_count: 0 }],
  workspaces: [{ id: 'w1' }],
  policies: [{ workspace_id: 'w1', raw_email_retention_days: 30, attachment_retention_days: 30, purge_enabled: true, keep_extracted_fields: true, keep_audit_events: true }]
};
const audits: any[] = [];

vi.mock('../src/db.js', () => ({
  withClient: async (fn: any) =>
    fn({
      query: async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params });
        if (sql.includes("FROM crm_connections WHERE status = 'connected'")) return { rows: state.connections };
        if (sql.includes("FROM crm_write_log") && sql.includes("status IN ('failed', 'planned')")) return { rows: state.writes };
        if (sql.includes('SELECT id FROM workspaces')) return { rows: state.workspaces };
        if (sql.includes('FROM retention_policies')) return { rows: state.policies };
        return { rows: [], rowCount: 1 };
      }
    })
}));

vi.mock('../src/audit/audit.js', () => ({ writeAuditEvent: async (input: unknown) => audits.push(input) }));
vi.mock('../src/connectors/hubspot/tokenManager.js', () => ({ createHubSpotTokenManager: () => ({ getAccessToken: async () => 'token' }) }));
vi.mock('../src/connectors/salesforce/tokenManager.js', () => ({ createSalesforceTokenManager: () => ({ getAccessToken: async () => ({ accessToken: 'token', instanceUrl: 'x' }) }) }));

const { reconcileConnections } = await import('../src/jobs/processors/reconcileConnections.js');
const { reconcileCrmWrites } = await import('../src/jobs/processors/reconcileCrmWrites.js');
const { purgeRetention } = await import('../src/jobs/processors/purgeRetention.js');

describe('reconcile processors', () => {
  beforeEach(() => {
    queries.length = 0;
    audits.length = 0;
    state.writes[0].retry_count = 0;
  });

  it('runs connection health checks and writes audit', async () => {
    await reconcileConnections({ clientId: 'x', job: {} as any });
    expect(queries.some((entry) => entry.sql.includes('INSERT INTO connection_health'))).toBe(true);
    expect(audits.some((entry) => entry.type === 'connection_health_checked')).toBe(true);
  });

  it('schedules retries and increments retry metadata', async () => {
    await reconcileCrmWrites({ clientId: 'x', job: {} as any });
    expect(queries.some((entry) => entry.sql.includes('INSERT INTO jobs'))).toBe(true);
    expect(audits.some((entry) => entry.type === 'crm_write_retry_scheduled')).toBe(true);
  });

  it('marks permanent failure when retries exceed threshold', async () => {
    state.writes[0].retry_count = 7;
    await reconcileCrmWrites({ clientId: 'x', job: {} as any });
    expect(queries.some((entry) => entry.sql.includes('permanent_failure = true'))).toBe(true);
    expect(audits.some((entry) => entry.type === 'crm_write_marked_permanent_failure')).toBe(true);
  });

  it('purges retention targets and records audit counts', async () => {
    await purgeRetention({ clientId: 'x', job: {} as any });
    expect(queries.some((entry) => entry.sql.includes('UPDATE messages'))).toBe(true);
    expect(queries.some((entry) => entry.sql.includes('UPDATE attachments'))).toBe(true);
    expect(audits.some((entry) => entry.type === 'retention_purge_completed')).toBe(true);
  });
});
