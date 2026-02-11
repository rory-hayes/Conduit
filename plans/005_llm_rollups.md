# Plan 005: AI-generated Weekly Rollups (OpenAI + Safe Fallback)

## Goal
Ship policy-gated, auditable AI weekly rollups that default to deterministic behavior, preserve CRM safety guarantees, and keep test/coverage gates green.

## Scope
- Add policy-gated LLM rollup generation path to worker weekly rollup processor.
- Add minimized context builder with two levels: `structured_only` (default) and `structured_plus_snippets`.
- Add deterministic redaction utilities for snippet mode.
- Add strict Zod output validation and deterministic fallback path.
- Add database migration for `llm_runs` audit table and weekly rollup generation metadata.
- Add OpenAI client abstraction + fake client for deterministic tests.
- Add web components to display generation method and AI rollup settings controls.
- Add docs for product behavior, privacy minimization, observability, pricing note, and runbook troubleshooting.

## Non-goals
- No autonomous CRM write expansion beyond existing “weekly note + optional high-confidence deltas”.
- No attachment/body ingestion into LLM context by default.
- No live OpenAI dependency in CI or tests.
- No pricing table changes (only recommendation text).

## Data Model Changes
1. New `llm_runs` table for prompt/input/output/validation/timing auditability.
2. New `weekly_rollups.llm_run_id` nullable FK -> `llm_runs.id`.
3. New `weekly_rollups.generation_method` text with values `deterministic | llm | llm_fallback` defaulting deterministic.
4. Indexes for efficient workspace/purpose time-range lookups and generation method filtering.
5. RLS enablement + stubs included in migration.

## OpenAI Interface Design
- `LLMClient` interface with `generateRollup(input): Promise<LLMResult>`.
- `OpenAILLMClient` uses fetch JSON API with env config:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL` (default `gpt-4o-mini`)
  - `OPENAI_BASE_URL` optional (default OpenAI API root)
- bounded retries with exponential backoff for 429/5xx only.
- DRY_RUN guard: when `DRY_RUN=true` client throws controlled skip error; processor falls back.
- Test path uses `FakeLLMClient` fixture responses.

## Prompt Design
- System prompt: policy + safety constraints (“use only provided context”, “JSON only”, “no hallucination”).
- User prompt: includes policy flags and minimized context JSON.
- Output format: strict JSON object with markdown summary cap and structured highlight arrays.

## Validation Rules
- Zod schema enforces strict object shape:
  - `summary_md` <= 1200 chars
  - `highlights.events/risks/next_actions` arrays of strings
  - `confidence` in [0..1]
  - `field_deltas[]` with `key`, `value`, `confidence` in [0..1]
- Invalid or parse-failed output -> fallback deterministic rollup + audit events.

## Failure Modes + Handling
- Missing key / DRY_RUN / policy disabled -> deterministic path only, auditable skip events.
- LLM API 429/5xx -> retry bounded then fallback.
- LLM invalid JSON/schema -> record invalid run + fallback + audit.
- Drift pause enabled/open -> skip LLM generation and keep deterministic.
- Duplicate week rollup generation without force -> no-op update prevention by existing check.

## Cost Controls
- Feature disabled by default (`use_llm_rollups=false`).
- `structured_only` default limits token volume and PII exposure.
- Snippet mode caps snippet count and chars per snippet.
- Prompt hash + uniqueness guard (`workspace_id, purpose, deal_id, prompt_hash`) avoid duplicate calls.
- Latency/tokens metrics and runbook guidance for spikes.

## Test Plan
- Unit: redaction deterministic masking (email local-part + phones).
- Unit: context builder in both context modes.
- Unit: schema validation for valid and invalid outputs.
- Processor: valid LLM output writes `generation_method=llm` and links `llm_run_id`.
- Processor: invalid output writes invalid run + fallback with `generation_method=llm_fallback`.
- Processor: `DRY_RUN=true` never calls LLM client.
- Web component: RollupViewer summary/highlights/method badge render.
- Web component: AIRollupsToggle warning text and toggle callbacks render.
- Regression: existing rollup deterministic generation still works.

## Acceptance Criteria
- [ ] `use_llm_rollups` policy key exists and defaults to `false` behavior.
- [ ] `llm_context_level` policy key exists and defaults to `structured_only`.
- [ ] No raw email bodies are sent in `structured_only` mode.
- [ ] Snippet mode includes only redacted snippets and enforces per-snippet max length.
- [ ] Snippet mode includes at most configured snippet cap.
- [ ] Attachments are never included in LLM context.
- [ ] LLM output is validated by strict Zod schema before persistence.
- [ ] Invalid model output triggers deterministic fallback and audit events.
- [ ] `DRY_RUN=true` prevents OpenAI network calls by default.
- [ ] `llm_runs` table stores prompt hash, model, parameters, input, output, validation, timing.
- [ ] `weekly_rollups` stores `generation_method` and optional `llm_run_id`.
- [ ] CRM deltas from LLM output are confidence-gated at >=0.90 and policy-gated.
- [ ] Existing deterministic rollup generation remains available and used on fallback/skip.
- [ ] Drift pause blocks LLM rollup generation when active.
- [ ] Rollup generation is idempotent for existing week/deal unless force override.
- [ ] Observability emits requested LLM lifecycle events and latency/token metrics.
- [ ] Docs updated across PRD, security/privacy, observability, pricing, and runbook.
- [ ] `pnpm -w lint` passes.
- [ ] `pnpm -w typecheck` passes.
- [ ] `pnpm -w test` passes.
- [ ] `pnpm -w test:coverage` passes with global thresholds >=95.

## Exact Tests to Add
- `services/worker/tests/redaction.test.ts`
- `services/worker/tests/contextBuilder.test.ts`
- `services/worker/tests/rollupSchema.test.ts`
- update `services/worker/tests/weeklyRollup.test.ts` with LLM valid/invalid/dry-run behavior checks.
- update `apps/web/tests/components.test.tsx` for enhanced `RollupViewer` and new `AIRollupsToggle`.
