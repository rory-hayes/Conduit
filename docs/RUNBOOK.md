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
