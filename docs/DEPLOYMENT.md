# Deployment

## Required environment variables
- `DRY_RUN` (default `true`; only `false` enables real CRM writes)
- `TOKEN_ENC_KEY_B64` (32-byte base64 key for token encryption)
- HubSpot:
  - `HUBSPOT_CLIENT_ID`
  - `HUBSPOT_CLIENT_SECRET`
  - `HUBSPOT_REDIRECT_URI`
- Salesforce:
  - `SALESFORCE_CLIENT_ID`
  - `SALESFORCE_CLIENT_SECRET`
  - `SALESFORCE_REDIRECT_URI`
  - `SALESFORCE_AUTH_BASE_URL` (`https://login.salesforce.com` or sandbox `https://test.salesforce.com`)
  - `SALESFORCE_API_VERSION` (default `v60.0`)
- Platform:
  - `APP_BASE_URL`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Callback URLs
- HubSpot callback: `${APP_BASE_URL}/functions/v1/hubspot-oauth-callback`
- Salesforce callback: `${APP_BASE_URL}/functions/v1/salesforce-oauth-callback`

## DRY_RUN behavior
- `DRY_RUN=true` (default): processors only write planned rows to `crm_write_log` and audit events.
- `DRY_RUN=false`: processors perform real API writes only if valid connected tokens are present.
- Missing/errored connections fail jobs with actionable errors and keep Conduit as source of truth.
