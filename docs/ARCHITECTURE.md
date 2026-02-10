# Architecture

## Components
- **Supabase (Postgres/Auth/Storage/Edge Functions/Cron)**: canonical data store, auth, and inbound endpoints.
- **Worker Service (Node.js/TypeScript)**: job runner, extraction orchestration, CRM sync.
- **Next.js Web App**: dashboard, review queue, integrations, settings.
- **AWS Textract**: minimal OCR for attachments (S3 + Textract API only).

## Component Diagram (Text)
```
Inbound Email -> Supabase Edge Function (inbound-email)
  -> Postgres (threads, messages, attachments)
  -> Jobs table (extract_thread)

Worker Service
  -> claims jobs (FOR UPDATE SKIP LOCKED)
  -> extraction + policy engine
  -> CRM connectors (HubSpot/Salesforce)
  -> audit_events

Next.js Web App
  -> reads from Supabase
  -> review queue + reports

AWS
  -> S3 bucket for OCR assets
  -> Textract for OCR results
```

## Data Flow
1. Email arrives via inbound edge function.
2. Stored in Conduit tables and attachments metadata captured.
3. Job enqueued for extraction.
4. Worker claims job, runs extraction, writes audit events.
5. Policy engine gates CRM writes; low confidence routes to review queue.
6. CRM sync writes curated outcomes only (tasks + summary + limited fields).

## Boundary Between Edge Functions and Worker
- Edge functions handle **ingestion**, **validation**, and **job enqueue**.
- Worker handles **compute-heavy tasks**, **policy evaluation**, and **CRM writes**.

## Why AWS is Minimal
- Only required for Textract OCR on complex PDFs/images.
- Conduit remains canonical storage; OCR outputs are ingested back into Postgres.
- No additional AWS services beyond S3 and Textract.
