-- Weekly rollups + drift pause safety (v1.2)

CREATE TABLE IF NOT EXISTS weekly_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  deal_id uuid NOT NULL REFERENCES deals(id),
  week_start date NOT NULL,
  week_end date NOT NULL,
  summary_md text NOT NULL,
  highlights_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, deal_id, week_start)
);

CREATE TABLE IF NOT EXISTS crm_deltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  deal_id uuid NOT NULL REFERENCES deals(id),
  crm text NOT NULL CHECK (crm IN ('hubspot', 'salesforce')),
  week_start date NOT NULL,
  delta_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('planned', 'applied', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, deal_id, crm, week_start)
);

CREATE TABLE IF NOT EXISTS drift_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  thread_id uuid REFERENCES threads(id),
  source_key text NOT NULL,
  schema_id uuid,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  reason text NOT NULL,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS write_pause (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  scope text NOT NULL CHECK (scope IN ('workspace', 'schema', 'source_key')),
  scope_key text,
  paused boolean NOT NULL DEFAULT false,
  paused_reason text,
  paused_at timestamptz,
  paused_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, scope, scope_key)
);

CREATE TABLE IF NOT EXISTS extraction_quality_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  source_key text NOT NULL,
  schema_id uuid,
  last_good_quality numeric NOT NULL,
  last_good_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, source_key, schema_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_rollups_deal_week ON weekly_rollups(deal_id, week_start);
CREATE INDEX IF NOT EXISTS idx_drift_alerts_status_created ON drift_alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_write_pause_paused ON write_pause(paused);
CREATE INDEX IF NOT EXISTS idx_crm_deltas_deal_week ON crm_deltas(deal_id, week_start);

ALTER TABLE weekly_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE write_pause ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_quality_history ENABLE ROW LEVEL SECURITY;

-- RLS stubs (permissive for local/dev; tighten in production)
-- CREATE POLICY weekly_rollups_dev_all ON weekly_rollups FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY crm_deltas_dev_all ON crm_deltas FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY drift_alerts_dev_all ON drift_alerts FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY write_pause_dev_all ON write_pause FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY extraction_quality_history_dev_all ON extraction_quality_history FOR ALL USING (true) WITH CHECK (true);
