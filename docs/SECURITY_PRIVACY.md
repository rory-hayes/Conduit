# Security & Privacy

## Data boundaries
- Raw email content and attachments stay inside Conduit storage.
- CRM payloads are curated summaries/tasks/limited high-confidence fields only.

## Token storage and access
- OAuth access/refresh tokens are encrypted with AES-GCM using `TOKEN_ENC_KEY_B64`.
- Token ciphertext is stored in `crm_connections` server-side only.
- Browser/UI only reads redacted metadata (`crm`, `status`, `last_checked_at`, `last_error`).
- OAuth state rows are server-only and never exposed to client keys.

## Audit and traceability
- Planned and successful CRM writes emit audit events.
- `crm_write_log` stores idempotency key, payload hash, external IDs, status, and response snippets.
- Refresh failures and revoked tokens are recorded in audit + connection error fields.

## Retention and minimization
- OAuth states use short TTL (10 minutes).
- Logs and CRM payloads should never contain plaintext tokens or raw email body content.
- Disconnect flow wipes token ciphertext and resets status.

## V1.4 Marketplace Readiness Hardening

- Retention policy options:
  - `raw_email_retention_days` and `attachment_retention_days` (default 30/30).
  - `purge_enabled` to disable automated purges.
  - `keep_extracted_fields` and `keep_audit_events` default true to preserve minimal operational evidence.
- Disconnect semantics:
  - `disconnect-crm` clears encrypted tokens server-side and sets integration status to `disconnected`.
  - Health metadata remains (non-sensitive) for operational history.
- Deletion semantics:
  - Raw message `text/html` is redacted after retention cutoff (`is_redacted=true`, timestamped).
  - Attachment storage references are nulled after retention cutoff.
  - Audit events and idempotency logs are retained unless explicit policy changes are made.
