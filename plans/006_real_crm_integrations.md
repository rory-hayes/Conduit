# Plan 006: Real CRM Integrations (HubSpot + Salesforce)

## Scope
- Implement real OAuth connect/callback flows for HubSpot and Salesforce.
- Encrypt and persist OAuth tokens server-side only.
- Add worker token refresh, retry/rate-limit primitives, and real API clients.
- Execute real CRM writes in processors when `DRY_RUN=false`.
- Extend integrations UI with connect/disconnect and connection health metadata.

## Non-goals
- Full CRM object mapping beyond curated contact/lead + task + note.
- Bidirectional sync from CRM into Conduit.
- PKCE rollout for all providers (state-based CSRF protection only in this phase).

## Data model changes
- `crm_connections` hardened with encrypted token columns, status, scopes, external account metadata, and error/heartbeat fields.
- `oauth_states` added for short-lived OAuth state validation.
- `crm_write_log` extended with `external_ids_json`, `response_json`, and `updated_at`.

## OAuth flows
- Start endpoints mint state, persist with 10 minute TTL, and return authorize URLs.
- Callback endpoints validate/consume state, exchange code for token, encrypt token material, and upsert `crm_connections`.

## Token lifecycle
- Workers decrypt access tokens on demand.
- Tokens expiring in <=2 minutes are refreshed automatically.
- Refresh revocation (`invalid_grant`) moves connection to `error` and emits audit events.

## Rate limiting + retries
- Per workspace+crm in-memory limiter for minimum interval pacing.
- Shared retry helper retries 429 and 5xx-like errors with incremental backoff.

## Idempotency strategy
- Deterministic idempotency key derived from workspace, crm, object, action, and source event.
- `crm_write_log` unique constraint on `(workspace_id, crm, idempotency_key)`.
- Processors skip writes already marked `succeeded`.

## Test plan
- Shared crypto roundtrip and wrong-key failure.
- OAuth URL builder unit tests.
- HubSpot client tests for search/create/update and task/note shape.
- Salesforce client tests for query/patch/create/task.
- Token manager refresh tests with mocked fetch/database.
- Sync processor tests for dry-run logging, idempotency skip, real mode execution, and auth failure surfacing.
- HTTP helper tests for retries and rate limiting.
- IntegrationCard/UI safety tests ensuring token values never render.

## Acceptance criteria
- [ ] 1. `plans/006_real_crm_integrations.md` committed.
- [ ] 2. OAuth state table exists with TTL and single-use semantics.
- [ ] 3. HubSpot OAuth start returns valid authorize URL.
- [ ] 4. HubSpot callback stores encrypted access token.
- [ ] 5. HubSpot callback stores refresh token when provided.
- [ ] 6. HubSpot callback marks state `used_at`.
- [ ] 7. Salesforce OAuth start supports configurable auth base URL.
- [ ] 8. Salesforce callback stores encrypted tokens and `instance_url`.
- [ ] 9. Tokens are never returned in web client queries.
- [ ] 10. `TOKEN_ENC_KEY_B64` enforced for encryption/decryption.
- [ ] 11. HubSpot token manager refreshes expiring tokens.
- [ ] 12. Salesforce token manager refreshes expiring tokens.
- [ ] 13. Refresh revoke moves connection to `error`.
- [ ] 14. HubSpot client can upsert contact by email.
- [ ] 15. HubSpot client can create task and note with associations.
- [ ] 16. Salesforce client can lookup lead/contact by email.
- [ ] 17. Salesforce client can upsert minimal lead.
- [ ] 18. Salesforce weekly rollup is written as task description.
- [ ] 19. Sync processors keep `DRY_RUN=true` behavior unchanged.
- [ ] 20. Sync processors perform real writes only when `DRY_RUN=false`.
- [ ] 21. Successful writes persist external IDs and response payload.
- [ ] 22. Idempotent succeeded writes are skipped.
- [ ] 23. 429/5xx retry helper is reusable.
- [ ] 24. Integrations UI supports connect/disconnect for both CRMs.
- [ ] 25. Lint, typecheck, tests, and coverage remain green.

## Exact tests to add
- `packages/shared/tests/crypto.test.ts`
- `packages/shared/tests/oauth.test.ts`
- `services/worker/tests/hubspotClient.test.ts`
- `services/worker/tests/salesforceClient.test.ts`
- `services/worker/tests/tokenManagers.test.ts`
- `services/worker/tests/http.test.ts`
- `apps/web/tests/integrations.test.ts`
- `apps/web/tests/components.test.tsx` (IntegrationCard coverage)
