# Runbook

## Common Tasks
- Check job backlog: query `jobs` with status `queued`.
- Check review queue: query `review_items` with status `open`.

## Incident: CRM Write Failures
1. Pause CRM writes (toggle policy).
2. Inspect `crm_write_log` for errors.
3. Retry failed jobs after fix.

## Incident: Drift Detected
1. System auto-pauses CRM writes.
2. Review queue escalates.
3. Increase sampling + retrain extraction.

## Responding to drift pause
1. Open Review Queue and filter **Drift Pause Reviews**.
2. Inspect extraction evidence and source pattern changes for affected threads.
3. Confirm schema validity and update extraction policy/normalization as needed.
4. Acknowledge drift alert, then resolve after validation sample passes.

## Re-enable writes after review
1. In Settings, verify `pause_on_drift` policy remains enabled unless incident command approves override.
2. Clear/resolve affected drift alerts.
3. Set corresponding `write_pause` scope row to `paused=false` with reason note.
4. Replay queued/reviewed items safely (idempotent CRM keys prevent duplicates).

## LLM Rollups Troubleshooting
1. **Invalid output errors (`llm_rollup_invalid_output`)**
   - Inspect `llm_runs.validation_status`, `error_text`, and `output_text`.
   - Confirm prompt/schema alignment and check for non-JSON wrappers.
   - Verify fallback path generated deterministic rollup (`generation_method=llm_fallback`).
2. **Rate limiting / transient provider failures**
   - Check `llm_rollup_failed` frequency and provider status.
   - Confirm retry/backoff behavior and consider temporary policy disable (`use_llm_rollups=false`).
3. **Cost spikes**
   - Review `llm_tokens_estimated` trend by workspace.
   - Keep `llm_context_level=structured_only` unless snippet mode is required.
   - Reduce model or max-token parameters and monitor `llm_latency_ms`.
