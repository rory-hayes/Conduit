import { beforeEach, describe, expect, it, vi } from 'vitest';

const queries: Array<{ sql: string; params: unknown[] }> = [];
const audits: any[] = [];
let threadRows: any[] = [{ id: 't1', workspace_id: 'w1', status: 'new' }];
let messageRows: any[] = [{ from_email: 'buyer@acme.com', to_email: null, text: 'budget is $20k' }];
let fieldRows: any[] = [{ field_key: 'timeline', field_value_json: 'next month', confidence: 0.8, evidence_json: {} }];

vi.mock('../src/db.js', () => ({
  withClient: async (fn: any) =>
    fn({
      query: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (sql.includes('FROM threads')) return { rows: threadRows };
        if (sql.includes('FROM messages')) return { rows: messageRows };
        if (sql.includes('FROM field_values')) return { rows: fieldRows };
        if (sql.includes('INSERT INTO deals')) return { rows: [{ id: 'd1' }] };
        if (sql.includes('FROM deal_facts')) return { rows: [{ key: 'timeline' }, { key: 'budget' }] };
        return { rows: [] };
      }
    })
}));

vi.mock('../src/audit/audit.js', () => ({
  writeAuditEvent: async (input: unknown) => audits.push(input)
}));

const { associateThread, deriveDealFacts } = await import('../src/jobs/processors/associateThread.js');

describe('associateThread processor', () => {
  beforeEach(() => {
    queries.length = 0;
    audits.length = 0;
    threadRows = [{ id: 't1', workspace_id: 'w1', status: 'new' }];
    messageRows = [{ from_email: 'buyer@acme.com', to_email: null, text: 'budget is $20k' }];
    fieldRows = [{ field_key: 'timeline', field_value_json: 'next month', confidence: 0.8, evidence_json: {} }];
  });

  it('creates unlinked review item when there are zero candidates', async () => {
    const provider = { getDealCandidates: vi.fn().mockResolvedValue([]) };
    await associateThread(provider as any)({
      clientId: 'c',
      job: {
        id: 'j1', workspaceId: 'w1', type: 'associate_thread', status: 'running', payload: { thread_id: 't1' }, attempts: 1, lockedAt: null, createdAt: '', updatedAt: ''
      }
    });

    expect(queries.some((q) => q.sql.includes("reason, status, payload_json") && q.params.includes('unlinked_thread'))).toBe(true);
    expect(audits.some((a) => a.type === 'thread_unlinked')).toBe(true);
  });

  it('creates deal + thread_link when exactly one candidate is found', async () => {
    const provider = {
      getDealCandidates: vi.fn().mockResolvedValue([{ crm: 'hubspot', crm_deal_id: 'deal-1', title: 'Acme Expansion', score: 0.95, why: 'participant_email_match' }])
    };
    await associateThread(provider as any)({
      clientId: 'c',
      job: {
        id: 'j2', workspaceId: 'w1', type: 'associate_thread', status: 'running', payload: { thread_id: 't1' }, attempts: 1, lockedAt: null, createdAt: '', updatedAt: ''
      }
    });

    expect(queries.some((q) => q.sql.includes('INSERT INTO deals'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('INSERT INTO thread_links'))).toBe(true);
    expect(audits.some((a) => a.type === 'thread_auto_linked')).toBe(true);
  });

  it('creates association candidates and review item when candidate set is ambiguous', async () => {
    const provider = {
      getDealCandidates: vi.fn().mockResolvedValue([
        { crm: 'hubspot', crm_deal_id: 'deal-1', title: 'Deal A', score: 0.75, why: 'participant_email_match' },
        { crm: 'salesforce', crm_deal_id: 'opp-2', title: 'Deal B', score: 0.71, why: 'domain_match' }
      ])
    };
    await associateThread(provider as any)({
      clientId: 'c',
      job: {
        id: 'j3', workspaceId: 'w1', type: 'associate_thread', status: 'running', payload: { thread_id: 't1' }, attempts: 1, lockedAt: null, createdAt: '', updatedAt: ''
      }
    });

    expect(queries.some((q) => q.sql.includes('INSERT INTO association_candidates'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('needs_deal_linking'))).toBe(true);
    expect(audits.some((a) => a.type === 'thread_needs_linking')).toBe(true);
  });

  it('maps timeline + budget heuristic into deal facts', () => {
    const facts = deriveDealFacts({ fields: fieldRows, latestMessageText: 'Can we keep pricing around $5k monthly?' });
    expect(facts.map((f) => f.key)).toContain('timeline');
    expect(facts.map((f) => f.key)).toContain('budget');
  });
});
