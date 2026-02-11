import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { buildSalesforceAuthorizeUrl } from '../../../packages/shared/src/oauth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseServiceRoleKey, supabaseUrl } from '../_shared/env.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { workspace_id, redirect_to } = await req.json();
  if (!workspace_id) return new Response(JSON.stringify({ error: 'workspace_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const state = crypto.randomUUID();
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  await supabase.from('oauth_states').insert({ workspace_id, crm: 'salesforce', state, redirect_to: redirect_to ?? '/integrations', expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });

  const authorizeUrl = buildSalesforceAuthorizeUrl({
    authBaseUrl: Deno.env.get('SALESFORCE_AUTH_BASE_URL') ?? 'https://login.salesforce.com',
    clientId: Deno.env.get('SALESFORCE_CLIENT_ID') ?? '',
    redirectUri: Deno.env.get('SALESFORCE_REDIRECT_URI') ?? '',
    state,
    scopes: 'refresh_token api'
  });

  return new Response(JSON.stringify({ authorizeUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
