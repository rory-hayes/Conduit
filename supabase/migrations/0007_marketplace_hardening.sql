-- Marketplace readiness hardening (v1.4)

ALTER TABLE oauth_states
  ALTER COLUMN workspace_id DROP NOT NULL;

ALTER TABLE crm_connections
  ALTER COLUMN workspace_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS pending_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm text NOT NULL CHECK (crm IN ('hubspot', 'salesforce')),
  external_account_key text NOT NULL,
  connection_id uuid REFERENCES crm_connections(id),
  workspace_id uuid REFERENCES workspaces(id),
  claimed_by_user_id uuid REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('pending', 'claimed', 'expired')) DEFAULT 'pending',
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_installs_unique_pending
  ON pending_installs(crm, external_account_key)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS connection_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  crm text NOT NULL CHECK (crm IN ('hubspot', 'salesforce')),
  status text NOT NULL CHECK (status IN ('ok', 'warning', 'error')),
  last_ok_at timestamptz,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, crm)
);

CREATE TABLE IF NOT EXISTS retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id),
  raw_email_retention_days int NOT NULL DEFAULT 30,
  attachment_retention_days int NOT NULL DEFAULT 30,
  keep_extracted_fields boolean NOT NULL DEFAULT true,
  keep_audit_events boolean NOT NULL DEFAULT true,
  purge_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_write_log
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permanent_failure boolean NOT NULL DEFAULT false;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_redacted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redacted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pending_installs_status_expires ON pending_installs(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_crm_write_log_retry ON crm_write_log(status, next_retry_at, permanent_failure);
CREATE INDEX IF NOT EXISTS idx_retention_policies_workspace ON retention_policies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_connection_health_workspace_crm ON connection_health(workspace_id, crm);

ALTER TABLE pending_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pending_installs_no_anon ON pending_installs;
CREATE POLICY pending_installs_no_anon ON pending_installs
  FOR SELECT TO anon
  USING (false);

DROP POLICY IF EXISTS pending_installs_workspace_claimed_read ON pending_installs;
CREATE POLICY pending_installs_workspace_claimed_read ON pending_installs
  FOR SELECT TO authenticated
  USING (
    status = 'claimed'
    AND workspace_id::text = auth.jwt() ->> 'workspace_id'
  );

DROP POLICY IF EXISTS connection_health_admin_read ON connection_health;
CREATE POLICY connection_health_admin_read ON connection_health
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = auth.jwt() ->> 'workspace_id'
    AND COALESCE(auth.jwt() ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS retention_policies_admin_rw ON retention_policies;
CREATE POLICY retention_policies_admin_rw ON retention_policies
  FOR ALL TO authenticated
  USING (
    workspace_id::text = auth.jwt() ->> 'workspace_id'
    AND COALESCE(auth.jwt() ->> 'role', '') = 'admin'
  )
  WITH CHECK (
    workspace_id::text = auth.jwt() ->> 'workspace_id'
    AND COALESCE(auth.jwt() ->> 'role', '') = 'admin'
  );

-- service-role policy stubs
DROP POLICY IF EXISTS pending_installs_service_manage ON pending_installs;
CREATE POLICY pending_installs_service_manage ON pending_installs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS connection_health_service_manage ON connection_health;
CREATE POLICY connection_health_service_manage ON connection_health
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS retention_policies_service_manage ON retention_policies;
CREATE POLICY retention_policies_service_manage ON retention_policies
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
