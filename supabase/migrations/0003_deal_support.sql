-- Deal support mode v1.1

CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  crm text NOT NULL CHECK (crm IN ('hubspot', 'salesforce')),
  crm_deal_id text NOT NULL,
  title text NOT NULL,
  stage text,
  primary_domain text,
  owner_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, crm, crm_deal_id)
);

CREATE TABLE IF NOT EXISTS thread_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  thread_id uuid NOT NULL REFERENCES threads(id),
  deal_id uuid NOT NULL REFERENCES deals(id),
  link_confidence numeric NOT NULL,
  link_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, thread_id)
);

CREATE TABLE IF NOT EXISTS association_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  thread_id uuid NOT NULL REFERENCES threads(id),
  candidates_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_association_candidates_open_unique
  ON association_candidates(workspace_id, thread_id)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS deal_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  deal_id uuid NOT NULL REFERENCES deals(id),
  key text NOT NULL CHECK (key IN ('budget', 'authority', 'need', 'timeline')),
  value_json jsonb NOT NULL,
  confidence numeric NOT NULL,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, deal_id, key)
);

CREATE TABLE IF NOT EXISTS deal_readiness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  deal_id uuid NOT NULL REFERENCES deals(id),
  framework text NOT NULL DEFAULT 'BANT',
  missing_keys text[] NOT NULL DEFAULT '{}',
  readiness_score numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, deal_id, framework)
);

CREATE INDEX IF NOT EXISTS idx_deals_workspace_id ON deals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_thread_links_thread_id ON thread_links(thread_id);
CREATE INDEX IF NOT EXISTS idx_association_candidates_thread_status ON association_candidates(thread_id, status);
CREATE INDEX IF NOT EXISTS idx_deal_facts_deal_id ON deal_facts(deal_id);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE association_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_readiness ENABLE ROW LEVEL SECURITY;

-- RLS stubs (permissive for local/dev; tighten in production)
-- CREATE POLICY deals_dev_all ON deals FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY thread_links_dev_all ON thread_links FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY association_candidates_dev_all ON association_candidates FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY deal_facts_dev_all ON deal_facts FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY deal_readiness_dev_all ON deal_readiness FOR ALL USING (true) WITH CHECK (true);
