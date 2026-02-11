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
