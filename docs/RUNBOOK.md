# Runbook

## Connection failed
1. Verify OAuth client ID/secret and redirect URI match provider config.
2. Check `oauth_states` row exists and has not expired.
3. Inspect function logs for callback token exchange errors.
4. Confirm `crm_connections.last_error` and `status`.

## Refresh token revoked
1. `crm_connections.status` will move to `error` with `last_error=refresh_token_revoked`.
2. Prompt admin to reconnect integration.
3. Verify no plaintext token values were logged.

## 429 rate limit
1. Worker retries automatically with backoff.
2. If persistent, reduce sync concurrency and requeue failed jobs.
3. Confirm provider account quotas and app limits.

## Scope missing
1. Reconnect with updated scopes.
2. HubSpot requires contacts/tasks/notes scopes for curated writes.
3. Salesforce requires at least `refresh_token api`.

## Salesforce instance_url mismatch
1. Validate `external_account_json.instance_url` in `crm_connections`.
2. Ensure OAuth flow used intended auth base (`login` vs `test`).
3. Reconnect if organization switched instances or sandbox refreshed.

## V1.4 Marketplace Readiness Hardening

### Pending install stuck
1. Check `pending_installs` for `status='pending'` and non-expired `expires_at`.
2. Verify callback created/updated `crm_connections` in `pending_claim` state.
3. Confirm `/claim-install` URL includes valid `install_id` and CRM.
4. Re-run claim via `claim-install` edge function and inspect `audit_events` for `install_claimed`.

### Token revoked / reconnect flow
1. Inspect `connection_health.details_json` and `crm_connections.last_error`.
2. If status is `error`, initiate OAuth reconnect from Integrations.
3. Confirm post-reconnect `connection_health.status='ok'` and `crm_connections.status='connected'`.

### Reconcile queue growing
1. Query `crm_write_log` where `status in ('failed','planned')` and `permanent_failure=false`.
2. Verify `reconcile_crm_writes` jobs are being enqueued by admin cron.
3. Check `retry_count`, `next_retry_at`, and audit events `crm_write_retry_scheduled`.
4. Triage permanent failures from `crm_write_marked_permanent_failure`.

### Retention purge failed
1. Confirm `retention_policies.purge_enabled=true` for workspace.
2. Verify `purge_retention` worker jobs are running daily.
3. Inspect error traces + `retention_purge_completed` audit payload counts.
4. Re-run purge job once database write issues are resolved.
