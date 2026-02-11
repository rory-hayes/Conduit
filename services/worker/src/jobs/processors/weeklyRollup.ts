import { buildCrmIdempotencyKey, hashPayload } from '@conduit/shared';
import type { JobProcessor } from '../types.js';
import { withClient } from '../../db.js';
import { writeAuditEvent } from '../../audit/audit.js';

interface PolicyConfig {
  write_weekly_rollup_to_crm?: boolean;
  create_crm_deltas?: boolean;
}

interface WeekWindow {
  start: string;
  end: string;
}

interface RollupInput {
  dealId: string;
  title: string;
  readinessScore: number;
  missingKeys: string[];
  eventSubjects: string[];
  reviewReasons: string[];
}

export const buildWeeklySummary = (input: RollupInput): { summaryMd: string; highlights: Record<string, unknown> } => {
  const events = input.eventSubjects.slice(0, 5);
  const risks = [...new Set(input.reviewReasons)].slice(0, 5);
  const nextActions = input.missingKeys.map((key) => `Collect ${key} evidence on ${input.title}`);
  const summaryMd = [
    '### What happened this week',
    ...(events.length > 0 ? events.map((event) => `- ${event}`) : ['- No major external email events captured.']),
    '',
    '### Current status',
    `- Readiness score: ${Math.round(input.readinessScore * 100)}%`,
    `- Missing items: ${input.missingKeys.length > 0 ? input.missingKeys.join(', ') : 'none'}`,
    '',
    '### Risks / blockers',
    ...(risks.length > 0 ? risks.map((risk) => `- ${risk}`) : ['- No active blockers.']),
    '',
    '### Recommended next actions',
    ...(nextActions.length > 0 ? nextActions.map((action) => `- ${action}`) : ['- Continue current plan.'])
  ].join('\n');

  return {
    summaryMd,
    highlights: { events, risks, next_actions: nextActions }
  };
};

const getPolicy = async (workspaceId: string): Promise<PolicyConfig> => {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT policy
       FROM policies
       WHERE workspace_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [workspaceId]
    );

    return (result.rows[0]?.policy as PolicyConfig | undefined) ?? {};
  });
};

const isDryRun = process.env.DRY_RUN !== 'false';

export const weeklyRollup: JobProcessor = async ({ job }) => {
  const weekStart = String(job.payload.week_start ?? '');
  const weekEnd = String(job.payload.week_end ?? '');
  const window: WeekWindow = {
    start: weekStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    end: weekEnd || new Date().toISOString().slice(0, 10)
  };

  const policy = await getPolicy(job.workspaceId);

  const deals = await withClient(async (client) => {
    const result = await client.query(
      `SELECT d.id, d.title,
          COALESCE(dr.readiness_score, 0) as readiness_score,
          COALESCE(dr.missing_keys, '{}') as missing_keys
       FROM deals d
       LEFT JOIN deal_readiness dr ON dr.deal_id = d.id AND dr.workspace_id = d.workspace_id
       WHERE d.workspace_id = $1`,
      [job.workspaceId]
    );
    return result.rows;
  });

  for (const deal of deals) {
    const data = await withClient(async (client) => {
      const events = await client.query(
        `SELECT m.subject
         FROM messages m
         JOIN thread_links tl ON tl.thread_id = m.thread_id AND tl.workspace_id = m.workspace_id
         WHERE tl.deal_id = $1
           AND m.workspace_id = $2
           AND m.created_at >= $3::date
           AND m.created_at < ($4::date + interval '1 day')
         ORDER BY m.created_at DESC
         LIMIT 10`,
        [deal.id, job.workspaceId, window.start, window.end]
      );

      const reviews = await client.query(
        `SELECT reason
         FROM review_items ri
         JOIN thread_links tl ON tl.thread_id = ri.thread_id AND tl.workspace_id = ri.workspace_id
         WHERE tl.deal_id = $1
           AND ri.workspace_id = $2
           AND ri.created_at >= $3::date
           AND ri.created_at < ($4::date + interval '1 day')`,
        [deal.id, job.workspaceId, window.start, window.end]
      );

      return {
        events: events.rows.map((row) => String(row.subject ?? 'Untitled event')),
        reviews: reviews.rows.map((row) => String(row.reason ?? 'unspecified'))
      };
    });

    const summary = buildWeeklySummary({
      dealId: deal.id as string,
      title: String(deal.title),
      readinessScore: Number(deal.readiness_score ?? 0),
      missingKeys: (deal.missing_keys as string[]) ?? [],
      eventSubjects: data.events,
      reviewReasons: data.reviews
    });

    await withClient(async (client) => {
      await client.query(
        `INSERT INTO weekly_rollups (workspace_id, deal_id, week_start, week_end, summary_md, highlights_json)
         VALUES ($1, $2, $3::date, $4::date, $5, $6)
         ON CONFLICT (workspace_id, deal_id, week_start)
         DO UPDATE SET summary_md = EXCLUDED.summary_md, highlights_json = EXCLUDED.highlights_json, week_end = EXCLUDED.week_end`,
        [job.workspaceId, deal.id, window.start, window.end, summary.summaryMd, summary.highlights]
      );
    });

    await writeAuditEvent({
      workspaceId: job.workspaceId,
      jobId: job.id,
      type: 'weekly_rollup_generated',
      data: { deal_id: deal.id, week_start: window.start }
    });

    if (policy.write_weekly_rollup_to_crm) {
      for (const crm of ['hubspot', 'salesforce'] as const) {
        const idempotencyKey = buildCrmIdempotencyKey({
          workspace_id: job.workspaceId,
          crm_system: crm,
          object_type: 'deal',
          object_id: String(deal.id),
          action: 'weekly_summary',
          source_event_id: window.start
        });
        const payload = { deal_id: deal.id, week_start: window.start, week_end: window.end, summary_md: summary.summaryMd };

        await withClient(async (client) => {
          await client.query(
            `INSERT INTO crm_write_log (workspace_id, crm, action, idempotency_key, payload_json, payload_hash, status)
             VALUES ($1, $2, 'upsert_weekly_summary_note', $3, $4, $5, $6)
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [job.workspaceId, crm, idempotencyKey, payload, hashPayload(payload), isDryRun ? 'dry_run' : 'queued']
          );
        });
      }

      await writeAuditEvent({
        workspaceId: job.workspaceId,
        jobId: job.id,
        type: 'weekly_rollup_logged_to_crm',
        data: { deal_id: deal.id, week_start: window.start }
      });
    }

    if (policy.create_crm_deltas) {
      const deltas = await withClient(async (client) => {
        const result = await client.query(
          `SELECT key, value_json, confidence
           FROM deal_facts
           WHERE workspace_id = $1
             AND deal_id = $2
             AND confidence >= 0.9`,
          [job.workspaceId, deal.id]
        );
        return result.rows.map((row) => ({ key: row.key, value: row.value_json, confidence: Number(row.confidence) }));
      });

      for (const crm of ['hubspot', 'salesforce'] as const) {
        await withClient(async (client) => {
          await client.query(
            `INSERT INTO crm_deltas (workspace_id, deal_id, crm, week_start, delta_json, status)
             VALUES ($1, $2, $3, $4::date, $5, 'planned')
             ON CONFLICT (workspace_id, deal_id, crm, week_start)
             DO UPDATE SET delta_json = EXCLUDED.delta_json`,
            [job.workspaceId, deal.id, crm, window.start, { fields: deltas }]
          );

          const payload = { deal_id: deal.id, week_start: window.start, fields: deltas };
          const idempotencyKey = buildCrmIdempotencyKey({
            workspace_id: job.workspaceId,
            crm_system: crm,
            object_type: 'deal',
            object_id: String(deal.id),
            action: 'apply_field_deltas',
            source_event_id: window.start
          });

          await client.query(
            `INSERT INTO crm_write_log (workspace_id, crm, action, idempotency_key, payload_json, payload_hash, status)
             VALUES ($1, $2, 'apply_field_deltas', $3, $4, $5, $6)
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [job.workspaceId, crm, idempotencyKey, payload, hashPayload(payload), isDryRun ? 'dry_run' : 'queued']
          );
        });
      }
    }
  }
};
