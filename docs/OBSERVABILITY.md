# Observability

## Logs
- Structured JSON logs in worker.
- Edge functions log request IDs and status.

## Metrics
- Job throughput.
- Review queue latency.
- CRM write success/failure.

## Alerts
- Drift pause triggered.
- CRM write error rate > 5%.
- Job backlog age > 30 minutes.

## Weekly rollup + drift required events/metrics
- `drift_alert_created` metric/event emitted when a drift alert row is created.
- `crm_writes_paused` metric/event emitted when pause state flips due to drift.
- `weekly_rollup_generated` metric/event emitted per deal-week rollup generation.
- `weekly_rollup_written_to_crm` metric/event emitted when curated weekly summary note is logged for CRM write.

## LLM Rollup Metrics/Events
- `llm_rollup_requested`: emitted before a model call attempt.
- `llm_rollup_succeeded`: emitted after validated JSON output is accepted.
- `llm_rollup_failed`: emitted for API/runtime errors.
- `llm_rollup_invalid_output`: emitted when model output fails strict schema validation.
- `llm_rollup_fallback_used`: emitted when deterministic fallback path is used.
- `llm_tokens_estimated`: emitted with prompt/completion token usage when available.
- `llm_latency_ms`: emitted with per-request latency.
