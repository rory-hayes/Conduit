# Plan 004: Weekly Rollups and Drift Pause

## Scope
- Implement drift detection keyed by recurring inbound source patterns.
- Pause CRM writes (policy-controlled) when extraction quality materially drops.
- Route drift-paused threads to review queue and create drift alerts.
- Add weekly rollup job that writes internal rollups and optional curated CRM notes/deltas.
- Add minimal settings/reporting/review UI for drift and rollups.

## Non-goals
- No new external CRM API execution path (DRY_RUN remains default true).
- No LLM-generated weekly summaries.
- No schema-level or workspace-level pause UI controls beyond source-key pause defaults.
- No auto-resolve of drift alerts.

## Data model changes
- `weekly_rollups`
- `crm_deltas`
- `drift_alerts`
- `write_pause`
- `extraction_quality_history`
- Supporting indexes and RLS stubs per repo convention.

## Cron schedule
- Supabase `admin-cron` enqueues `weekly_rollup` jobs for each workspace.
- Suggested cadence: once weekly (e.g., Sunday 23:55 UTC) via Supabase cron.

## UI changes
- Global drift alert banner with open count and links.
- Settings toggles display for drift pause and weekly CRM outputs.
- Reports page lists recent weekly rollups.
- Review queue segmented into Drift Pause Reviews / Needs Deal Linking / Low Confidence Fields.
- Thread detail indicates drift pause state.

## Failure modes
- Missing policy row: use safe defaults (pause on drift enabled, deltas disabled).
- Duplicate rollup run: idempotent upsert by `(workspace_id, deal_id, week_start)`.
- Repeat drift alert: allowed; pause row is idempotently upserted.
- Low signal week: rollup still generated with deterministic fallback bullets.
- CRM is paused by drift: sync jobs are not enqueued for impacted threads.

## Test plan (exact tests to add)
- `services/worker/tests/driftDetection.test.ts`
- `services/worker/tests/extractThreadProcessor.test.ts` (drift-trigger path)
- `services/worker/tests/weeklyRollup.test.ts`
- `apps/web/tests/components.test.tsx` (DriftAlertBanner + RollupViewer)

## Acceptance criteria
- [ ] `computeSourceKey` normalizes reply prefixes and produces stable output.
- [ ] `computeExtractionQuality` scores email/name/company with weighted confidence gates.
- [ ] Drift triggers when historical quality is high and current quality drops materially.
- [ ] Extraction flow computes and persists source key quality history.
- [ ] Drift creates `drift_alerts` row with severity/reason/details.
- [ ] Drift creates/updates `write_pause` row for source_key scope.
- [ ] Drift creates review queue item with reason `drift_pause_review`.
- [ ] Drift prevents CRM sync job enqueue for impacted thread.
- [ ] Drift writes audit events `drift_detected` and `crm_writes_paused`.
- [ ] Weekly rollup job exists and is queue-claimable via existing worker runner.
- [ ] Weekly rollup summary uses deterministic template sections.
- [ ] Weekly rollup upserts idempotently on unique workspace+deal+week.
- [ ] Optional weekly CRM summary logs `crm_write_log` entries with deterministic idempotency keys.
- [ ] Optional CRM delta generation only uses high-confidence facts (>=0.90).
- [ ] Weekly rollup writes audit events for generation/logging.
- [ ] Admin cron enqueues weekly rollup jobs with explicit week window.
- [ ] Reports page displays weekly rollups newest-first.
- [ ] Settings page shows three policy toggles for drift + rollup behavior.
- [ ] Review queue page includes drift pause / deal linking / low confidence sections.
- [ ] Thread detail displays drift-paused state.
