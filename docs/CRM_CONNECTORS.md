# CRM Connectors

## Core principles
- Conduit is canonical for raw email, attachments, extraction output, and audits.
- CRM receives curated outcomes only (no raw email bodies/attachments).
- Every write uses deterministic idempotency keys and is logged in `crm_write_log`.

## HubSpot connector
- OAuth: `/functions/v1/hubspot-oauth-start` and `/functions/v1/hubspot-oauth-callback`.
- Contact upsert: search by email (`/crm/v3/objects/contacts/search`), then create (`POST /crm/v3/objects/contacts`) or update (`PATCH /crm/v3/objects/contacts/{id}`).
- Task write: `POST /crm/v3/objects/tasks` with curated subject/timestamps and contact association.
- Weekly rollup note: `POST /crm/v3/objects/notes` with summary body and same association pattern.
- Associations: worker resolves association labels via v4 endpoint and caches type IDs in-process with TTL.

## Salesforce connector
- OAuth: `/functions/v1/salesforce-oauth-start` and `/functions/v1/salesforce-oauth-callback`.
- Lookup strategy: SOQL query for lead first, then contact by email.
- Upsert strategy: patch existing lead (`PATCH /sobjects/Lead/{Id}`) or create minimal lead (`POST /sobjects/Lead`) with fallback required fields.
- Task write: `POST /sobjects/Task`.
- Weekly rollup recording: Task subject `Weekly deal summary` and description set to curated rollup text.

## Idempotency keys
- `buildCrmIdempotencyKey(workspace_id, crm_system, object_type, object_id, action, source_event_id)`.
- `crm_write_log` unique index on `(workspace_id, crm, idempotency_key)`.
- Processors skip records already marked `succeeded`.

## Failure modes
- 429/5xx are retriable via shared retry helper.
- 4xx (except auth) are treated as terminal and surfaced for operator action.
- 401/403 trigger token refresh path once; repeated failures mark connection `error` with actionable `last_error`.

## V1.4 Marketplace Readiness Hardening

- Association rules (V1.4 hardening):
  - HubSpot sync:
    - Always associate task/note to contact when identified.
    - If `thread_links` maps to an internal deal that has HubSpot `crm_deal_id`, also attach to that deal.
  - Salesforce sync:
    - Create Task with `WhatId` set to mapped opportunity ID when available.
    - Set `WhoId` when a lead/contact is available from minimal upsert.
  - If no deal/opportunity mapping exists, fall back to contact/lead-only associations.
