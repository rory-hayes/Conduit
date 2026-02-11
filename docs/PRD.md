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


## V1.1: Deal Support Mode
### User guidance
- Start with inbound-only capture on the workspace intake email.
- Expand to deal support by CC/forwarding ongoing deal correspondence to the same workspace intake email.
- Guiding principle: send what you want Conduit to understand; Conduit curates outcomes before CRM actions.

### Auto-association approach
- Conduit first attempts participant-email matching against known CRM-related deal participants.
- If no email match is available, Conduit may apply a lower-confidence company-domain match.
- If exactly one candidate is returned, Conduit links the thread to that deal/opportunity.
- If multiple candidates are plausible, Conduit routes the thread to `Needs Linking` in the Review Queue with ranked candidates.
- If no candidates are found, Conduit keeps the thread unlinked and routes to review for optional manual linking.

### Deal readiness checklist (BANT v1)
- For linked deals, Conduit tracks Budget, Authority, Need, Timeline readiness.
- Readiness is computed internally from extracted facts and conservative heuristics.
- Missing keys generate suggested follow-up questions and one-click internal task intents.
- To avoid CRM spam, readiness deltas are logged internally and rolled into task-first/weekly summary patterns.
- No raw email content or attachments are pushed to CRM as part of readiness.

## V1.2 Weekly Rollups + Drift Pause
- Conduit remains the canonical store for full email conversations, extraction evidence, and audits.
- CRM receives curated outcomes only: weekly summary note + optional high-signal delta updates.
- Weekly rollups are generated per deal/week and retained internally for reporting.
- Drift pause prevents CRM writes when extraction quality materially degrades for a known source pattern.

## V1.3 AI Rollups
- AI-generated weekly rollups are policy-gated and off by default with `use_llm_rollups=false`.
- `llm_context_level` controls model context scope:
  - `structured_only` (default): deal metadata, readiness deltas, curated event labels, risks, tasks.
  - `structured_plus_snippets`: same structured context plus a capped set of short redacted snippets from high-signal messages.
- Raw email bodies are never sent by default and never written to CRM.
- Product anti-spam posture is unchanged: CRM receives one curated weekly note plus optional high-confidence deltas.
- Invalid or failed AI outputs automatically fall back to deterministic weekly rollups.
