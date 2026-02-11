-- LLM weekly rollup auditability + generation tracking (v1.3)

CREATE TABLE IF NOT EXISTS llm_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  deal_id uuid REFERENCES deals(id),
  thread_id uuid REFERENCES threads(id),
  job_id uuid REFERENCES jobs(id),
  purpose text NOT NULL,
  model text NOT NULL,
  parameters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  context_level text NOT NULL CHECK (context_level IN ('structured_only', 'structured_plus_snippets')),
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_hash text NOT NULL,
  output_text text NOT NULL,
  output_json jsonb,
  validation_status text NOT NULL CHECK (validation_status IN ('valid', 'invalid', 'error')),
  error_text text,
  tokens_prompt int,
  tokens_completion int,
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, purpose, deal_id, prompt_hash)
);

ALTER TABLE weekly_rollups
  ADD COLUMN IF NOT EXISTS llm_run_id uuid REFERENCES llm_runs(id),
  ADD COLUMN IF NOT EXISTS generation_method text NOT NULL DEFAULT 'deterministic'
    CHECK (generation_method IN ('deterministic', 'llm', 'llm_fallback'));

CREATE INDEX IF NOT EXISTS idx_llm_runs_workspace_purpose_created
  ON llm_runs(workspace_id, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_rollups_generation_method
  ON weekly_rollups(generation_method);

ALTER TABLE llm_runs ENABLE ROW LEVEL SECURITY;

-- RLS stubs (permissive for local/dev; tighten in production)
-- CREATE POLICY llm_runs_dev_all ON llm_runs FOR ALL USING (true) WITH CHECK (true);
