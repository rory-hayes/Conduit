# Vertical Slice Plan 002

## Goal
Deliver a dry-run end-to-end inbound-email to CRM-sync pipeline with governance review routing and a minimal UI for thread/review visibility while enforcing 95% test coverage for core worker/shared/web logic.

## In Scope
- Inbound email edge ingestion with thread/message persistence and extract job enqueue.
- Worker extraction, governance decisions, review item creation, and dry-run CRM write logging.
- Basic Today, Review Queue, and Thread Detail UI data views.
- Vitest workspace coverage thresholds at 95% for worker/shared/web component+lib scopes.
- Migration updates for vertical-slice schema and indexes, with RLS stubs + audit fields.

## Out of Scope
- Real HubSpot/Salesforce API calls.
- OCR beyond existing stubs.
- Rich UI interactions beyond read-only listings.

## Milestones
1. Add coverage infrastructure and workspace test orchestration.
2. Add migration + shared schemas + idempotency helpers for deterministic dry-run writes.
3. Implement inbound edge function ingestion flow and audit logging.
4. Implement worker extraction/policy/sync dry-run processors with repository isolation.
5. Wire minimal web pages to Supabase reads.
6. Reach and verify >=95% coverage in required scopes.

## Acceptance Tests
- Inbound POST inserts/links thread+message, enqueues `extract_thread`, writes `inbound_email_received` audit event.
- Worker `extract_thread` writes extraction run + field values, creates review item when required fields are low/missing, otherwise enqueues sync jobs.
- Sync processors in dry-run write `crm_write_log` and related audit events with deterministic idempotency keys.
- Today page shows latest threads; Review Queue shows open items; Thread Detail shows messages, extracted fields, review status, CRM log entries.
- `pnpm -w test:coverage` enforces global lines/functions/branches/statements >=95 with v8 provider.

## Test Plan
- Unit tests for extraction parser, policy decisions, idempotency key stability, sync dry-run behavior, and queue status transitions.
- Shared schema tests for inbound validation.
- Web component/lib tests for rendering and helper behavior.
- Full lint/typecheck/test/test:coverage verification commands in CI/local.
