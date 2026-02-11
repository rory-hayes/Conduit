# Plan 007: Marketplace Readiness Hardening (V1.4)

## Goal
Harden Conduit for marketplace-style CRM installs and reliable operations while preserving Conduit as canonical storage for raw email and ensuring CRM writes remain curated, idempotent, auditable, and DRY_RUN-safe by default.

## Scope
- Install-first OAuth for HubSpot and Salesforce with claim-after-signup/login.
- Connection health tracking with scheduled checks and surfaced UI status.
- CRM write reconciliation retries with bounded exponential backoff and permanent failure handling.
- Improved CRM associations to mapped deal/opportunity where available.
- Customer controls for disconnect and retention purge policies/jobs.
- Supporting docs, migration, and tests to keep global coverage >=95%.

## Non-Goals
- Building a new CRM provider.
- Migrating historical data outside retention policy actions.
- Bulk CRM object backfill beyond existing sync queues.
- Deep token scope remediation UX (only status and reconnect guidance).

## Data Model Changes
- Add `pending_installs` to track unclaimed marketplace installs.
- Add `connection_health` for per-workspace+CRM health state.
- Add `retention_policies` for workspace retention controls.
- Extend `crm_write_log` with `next_retry_at`, `retry_count`, `permanent_failure`.
- Extend `messages` with `is_redacted`, `redacted_at`.
- Add indexes for reconcile and retention workloads.
- Add RLS stubs/policies for admin/workspace access boundaries.

## Install-First OAuth + Claim Flow
1. OAuth start can be invoked without `workspace_id` for marketplace installs.
2. Callback exchanges token and resolves external account key.
3. Creates/upserts a pending install (`pending`) with expiry and metadata.
4. Redirects to `/claim-install?crm=...&install_id=...`.
5. Authenticated user selects workspace to claim into.
6. `claim-install` edge function validates pending+not expired, assigns workspace, marks claimed, updates connection status, writes `install_claimed` audit event.

## Reconciliation + Health + Retention
- Hourly `reconcile_connections` checks connected tokens via minimal provider call.
- Every 10 minutes `reconcile_crm_writes` schedules retries for eligible failed/planned rows.
- Daily `purge_retention` redacts message bodies and removes aged attachment references according to policy.
- All jobs write audit events and avoid exposing raw email in CRM or logs.

## UI Changes
- Claim install route/card for post-marketplace claim handoff.
- Connection health card with status, last checked, reconnect/disconnect actions.
- Retention settings card with validation and policy persistence hooks.
- Integrations surface permanent failure/reconcile alerts metadata.

## Failure Modes
- Expired pending install cannot be claimed and returns explicit error.
- External account key collisions resolve by upserting pending install metadata, preserving deterministic ownership claim.
- Repeated CRM sync failures mark `permanent_failure=true` after bounded retries.
- Token revocation/401 marks `crm_connections.status='error'` and health status `error`.
- Purge failures log audit detail and preserve retriable state.

## Test Plan (exact tests to add)
- `packages/shared/tests/installFlow.test.ts`
  - create/update pending install row model payload generation
  - claim validation (pending, claimed, expired)
- `packages/shared/tests/reconciliation.test.ts`
  - exponential backoff + jitter bounded behavior
  - permanent failure threshold marking
- `packages/shared/tests/retentionPolicy.test.ts`
  - retention defaults and input normalization
  - purge decision for messages and attachments
- `services/worker/tests/connectionHealthProcessor.test.ts`
  - health transitions `ok`/`warning`/`error`
  - connection status flips to `error` on auth failures
- `services/worker/tests/reconcileCrmWritesProcessor.test.ts`
  - eligible rows selected and jobs enqueued
  - retry counters and next_retry_at update
  - permanent failure event emitted after max retries
- `services/worker/tests/purgeRetentionProcessor.test.ts`
  - message redaction updates fields and timestamps
  - attachment cleanup decision logic and audit counts
- `services/worker/tests/syncProcessors.test.ts`
  - hubspot task/note associations include mapped deal id when present
  - salesforce task payload sets WhatId and optional WhoId
- `apps/web/tests/components.test.tsx`
  - `ClaimInstallCard` render and handler invocation
  - `ConnectionHealthCard` status/actions render
  - `RetentionSettingsCard` validation UI behavior

## Acceptance Criteria
- [ ] OAuth callback supports states without workspace id for HubSpot.
- [ ] OAuth callback supports states without workspace id for Salesforce.
- [ ] Pending installs persist external account key and metadata.
- [ ] Pending installs are uniquely constrained per CRM external account while pending.
- [ ] Claim route `/claim-install` exists and renders claim UI.
- [ ] Claim API refuses expired installs.
- [ ] Claim API binds pending install + connection to selected workspace.
- [ ] Claim API writes audit event `install_claimed`.
- [ ] Connected integrations receive hourly health checks.
- [ ] Health check writes `connection_health` row per workspace+CRM.
- [ ] Health check updates `crm_connections.status='error'` on sustained auth failures.
- [ ] Integrations UI displays health state and last checked timestamp.
- [ ] Reconcile worker scans failed/planned CRM writes eligible for retry.
- [ ] Retry schedule uses exponential backoff with jitter and bounded attempts.
- [ ] Retries mark `permanent_failure=true` after max attempts.
- [ ] Permanent failures are exposed for UI visibility and operational triage.
- [ ] HubSpot sync associates task/note with contact and mapped deal when available.
- [ ] Salesforce sync sets `WhatId` opportunity association when mapped.
- [ ] Disconnect API clears encrypted tokens and sets disconnected status.
- [ ] Retention policy settings persisted per workspace with defaults.
- [ ] Daily purge redacts old message bodies and marks redaction flags.
- [ ] Daily purge removes aged attachment references per policy.
- [ ] Purge emits `retention_purge_completed` audit event with counts.
- [ ] Docs updated across PRD, architecture, security/privacy, runbook, deployment, connectors.
- [ ] Global lint/typecheck/test/test:coverage remain green with >=95 thresholds.
