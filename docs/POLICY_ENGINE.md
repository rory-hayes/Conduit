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


## Deal Association + Readiness Decisions (V1.1)
- Association stays anti-noise: participant email match first, domain match second, ambiguity to review queue.
- Candidate outcomes:
  - `1 candidate`: auto-link thread to deal and emit `thread_auto_linked` audit event.
  - `>1 candidates`: create `needs_deal_linking` review item + `association_candidates` open record.
  - `0 candidates`: create `unlinked_thread` review item.
- Readiness evaluation is internal-first (BANT v1) and task-first:
  - updates `deal_facts` and `deal_readiness` in Conduit,
  - proposes follow-up questions/tasks,
  - logs planned CRM tasks in dry-run mode,
  - avoids per-email CRM writes and raw-content propagation.
