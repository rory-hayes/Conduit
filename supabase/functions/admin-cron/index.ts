import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseServiceRoleKey, supabaseUrl } from '../_shared/env.ts';

const getWeekWindow = () => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 7);

  return {
    week_start: start.toISOString().slice(0, 10),
    week_end: end.toISOString().slice(0, 10)
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: workspaces, error: wsError } = await supabase.from('workspaces').select('id');

  if (wsError) {
    return new Response(JSON.stringify({ error: wsError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const window = getWeekWindow();
  const rows = (workspaces ?? []).map((workspace) => ({
    workspace_id: workspace.id,
    type: 'weekly_rollup',
    status: 'queued',
    payload: window
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from('jobs').insert(rows);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ status: 'queued', jobs: rows.length, ...window }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
