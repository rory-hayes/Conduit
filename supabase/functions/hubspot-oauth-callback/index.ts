import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseServiceRoleKey, supabaseUrl } from '../_shared/env.ts';
import { encryptToB64 } from '../_shared/crypto.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return new Response('Missing code/state', { status: 400, headers: corsHeaders });

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: oauthState } = await supabase
    .from('oauth_states')
    .select('workspace_id,crm,expires_at,used_at,redirect_to')
    .eq('state', state)
    .eq('crm', 'hubspot')
    .maybeSingle();

  if (!oauthState || oauthState.used_at || new Date(oauthState.expires_at).getTime() < Date.now()) {
    return new Response('Invalid OAuth state', { status: 400, headers: corsHeaders });
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: Deno.env.get('HUBSPOT_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('HUBSPOT_CLIENT_SECRET') ?? '',
    redirect_uri: Deno.env.get('HUBSPOT_REDIRECT_URI') ?? '',
    code
  });

  const tokenResponse = await fetch('https://api.hubspot.com/oauth/v3/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!tokenResponse.ok) {
    return new Response('HubSpot token exchange failed', { status: 400, headers: corsHeaders });
  }

  const token = await tokenResponse.json();
  await supabase.from('crm_connections').upsert(
    {
      workspace_id: oauthState.workspace_id,
      crm: 'hubspot',
      status: 'connected',
      access_token_ciphertext: await encryptToB64(token.access_token),
      refresh_token_ciphertext: token.refresh_token ? await encryptToB64(token.refresh_token) : null,
      token_expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
      scopes_json: token.scope ? String(token.scope).split(' ') : null,
      external_account_json: token.hub_id ? { hub_id: token.hub_id } : null,
      last_checked_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'workspace_id,crm' }
  );

  await supabase.from('oauth_states').update({ used_at: new Date().toISOString() }).eq('state', state);

  const redirectTo = oauthState.redirect_to ?? '/integrations';
  return Response.redirect(`${Deno.env.get('APP_BASE_URL') ?? 'http://localhost:3000'}${redirectTo}?hubspot_success=1`, 302);
});
