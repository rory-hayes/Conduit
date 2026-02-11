# Plan 003: Deal Association + Readiness (V1.1)

## Scope
- Add automatic thread-to-deal association for inbound threads using participant email/domain heuristics.
- Add review routing for ambiguous association outcomes (“Needs Linking”).
- Add BANT v1 deal readiness computation and surfaced missing-info suggestions.
- Add thread and review queue UI for deal linking and readiness visibility.
- Keep CRM outputs curated (task-first), dry-run-first, and auditable.

## Non-goals
- No per-deal email alias requirements.
- No raw email body/attachments written to CRM.
- No broad bidirectional CRM object sync.
- No advanced NLP/entity resolution beyond participant/domain heuristic candidates.

## Data model changes
- `deals`: workspace-local mirror of CRM deal/opportunity identity and metadata.
- `thread_links`: single active deal link per thread with confidence + reason.
- `association_candidates`: open/resolved candidate set when auto-link is ambiguous.
- `deal_facts`: normalized readiness evidence facts (BANT keys).
- `deal_readiness`: framework-level readiness score + missing key list.
- Indexes added for deal lookup and association/readiness query paths.
- RLS enabled and policy stubs included, matching existing migration style.

## API / UI changes
- Review Queue: new “Needs Linking” section filtered by `reason=needs_deal_linking`.
- Thread detail:
  - Linked deal badge (or Unlinked state).
  - `DealLinker` candidate picker when linking is unresolved.
  - `DealReadinessPanel` for BANT score/missing keys/questions/task intents.
- Query layer expanded to fetch `thread_links`, `deals`, `deal_facts`, `deal_readiness`, and linking review items.

## Worker changes
- Add new job type/processor `associate_thread`.
- `extract_thread` now enqueues `associate_thread` after extraction artifacts are written.
- `associate_thread`:
  - collects participant emails (from + optional to email where available),
  - resolves candidate deals via provider abstraction,
  - applies outcomes (linked, needs linking, unlinked),
  - updates facts/readiness for linked deals,
  - writes audit events for association + readiness changes,
  - plans follow-up task intents internally and writes dry-run CRM task logs only.

## Failure modes and handling
- No candidates: create `unlinked_thread` review item + audit event.
- Multiple candidates: upsert open `association_candidates`, create `needs_deal_linking` review item + audit event.
- Single candidate but DB race: idempotent upserts (`ON CONFLICT`) preserve correctness.
- Missing thread/messages: processor fails fast and surfaces job error for retry.
- Deal readiness signal weak/empty: readiness remains low; no noisy external CRM writes.

## Test plan
### Worker
- `associateThread` creates unlinked review item on 0 candidates.
- `associateThread` upserts deal + thread link on 1 candidate.
- `associateThread` creates association candidates + review item on >1 candidate.
- readiness calculator computes score/missing keys.
- readiness question generator ordering.
- extracted field + heuristic mapping upserts deal facts/readiness.

### Shared package
- new deal-link idempotency helper is deterministic and input-sensitive.

### Web
- `DealReadinessPanel` renders missing keys and suggested questions.
- `DealLinker` renders candidates and invokes callback with selected deal.
- query helper returns expanded thread detail shape fallback values.

## Acceptance criteria
- [ ] Threads can be auto-linked to exactly one candidate deal.
- [ ] Ambiguous candidate sets produce open `association_candidates` rows.
- [ ] Ambiguous candidate sets produce `needs_deal_linking` review items.
- [ ] No-candidate threads produce `unlinked_thread` review items.
- [ ] Linked threads produce/upsert `deals` mirror rows.
- [ ] Linked threads produce/upsert `thread_links` with confidence + reason.
- [ ] BANT readiness score is computed as present/4*100.
- [ ] Missing BANT keys are stored in `deal_readiness.missing_keys`.
- [ ] Suggested readiness questions are shown in thread UI.
- [ ] Review Queue has a dedicated Needs Linking section.
- [ ] CRM outputs remain curated + dry-run (planned follow-up tasks only).
- [ ] Raw email body/attachments are never written to CRM log payloads.
- [ ] New tables are indexed for core query paths.
- [ ] New tables include RLS stubs consistent with project style.
- [ ] `pnpm -w lint`, `pnpm -w typecheck`, `pnpm -w test`, and `pnpm -w test:coverage` pass.
