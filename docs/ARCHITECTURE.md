# Architecture

## Components
- **Supabase (Postgres/Auth/Storage/Edge Functions/Cron)**: canonical data store, auth, inbound endpoint.
- **Worker Service (Node.js/TypeScript)**: job runner, deterministic extraction, governance, CRM dry-run logging.
- **Next.js Web App**: Today threads list, Review Queue list, Thread detail view.
- **AWS Textract**: optional OCR stubbed in V1.

## Component Diagram (Text)
```
Inbound Email -> Edge Function (inbound-email)
  -> Postgres (threads/messages)
  -> Jobs (extract_thread)
  -> Audit Event (inbound_email_received)

Worker
  -> claim jobs (FOR UPDATE SKIP LOCKED)
  -> extract_thread -> extraction_runs + field_values
  -> policy engine -> review_items OR sync jobs
  -> sync_hubspot/sync_salesforce (dry-run)
  -> crm_write_log + audit_events

Web App
  -> Today: recent threads
  -> Review Queue: open review items
  -> Thread Detail: messages + extracted fields + review state + CRM log
```

## Dry-run CRM Mode
- Default behavior is `DRY_RUN=true` (implicit when env is unset).
- Sync processors do not call external APIs in dry-run.
- Instead they persist planned writes in `crm_write_log` and add audit events.

## Edge vs Worker Boundary
- Edge function: validate JSON, derive workspace from alias, persist message, enqueue extraction.
- Worker: extraction parsing, confidence policy decisions, job fanout, CRM write logging.
