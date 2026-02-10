-- Conduit V1 core schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crm_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  crm_type text NOT NULL,
  access_token text,
  refresh_token text,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inbound_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  thread_id uuid NOT NULL REFERENCES threads(id),
  external_id text NOT NULL,
  from_email text NOT NULL,
  to_emails text[] NOT NULL,
  cc_emails text[] DEFAULT ARRAY[]::text[],
  body_text text,
  received_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id),
  filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE extraction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES threads(id),
  status text NOT NULL,
  confidence numeric,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_run_id uuid NOT NULL REFERENCES extraction_runs(id),
  field_key text NOT NULL,
  field_value text,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES threads(id),
  extraction_run_id uuid REFERENCES extraction_runs(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crm_write_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  crm_type text NOT NULL,
  object_type text NOT NULL,
  object_id text,
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_write_log ENABLE ROW LEVEL SECURITY;

-- RLS policy stubs: replace with workspace-based policies.
-- CREATE POLICY "workspace isolation" ON threads
--   USING (workspace_id = auth.uid());
