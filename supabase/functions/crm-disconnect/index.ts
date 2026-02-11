import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseServiceRoleKey, supabaseUrl } from '../_shared/env.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { workspace_id, crm } = await req.json();
  if (!workspace_id || !crm) return new Response(JSON.stringify({ error: 'workspace_id and crm are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  await supabase
    .from('crm_connections')
    .update({
      status: 'disconnected',
      access_token_ciphertext: null,
      refresh_token_ciphertext: null,
      token_expires_at: null,
      last_error: null,
      updated_at: new Date().toISOString()
    })
    .eq('workspace_id', workspace_id)
    .eq('crm', crm);

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
