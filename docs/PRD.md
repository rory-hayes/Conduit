# Conduit PRD (Golden)

## Product Summary
Conduit is a revenue inbox intelligence platform that ingests raw emails and attachments, extracts high-confidence outcomes, and publishes **curated** updates to HubSpot/Salesforce. Conduit is the canonical system of record for raw email, attachments, extraction runs, and audit events.

## Personas
- **RevOps Lead**: cares about data quality, auditability, and CRM hygiene.
- **Sales/CS Manager**: wants actionable summaries and tasks without noisy updates.
- **Ops Analyst**: reviews low-confidence extractions and resolves drift.

## Core Workflows
1. **Inbound Email Capture** → Store raw email + attachments in Conduit.
2. **Extraction** → Create a summary, tasks, and high-confidence field updates.
3. **Policy Gate** → Confidence checks, drift pause, review routing.
4. **CRM Sync** → Write only curated outcomes with idempotency keys.
5. **Review Queue** → Analysts approve/override low-confidence items.
6. **Weekly Digest** → Summarize reviewed outcomes for stakeholders.

## V1 Scope
- Inbound email ingestion via Supabase Edge Function.
- Thread/message storage with attachment metadata.
- Extraction run and review queue records.
- Worker service with job claiming logic and stub processors.
- CRM connector stubs with idempotency helpers.
- Next.js dashboard with placeholder UI.

## Non-goals (V1)
- Full bidirectional CRM sync.
- Automated CRM object creation beyond tasks/notes.
- Full OCR pipeline (Textract orchestration only).

## Policy Engine Requirements
- Confidence gating with review threshold.
- Drift pause (global CRM write halt) when confidence drops.
- Task-first output (tasks + single summary note only).
- Idempotent CRM writes with audit log entries.

## CRM Writes
- Only: tasks, one summary note, and limited high-confidence fields.
- Never: raw email content, attachments, or low-confidence fields.
- Each write must be idempotent and auditable.

## Review Queue
- Low confidence or policy violations route to review.
- Reviewer can approve/reject/override.

## Weekly Digest
- Summarize approved outcomes and highlight drift trends.

## Metrics
- Extraction precision/recall.
- Review queue throughput time.
- CRM write success rate and retries.

## Kill Criteria
- If <70% of extractions meet confidence threshold for 30 consecutive days.
- If CRM write error rate >5% for 7 consecutive days.

## Roadmap Highlights
- V1.5: Drift pause automation and review escalation.
- V2: Multi-CRM routing + SLA-based automation.
