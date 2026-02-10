# Conduit AGENTS

## Hard Rules
- **Never log raw email content to any CRM system.**
- Treat Conduit as the canonical store for raw emails, attachments, extraction runs, and audit events.
- All CRM writes must be **idempotent**, **auditable**, and **scoped to curated outcomes** (task + summary note + limited high-confidence field updates).
- Low-confidence extraction **must** route to the review queue; CRM writes can be paused on drift.
- Do not store secrets in the repo.

## Definition of Done
- Docs in `/docs` are updated and consistent with code.
- Database schema changes include RLS stubs and audit logging fields.
- Background jobs are claimable via `FOR UPDATE SKIP LOCKED` and write audit events.
- Lint, typecheck, and tests pass locally.

## Commands
- Install: `pnpm -w install`
- Lint: `pnpm -w lint`
- Typecheck: `pnpm -w typecheck`
- Test: `pnpm -w test`
- Dev (web): `pnpm --filter web dev`
- Worker: `pnpm --filter worker dev`

## Repo Conventions
- TypeScript everywhere.
- Shared Node utilities live in `packages/shared`.
- Deno-compatible utilities live in `supabase/functions/_shared`.
- Supabase migrations live in `supabase/migrations`.

## Security & PII Guidelines
- PII stays in Conduit (Postgres + Storage). Only curated summaries go to CRM.
- Audit every CRM write with idempotency keys and before/after payload hashes.
- Minimize data exposure in logs; redact email bodies and attachments.

## Idempotency Rules
- Each CRM write must include a deterministic idempotency key derived from
  `(workspace_id, crm_system, object_type, object_id, action, source_event_id)`.
- Replays must be safe and should not create duplicate CRM records.

## Non-negotiable Reminder
- **Never log raw email to CRM.**
