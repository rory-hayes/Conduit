# Data Model

## Core Tables
- **workspaces**: tenant container for all data.
- **users**: user identities tied to workspaces.
- **crm_connections**: OAuth tokens and metadata for CRM integrations.
- **inbound_aliases**: email aliases for routing.
- **threads**: canonical email threads.
- **messages**: raw inbound emails (canonical store).
- **attachments**: attachment metadata + storage path.
- **extraction_runs**: extraction attempts per thread.
- **field_values**: extracted field values with confidence.
- **review_items**: queue items for analyst review.
- **policies**: workspace policy configurations.
- **jobs**: background tasks queue.
- **audit_events**: immutable audit log.
- **crm_write_log**: idempotent CRM write records.

## Relationship Notes
- One thread has many messages and attachments.
- One extraction run belongs to a thread.
- Review items link to extraction runs.
- CRM writes reference workspace + idempotency key.

## RLS
- Every table includes workspace_id (where applicable) for isolation.
- RLS policies are stubbed in migrations for V1 and must be defined before production.
