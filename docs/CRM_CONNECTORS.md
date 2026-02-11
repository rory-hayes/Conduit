# CRM Connectors

## HubSpot
- Objects: Task + Note + minimal field updates.
- Field mapping: task due date, priority, and summary note.
- Idempotency key derived from workspace + thread + action.

## Salesforce
- Objects: Task + Note + minimal field updates.
- Field mapping: task subject, status, and summary note.
- Idempotency key derived from workspace + thread + action.

## Failure & Retry
- All writes are logged in `crm_write_log` with status and payload hash.
- Retries must be safe (idempotent).
- Failures above threshold trigger drift pause.


## Readiness-driven follow-up
- Missing BANT readiness keys can create internal follow-up tasks.
- In dry-run mode, planned CRM task payloads are logged to `crm_write_log` only.
- Weekly rollups remain the preferred channel for summary note sync to reduce CRM noise.

## Curated outputs for weekly operations
- **Weekly summary note write**: one curated note per deal per week (optional by policy).
- **Delta updates (optional)**: high-confidence field deltas only (confidence >= 0.90).
- All writes are logged to `crm_write_log` with deterministic idempotency keys.
- Raw email content and attachments are never written to CRM.
