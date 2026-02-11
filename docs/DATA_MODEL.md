# Data Model

## Core Entities
- **threads**: workspace-scoped conversation container (`subject`, `primary_contact_email`, `status`).
- **messages**: canonical raw email records with headers/body metadata (`message_id`, `in_reply_to`, `references_json`, `text`, `html`).
- **extraction_runs**: extraction execution records (`schema_id`, `schema_version`, `model`, `status`).
- **field_values**: structured extraction outputs (`field_key`, `field_value_json`, `confidence`, `evidence_json`).
- **review_items**: governance review queue (`reason`, `status`, `payload_json`, `resolved_at`).
- **jobs**: worker queue rows claimable with `FOR UPDATE SKIP LOCKED` (`status`, `run_after`, `locked_at`, `locked_by`).
- **audit_events**: immutable operational audit log (`workspace_id`, `thread_id`, `job_id`, `type`, `data_json`).
- **crm_write_log**: idempotent CRM dry-run/sync ledger (`crm`, `action`, `idempotency_key`, `payload_hash`, `status`).
- **policies**: workspace policy JSON (`policy`).

## Indexes
- Job claiming: `(status, run_after, created_at)`.
- Thread/message lookups: `messages(message_id)`, `messages(thread_id, created_at desc)`, `threads(workspace_id, created_at desc)`.
- Review and CRM read views: `review_items(workspace_id, status, created_at desc)`, `crm_write_log(thread_id, created_at desc)`.

## RLS
RLS is enabled on all tables. Current migration keeps policy stubs/permissive local placeholders; production must enforce workspace-scoped policies.
