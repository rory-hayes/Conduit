-- Vertical slice schema upgrades for dry-run end-to-end flow

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS primary_contact_email text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS to_email text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS text text,
  ADD COLUMN IF NOT EXISTS html text,
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS in_reply_to text,
  ADD COLUMN IF NOT EXISTS references_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS raw_s3_key text;

UPDATE messages
SET
  text = COALESCE(text, body_text),
  message_id = COALESCE(message_id, external_id),
  subject = COALESCE(subject, '');

ALTER TABLE messages
  ALTER COLUMN subject SET NOT NULL;

ALTER TABLE extraction_runs
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id),
  ADD COLUMN IF NOT EXISTS schema_id text NOT NULL DEFAULT 'lead_intake',
  ADD COLUMN IF NOT EXISTS schema_version text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'deterministic-stub';

UPDATE extraction_runs er
SET workspace_id = t.workspace_id
FROM threads t
WHERE er.thread_id = t.id AND er.workspace_id IS NULL;

ALTER TABLE extraction_runs
  ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE field_values
  ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES threads(id),
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id),
  ADD COLUMN IF NOT EXISTS field_value_json jsonb,
  ADD COLUMN IF NOT EXISTS evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE field_values fv
SET
  thread_id = er.thread_id,
  workspace_id = er.workspace_id,
  field_value_json = to_jsonb(fv.field_value)
FROM extraction_runs er
WHERE fv.extraction_run_id = er.id;

ALTER TABLE field_values
  ALTER COLUMN thread_id SET NOT NULL,
  ALTER COLUMN workspace_id SET NOT NULL,
  ALTER COLUMN field_value_json SET NOT NULL;

ALTER TABLE review_items
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id),
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

UPDATE review_items ri
SET workspace_id = t.workspace_id
FROM threads t
WHERE ri.thread_id = t.id AND ri.workspace_id IS NULL;

ALTER TABLE review_items
  ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id),
  ADD COLUMN IF NOT EXISTS run_after timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_by text;

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id),
  ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES threads(id),
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES jobs(id),
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS data_json jsonb;

UPDATE audit_events
SET
  type = COALESCE(type, event_type),
  data_json = COALESCE(data_json, payload);

ALTER TABLE audit_events
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN data_json SET NOT NULL;

ALTER TABLE crm_write_log
  ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES threads(id),
  ADD COLUMN IF NOT EXISTS crm text,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS payload_json jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planned';

UPDATE crm_write_log
SET
  crm = COALESCE(crm, crm_type),
  action = COALESCE(action, object_type),
  payload_json = COALESCE(payload_json, '{}'::jsonb);

ALTER TABLE crm_write_log
  ALTER COLUMN crm SET NOT NULL,
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN payload_json SET NOT NULL;

ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS workspace_id_new uuid REFERENCES workspaces(id),
  ADD COLUMN IF NOT EXISTS policy jsonb;

UPDATE policies
SET
  workspace_id_new = COALESCE(workspace_id_new, workspace_id),
  policy = COALESCE(policy, config);

ALTER TABLE policies
  DROP COLUMN IF EXISTS workspace_id,
  RENAME COLUMN workspace_id_new TO workspace_id;

ALTER TABLE policies
  ALTER COLUMN workspace_id SET NOT NULL,
  ALTER COLUMN policy SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_workspace_created ON threads(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_claim ON jobs(status, run_after, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_workspace_type ON jobs(workspace_id, type, status);
CREATE INDEX IF NOT EXISTS idx_review_items_open ON review_items(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_values_thread ON field_values(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_write_log_thread ON crm_write_log(thread_id, created_at DESC);

-- RLS stubs (permissive for local/dev; tighten in production)
-- CREATE POLICY threads_dev_all ON threads FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY jobs_dev_all ON jobs FOR ALL USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_write_log_idempotency ON crm_write_log(idempotency_key);
