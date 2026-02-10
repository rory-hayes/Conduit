# V1 Vertical Slice Plan

## Goal
Deliver end-to-end ingestion → extraction → review → CRM sync stub.

## In Scope
- Supabase schema + edge functions.
- Worker job claiming + processors.
- Next.js dashboard skeleton.

## Out of Scope
- Full OCR pipeline.
- CRM object creation beyond tasks/notes.

## Milestones
1. Schema + edge functions complete.
2. Worker job loop with audit events.
3. UI skeleton with navigation.

## Acceptance Tests
- `pnpm -w lint` passes.
- `pnpm -w typecheck` passes.
- `pnpm -w test` passes.
- `inbound-email` function enqueues `extract_thread` jobs.
