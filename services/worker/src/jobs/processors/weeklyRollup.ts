import { buildCrmIdempotencyKey, hashPayload } from '@conduit/shared';
import { randomUUID, createHash } from 'node:crypto';
import type { JobProcessor } from '../types.js';
import { withClient } from '../../db.js';
import { writeAuditEvent } from '../../audit/audit.js';
import { OpenAILLMClient } from '../../llm/openaiClient.js';
import type { LLMClient, LLMContextLevel } from '../../llm/types.js';
import { LLMDryRunError } from '../../llm/types.js';
import { buildRollupSystemPrompt, buildRollupUserPrompt } from '../../llm/promptTemplates.js';
import { parseRollupOutput } from '../../llm/rollupSchema.js';
import { buildRollupContext } from '../../rollups/contextBuilder.js';

interface PolicyConfig {
  write_weekly_rollup_to_crm?: boolean;
  create_crm_deltas?: boolean;
  use_llm_rollups?: boolean;
  llm_context_level?: LLMContextLevel;
  pause_on_drift?: boolean;
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

const isDryRun = (): boolean => process.env.DRY_RUN !== 'false';
let llmClientFactory: () => LLMClient = () => new OpenAILLMClient();

export const setWeeklyRollupLLMClientFactory = (factory: () => LLMClient): void => {
  llmClientFactory = factory;
};

const hasOpenDriftPause = async (workspaceId: string, dealId: string): Promise<boolean> => {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT 1
       FROM drift_alerts da
       JOIN thread_links tl ON tl.thread_id = da.thread_id AND tl.workspace_id = da.workspace_id
       WHERE da.workspace_id = $1
         AND tl.deal_id = $2
         AND da.status = 'open'
       LIMIT 1`,
      [workspaceId, dealId]
    );
    return result.rows.length > 0;
  });
};

const hashPrompt = (systemPrompt: string, userPrompt: string): string =>
  createHash('sha256').update(systemPrompt).update(userPrompt).digest('hex');

export const weeklyRollup: JobProcessor = async ({ job }) => {
  const weekStart = String(job.payload.week_start ?? '');
  const weekEnd = String(job.payload.week_end ?? '');
  const force = job.payload.force === true;
  const window: WeekWindow = {
    start: weekStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    end: weekEnd || new Date().toISOString().slice(0, 10)
  };

  const policy = await getPolicy(job.workspaceId);

  const deals = await withClient(async (client) => {
    const result = await client.query(
      `SELECT d.id, d.title, d.stage,
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
    const existing = await withClient(async (client) => {
      const result = await client.query(
        `SELECT id
         FROM weekly_rollups
         WHERE workspace_id = $1 AND deal_id = $2 AND week_start = $3::date
         LIMIT 1`,
        [job.workspaceId, deal.id, window.start]
      );
      return result.rows[0]?.id as string | undefined;
    });

    if (existing && !force) {
      continue;
    }

    const data = await withClient(async (client) => {
      const [events, reviews, facts, snippets] = await Promise.all([
        client.query(
          `SELECT m.subject, m.created_at, COALESCE(m.text, '') AS text
           FROM messages m
           JOIN thread_links tl ON tl.thread_id = m.thread_id AND tl.workspace_id = m.workspace_id
           WHERE tl.deal_id = $1
             AND m.workspace_id = $2
             AND m.created_at >= $3::date
             AND m.created_at < ($4::date + interval '1 day')
           ORDER BY m.created_at DESC
           LIMIT 10`,
          [deal.id, job.workspaceId, window.start, window.end]
        ),
        client.query(
          `SELECT reason
           FROM review_items ri
           JOIN thread_links tl ON tl.thread_id = ri.thread_id AND tl.workspace_id = ri.workspace_id
           WHERE tl.deal_id = $1
             AND ri.workspace_id = $2
             AND ri.created_at >= $3::date
             AND ri.created_at < ($4::date + interval '1 day')`,
          [deal.id, job.workspaceId, window.start, window.end]
        ),
        client.query(
          `SELECT key, value_json, confidence
           FROM deal_facts
           WHERE workspace_id = $1 AND deal_id = $2`,
          [job.workspaceId, deal.id]
        ),
        client.query(
          `SELECT COALESCE(m.text, '') AS text
           FROM messages m
           JOIN thread_links tl ON tl.thread_id = m.thread_id AND tl.workspace_id = m.workspace_id
           WHERE tl.deal_id = $1
             AND m.workspace_id = $2
             AND m.created_at >= $3::date
             AND m.created_at < ($4::date + interval '1 day')
           ORDER BY m.created_at DESC
           LIMIT 5`,
          [deal.id, job.workspaceId, window.start, window.end]
        )
      ]);

      return {
        events: events.rows,
        reviews: reviews.rows,
        facts: facts.rows,
        snippets: snippets.rows
      };
    });

    const deterministic = buildWeeklySummary({
      dealId: deal.id as string,
      title: String(deal.title),
      readinessScore: Number(deal.readiness_score ?? 0),
      missingKeys: (deal.missing_keys as string[]) ?? [],
      eventSubjects: data.events.map((row) => String(row.subject ?? 'Untitled event')),
      reviewReasons: data.reviews.map((row) => String(row.reason ?? 'unspecified'))
    });

    let summaryMd = deterministic.summaryMd;
    let highlights = deterministic.highlights;
    let generationMethod: 'deterministic' | 'llm' | 'llm_fallback' = 'deterministic';
    let llmRunId: string | null = null;

    const contextLevel: LLMContextLevel =
      policy.llm_context_level === 'structured_plus_snippets' ? 'structured_plus_snippets' : 'structured_only';
    const driftPaused = policy.pause_on_drift !== false && (await hasOpenDriftPause(job.workspaceId, String(deal.id)));

    if (policy.use_llm_rollups && !driftPaused) {
      if (isDryRun()) {
        await writeAuditEvent({
          workspaceId: job.workspaceId,
          jobId: job.id,
          type: 'llm_rollup_skipped_dry_run',
          data: { deal_id: deal.id, week_start: window.start }
        });
      } else if (!process.env.OPENAI_API_KEY) {
        await writeAuditEvent({
          workspaceId: job.workspaceId,
          jobId: job.id,
          type: 'llm_rollup_failed',
          data: { deal_id: deal.id, reason: 'missing_openai_api_key' }
        });
      } else {
        const contextJson = buildRollupContext(
          {
            deal: { title: String(deal.title), stage: (deal.stage as string | null | undefined) ?? null },
            weekWindow: window,
            facts: data.facts.map((row) => ({ key: String(row.key), value: row.value_json, confidence: Number(row.confidence ?? 0) })),
            readiness: { score: Number(deal.readiness_score ?? 0), missingKeys: (deal.missing_keys as string[]) ?? [] },
            events: data.events.map((row) => ({
              timestamp: new Date(String(row.created_at ?? new Date().toISOString())).toISOString(),
              label: 'email_event',
              description: String(row.subject ?? 'Untitled event')
            })),
            risks: data.reviews.map((row) => String(row.reason ?? 'unspecified')),
            suggestedNextActions: ((deal.missing_keys as string[]) ?? []).map(
              (key) => `Collect ${key} evidence on ${String(deal.title)}`
            ),
            driftPaused,
            reviewItems: data.reviews.map((row) => ({ reason: String(row.reason ?? 'unspecified') })),
            snippets: data.snippets.map((row) => {
              const text = String(row.text ?? '').toLowerCase();
              const signalTag = text.includes('price')
                ? 'pricing_request'
                : text.includes('legal')
                  ? 'legal'
                  : text.includes('objection')
                    ? 'objection'
                    : 'other';
              return { text: String(row.text ?? ''), signalTag };
            })
          },
          contextLevel
        );

        const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
        const systemPrompt = buildRollupSystemPrompt();
        const userPrompt = buildRollupUserPrompt({ contextLevel, contextJson });
        const promptHash = hashPrompt(systemPrompt, userPrompt);

        await writeAuditEvent({
          workspaceId: job.workspaceId,
          jobId: job.id,
          type: 'llm_rollup_requested',
          data: { deal_id: deal.id, model, context_level: contextLevel, prompt_hash: promptHash }
        });

        try {
          const llmResult = await llmClientFactory().generateRollup({
            model,
            contextLevel,
            systemPrompt,
            userPrompt,
            metadata: {
              workspaceId: job.workspaceId,
              dealId: String(deal.id),
              weekStart: window.start,
              weekEnd: window.end
            }
          });

          await writeAuditEvent({
            workspaceId: job.workspaceId,
            jobId: job.id,
            type: 'llm_tokens_estimated',
            data: {
              deal_id: deal.id,
              tokens_prompt: llmResult.tokensPrompt ?? null,
              tokens_completion: llmResult.tokensCompletion ?? null
            }
          });
          await writeAuditEvent({
            workspaceId: job.workspaceId,
            jobId: job.id,
            type: 'llm_latency_ms',
            data: { deal_id: deal.id, value: llmResult.latencyMs }
          });

          const parsed = parseRollupOutput(llmResult.outputText);
          llmRunId = randomUUID();

          await withClient(async (client) => {
            await client.query(
              `INSERT INTO llm_runs (
                id, workspace_id, deal_id, job_id, purpose, model, parameters_json, context_level,
                input_json, prompt_hash, output_text, output_json, validation_status, tokens_prompt,
                tokens_completion, latency_ms
              ) VALUES (
                $1, $2, $3, $4, 'weekly_rollup', $5, $6, $7, $8, $9, $10, $11, 'valid', $12, $13, $14
              ) ON CONFLICT (workspace_id, purpose, deal_id, prompt_hash)
              DO UPDATE SET output_text = EXCLUDED.output_text, output_json = EXCLUDED.output_json,
                validation_status = EXCLUDED.validation_status, tokens_prompt = EXCLUDED.tokens_prompt,
                tokens_completion = EXCLUDED.tokens_completion, latency_ms = EXCLUDED.latency_ms`,
              [
                llmRunId,
                job.workspaceId,
                deal.id,
                job.id,
                model,
                { temperature: 0.1, max_tokens: 900 },
                contextLevel,
                contextJson,
                promptHash,
                llmResult.outputText,
                parsed,
                llmResult.tokensPrompt ?? null,
                llmResult.tokensCompletion ?? null,
                llmResult.latencyMs
              ]
            );
          });

          summaryMd = parsed.summary_md;
          highlights = parsed.highlights;
          generationMethod = 'llm';

          await writeAuditEvent({
            workspaceId: job.workspaceId,
            jobId: job.id,
            type: 'llm_rollup_succeeded',
            data: { deal_id: deal.id, prompt_hash: promptHash }
          });

          if (policy.create_crm_deltas) {
            const deltas = parsed.field_deltas.filter((delta) => delta.confidence >= 0.9);
            for (const crm of ['hubspot', 'salesforce'] as const) {
              await withClient(async (client) => {
                await client.query(
                  `INSERT INTO crm_deltas (workspace_id, deal_id, crm, week_start, delta_json, status)
                   VALUES ($1, $2, $3, $4::date, $5, 'planned')
                   ON CONFLICT (workspace_id, deal_id, crm, week_start)
                   DO UPDATE SET delta_json = EXCLUDED.delta_json`,
                  [job.workspaceId, deal.id, crm, window.start, { fields: deltas }]
                );
              });
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown_llm_error';
          const errorName = error instanceof Error ? error.name : 'UnknownError';
          if (error instanceof LLMDryRunError) {
            await writeAuditEvent({
              workspaceId: job.workspaceId,
              jobId: job.id,
              type: 'llm_rollup_skipped_dry_run',
              data: { deal_id: deal.id }
            });
          } else {
            const status = errorName === 'SyntaxError' || errorName === 'ZodError' ? 'invalid' : 'error';
            llmRunId = randomUUID();
            await withClient(async (client) => {
              await client.query(
                `INSERT INTO llm_runs (
                  id, workspace_id, deal_id, job_id, purpose, model, parameters_json, context_level,
                  input_json, prompt_hash, output_text, output_json, validation_status, error_text, latency_ms
                ) VALUES (
                  $1, $2, $3, $4, 'weekly_rollup', $5, $6, $7, $8, $9, $10, NULL, $11, $12, NULL
                ) ON CONFLICT (workspace_id, purpose, deal_id, prompt_hash)
                DO UPDATE SET output_text = EXCLUDED.output_text, validation_status = EXCLUDED.validation_status,
                  error_text = EXCLUDED.error_text`,
                [
                  llmRunId,
                  job.workspaceId,
                  deal.id,
                  job.id,
                  process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
                  { temperature: 0.1, max_tokens: 900 },
                  contextLevel,
                  buildRollupContext(
                    {
                      deal: { title: String(deal.title), stage: (deal.stage as string | null | undefined) ?? null },
                      weekWindow: window,
                      facts: [],
                      readiness: { score: Number(deal.readiness_score ?? 0), missingKeys: (deal.missing_keys as string[]) ?? [] },
                      events: [],
                      risks: [],
                      suggestedNextActions: [],
                      driftPaused,
                      reviewItems: []
                    },
                    contextLevel
                  ),
                  hashPrompt(buildRollupSystemPrompt(), buildRollupUserPrompt({ contextLevel, contextJson: { deal_id: deal.id } })),
                  '',
                  status,
                  message
                ]
              );
            });

            await writeAuditEvent({
              workspaceId: job.workspaceId,
              jobId: job.id,
              type: status === 'invalid' ? 'llm_rollup_invalid_output' : 'llm_rollup_failed',
              data: { deal_id: deal.id, error: message }
            });
            await writeAuditEvent({
              workspaceId: job.workspaceId,
              jobId: job.id,
              type: 'llm_rollup_fallback_used',
              data: { deal_id: deal.id }
            });
            generationMethod = 'llm_fallback';
          }
        }
      }
    }

    await withClient(async (client) => {
      await client.query(
        `INSERT INTO weekly_rollups (
          workspace_id, deal_id, week_start, week_end, summary_md, highlights_json, generation_method, llm_run_id
         )
         VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8)
         ON CONFLICT (workspace_id, deal_id, week_start)
         DO UPDATE SET summary_md = EXCLUDED.summary_md, highlights_json = EXCLUDED.highlights_json,
            week_end = EXCLUDED.week_end, generation_method = EXCLUDED.generation_method, llm_run_id = EXCLUDED.llm_run_id`,
        [job.workspaceId, deal.id, window.start, window.end, summaryMd, highlights, generationMethod, llmRunId]
      );
    });

    await writeAuditEvent({
      workspaceId: job.workspaceId,
      jobId: job.id,
      type: 'weekly_rollup_generated',
      data: { deal_id: deal.id, week_start: window.start, generation_method: generationMethod }
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
        const payload = { deal_id: deal.id, week_start: window.start, week_end: window.end, summary_md: summaryMd };

        await withClient(async (client) => {
          await client.query(
            `INSERT INTO crm_write_log (workspace_id, crm, action, idempotency_key, payload_json, payload_hash, status)
             VALUES ($1, $2, 'upsert_weekly_summary_note', $3, $4, $5, $6)
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [job.workspaceId, crm, idempotencyKey, payload, hashPayload(payload), isDryRun() ? 'dry_run' : 'queued']
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

    if (policy.create_crm_deltas && generationMethod !== 'llm') {
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
            [job.workspaceId, crm, idempotencyKey, payload, hashPayload(payload), isDryRun() ? 'dry_run' : 'queued']
          );
        });
      }
    }
  }
};
