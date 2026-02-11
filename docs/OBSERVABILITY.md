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
