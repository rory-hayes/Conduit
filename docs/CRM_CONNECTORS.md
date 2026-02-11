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
