import { beforeEach, describe, expect, it, vi } from 'vitest';

const queries: Array<{ sql: string; params: unknown[] }> = [];
const audits: any[] = [];

const policy = {
  write_weekly_rollup_to_crm: true,
  create_crm_deltas: true,
  use_llm_rollups: true,
  llm_context_level: 'structured_only'
};

vi.mock('../src/db.js', () => ({
  withClient: async (fn: any) =>
    fn({
      query: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (sql.includes('FROM policies')) {
          return { rows: [{ policy }] };
        }
        if (sql.includes('FROM deals d')) {
          return {
            rows: [{ id: 'deal-1', title: 'Acme Pilot', stage: 'proposal', readiness_score: 0.75, missing_keys: ['budget'] }]
          };
        }
        if (sql.includes('FROM weekly_rollups') && sql.includes('LIMIT 1')) {
          return { rows: [] };
        }
        if (sql.includes('JOIN thread_links tl') && sql.includes('da.status')) {
          return { rows: [] };
        }
        if (sql.includes('SELECT m.subject')) {
          return { rows: [{ subject: 'Customer asked for proposal', created_at: '2026-01-03T00:00:00.000Z', text: 'Body' }] };
        }
        if (sql.includes('SELECT reason')) {
          return { rows: [{ reason: 'missing_or_low_confidence_name' }] };
        }
        if (sql.includes('FROM deal_facts')) {
          return { rows: [{ key: 'timeline', value_json: { target: 'Q3' }, confidence: 0.95 }] };
        }
        if (sql.includes("SELECT COALESCE(m.text, '') AS text")) {
          return { rows: [{ text: 'Please email rep@acme.com' }] };
        }
        return { rows: [] };
      }
    })
}));

vi.mock('../src/audit/audit.js', () => ({
  writeAuditEvent: async (input: unknown) => audits.push(input)
}));

const { buildWeeklySummary, weeklyRollup, setWeeklyRollupLLMClientFactory } = await import(
  '../src/jobs/processors/weeklyRollup.js'
);

describe('weeklyRollup processor', () => {
  beforeEach(() => {
    queries.length = 0;
    audits.length = 0;
    process.env.OPENAI_API_KEY = 'test';
    process.env.OPENAI_MODEL = 'gpt-test';
    process.env.DRY_RUN = 'false';
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

  it('uses validated LLM output when enabled', async () => {
    setWeeklyRollupLLMClientFactory(() => ({
      generateRollup: async () => ({
        outputText: JSON.stringify({
          summary_md: 'LLM summary',
          highlights: { events: ['e1'], risks: ['r1'], next_actions: ['a1'] },
          confidence: 0.91,
          field_deltas: [{ key: 'timeline', value: { target: 'Q4' }, confidence: 0.95 }]
        }),
        latencyMs: 10,
        tokensPrompt: 12,
        tokensCompletion: 24
      })
    }));

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

    expect(queries.some((q) => q.sql.includes('INSERT INTO llm_runs'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('INSERT INTO weekly_rollups') && q.params.includes('llm'))).toBe(true);
  });

  it('falls back when LLM output is invalid', async () => {
    setWeeklyRollupLLMClientFactory(() => ({
      generateRollup: async () => ({ outputText: '{"summary_md":1}', latencyMs: 10 })
    }));

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

    expect(audits.some((a) => a.type === 'llm_rollup_invalid_output')).toBe(true);
    expect(audits.some((a) => a.type === 'llm_rollup_fallback_used')).toBe(true);
    expect(queries.some((q) => q.sql.includes('INSERT INTO weekly_rollups') && q.params.includes('llm_fallback'))).toBe(true);
  });

  it('never calls LLM in DRY_RUN=true mode', async () => {
    process.env.DRY_RUN = 'true';
    const generate = vi.fn();
    setWeeklyRollupLLMClientFactory(() => ({ generateRollup: generate }));

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

    expect(generate).not.toHaveBeenCalled();
    expect(audits.some((a) => a.type === 'llm_rollup_skipped_dry_run')).toBe(true);
  });
});
