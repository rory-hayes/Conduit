import { beforeEach, describe, expect, it, vi } from 'vitest';

const queries: Array<{ sql: string; params: unknown[] }> = [];
const audits: any[] = [];

vi.mock('../src/db.js', () => ({
  withClient: async (fn: any) =>
    fn({
      query: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (sql.includes('FROM policies')) {
          return { rows: [{ policy: { write_weekly_rollup_to_crm: true, create_crm_deltas: true } }] };
        }
        if (sql.includes('FROM deals d')) {
          return { rows: [{ id: 'deal-1', title: 'Acme Pilot', readiness_score: 0.75, missing_keys: ['budget'] }] };
        }
        if (sql.includes('SELECT m.subject')) {
          return { rows: [{ subject: 'Customer asked for proposal' }] };
        }
        if (sql.includes('SELECT reason')) {
          return { rows: [{ reason: 'missing_or_low_confidence_name' }] };
        }
        if (sql.includes('FROM deal_facts')) {
          return { rows: [{ key: 'timeline', value_json: { target: 'Q3' }, confidence: 0.95 }] };
        }
        return { rows: [] };
      }
    })
}));

vi.mock('../src/audit/audit.js', () => ({
  writeAuditEvent: async (input: unknown) => audits.push(input)
}));

const { buildWeeklySummary, weeklyRollup } = await import('../src/jobs/processors/weeklyRollup.js');

describe('weeklyRollup processor', () => {
  beforeEach(() => {
    queries.length = 0;
    audits.length = 0;
  });

  it('builds deterministic summary sections', () => {
    const summary = buildWeeklySummary({
      dealId: 'd1',
      title: 'Deal',
      readinessScore: 0.6,
      missingKeys: ['budget'],
      eventSubjects: ['Event A'],
      reviewReasons: ['needs_review']
    });

    expect(summary.summaryMd).toContain('### What happened this week');
    expect(summary.summaryMd).toContain('Readiness score: 60%');
    expect(summary.summaryMd).toContain('Collect budget evidence on Deal');
  });

  it('inserts rollup and logs CRM writes with deterministic keys', async () => {
    await weeklyRollup({
      clientId: 'worker',
      job: {
        id: 'j1',
        workspaceId: 'w1',
        type: 'weekly_rollup',
        status: 'running',
        payload: { week_start: '2026-01-01', week_end: '2026-01-07' },
        attempts: 0,
        lockedAt: null,
        createdAt: '',
        updatedAt: ''
      }
    });

    expect(queries.some((q) => q.sql.includes('INSERT INTO weekly_rollups'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('upsert_weekly_summary_note'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('INSERT INTO crm_deltas'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('apply_field_deltas'))).toBe(true);
    expect(audits.some((a) => a.type === 'weekly_rollup_generated')).toBe(true);
  });
});
