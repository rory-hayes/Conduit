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


## Deal Support Mode (V1.1)
- **deals**: workspace-scoped deal/opportunity mirror (`crm`, `crm_deal_id`, `title`, `stage`, `primary_domain`, `owner_user_id`).
- **thread_links**: one deal link per thread (`deal_id`, `link_confidence`, `link_reason`).
- **association_candidates**: unresolved multi-candidate link options (`candidates_json`, `status`, `resolved_at`).
- **deal_facts**: normalized BANT evidence facts (`key`, `value_json`, `confidence`, `evidence_json`).
- **deal_readiness**: framework aggregate (`framework`, `missing_keys`, `readiness_score`, `updated_at`).

### Additional indexes
- `deals(workspace_id)`
- `thread_links(thread_id)`
- `association_candidates(thread_id, status)`
- `deal_facts(deal_id)`
