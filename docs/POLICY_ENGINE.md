# Policy Engine

## Required Field Gating (V1 Vertical Slice)
- Required fields: `email`, `name`.
- If `email` is missing or has confidence `< 0.85`: create open review item with reason `missing_or_low_confidence_email`.
- Else if `name` is missing or has confidence `< 0.85`: create open review item with reason `missing_or_low_confidence_name`.
- Else: enqueue `sync_hubspot` and `sync_salesforce` jobs.

## Confidence + Review Routing
- Deterministic parser confidence defaults:
  - `Email` exact match: `0.99`
  - `Name`: `0.90`
  - `Company`: `0.85`
  - `Intent`: `0.90`
  - `Timeline`: `0.70`
- Low-confidence required fields always route to review queue.

## Idempotency
- CRM writes use deterministic idempotency keys derived from:
  `(workspace_id, crm_system, object_type, object_id, action, source_event_id)`.
- Replays are safe (`crm_write_log` insert is conflict-safe on `idempotency_key`).

## Task-first + Data Safety
- CRM writes are dry-run by default and only record curated payload metadata.
- Never log raw email bodies or attachment content to CRM logs.
- All decisions and planned writes emit audit events (`crm_write_planned`, `crm_write_logged`, policy decisions).
