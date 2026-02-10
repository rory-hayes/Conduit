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
