# Security & Privacy

## Data Retention
- Raw emails and attachments are retained in Conduit according to workspace policy.
- CRM receives only curated outcomes; raw content never leaves Conduit.

## Encryption
- Supabase Postgres encryption at rest.
- Attachments stored in Supabase Storage with bucket-level policies.

## Least Privilege
- Service role keys only used by edge functions and worker.
- Web app uses anon key with RLS.

## RLS Approach
- All workspace data is scoped via RLS.
- Policies must ensure only workspace members can access records.

## Audit Trails
- Every CRM write is recorded in `crm_write_log`.
- Worker emits `audit_events` for ingestion, extraction, and sync.

## Customer Controls
- Retention windows.
- Drift pause toggles.
- Review queue SLAs.

## LLM Data Minimization
- Default mode is `structured_only`; this excludes raw message text and attachment content.
- Optional `structured_plus_snippets` mode is explicit policy opt-in and only sends capped, short snippets.
- Snippet redaction removes direct phone numbers and masks email local-parts (`***@domain.tld`).
- Only high-signal snippet classes (pricing request, objection, legal) are eligible for snippet context.
- LLM run inputs/outputs are retained in `llm_runs` for auditability and incident response, with prompt hash and validation status.
- CRM remains curated-outcomes only; no raw email payloads are copied to CRM logs or notes.
