-- CRM OAuth + secure token storage metadata

CREATE TABLE IF NOT EXISTS oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  crm text NOT NULL CHECK (crm IN ('hubspot', 'salesforce')),
  state text NOT NULL UNIQUE,
  code_verifier text,
  redirect_to text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_connections
  ADD COLUMN IF NOT EXISTS crm text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS access_token_ciphertext text,
  ADD COLUMN IF NOT EXISTS refresh_token_ciphertext text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS scopes_json jsonb,
  ADD COLUMN IF NOT EXISTS external_account_json jsonb,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE crm_connections
SET crm = COALESCE(crm, crm_type);

ALTER TABLE crm_connections
  ALTER COLUMN crm SET NOT NULL;

ALTER TABLE crm_connections
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token;

ALTER TABLE crm_write_log
  ADD COLUMN IF NOT EXISTS external_ids_json jsonb,
  ADD COLUMN IF NOT EXISTS response_json jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_crm_connections_workspace_crm ON crm_connections(workspace_id, crm);
CREATE INDEX IF NOT EXISTS idx_crm_write_log_workspace_crm_idem ON crm_write_log(workspace_id, crm, idempotency_key);

DROP INDEX IF EXISTS idx_crm_write_log_idempotency;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_write_log_workspace_crm_idempotency
  ON crm_write_log(workspace_id, crm, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_connections_workspace_crm_unique
  ON crm_connections(workspace_id, crm);

ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oauth_states_no_client_access ON oauth_states;
CREATE POLICY oauth_states_no_client_access ON oauth_states
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS crm_connections_client_redacted_read ON crm_connections;
CREATE POLICY crm_connections_client_redacted_read ON crm_connections
  FOR SELECT TO authenticated
  USING (workspace_id::text = auth.jwt() ->> 'workspace_id');

-- Server writes with service-role bypass RLS, keep explicit stubs for future tightening.
DROP POLICY IF EXISTS crm_connections_server_manage ON crm_connections;
CREATE POLICY crm_connections_server_manage ON crm_connections
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
