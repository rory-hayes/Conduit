import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseServiceRoleKey, supabaseUrl } from '../_shared/env.ts';
import { claimInstall } from '../_shared/installClaims.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { install_id, workspace_id, user_id } = await req.json();
  if (!install_id || !workspace_id || !user_id) {
    return new Response(JSON.stringify({ error: 'install_id, workspace_id, user_id are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const result = await claimInstall(supabase, { install_id, workspace_id, user_id });

  if ('error' in result) {
    return new Response(JSON.stringify(result), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
