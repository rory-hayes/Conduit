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
