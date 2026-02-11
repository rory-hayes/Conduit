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
  const externalAccountKey = String(token.hub_id ?? token.user ?? 'unknown_hub');

  const connectionPayload = {
    workspace_id: oauthState.workspace_id ?? null,
    crm: 'hubspot',
    status: oauthState.workspace_id ? 'connected' : 'pending_claim',
    access_token_ciphertext: await encryptToB64(token.access_token),
    refresh_token_ciphertext: token.refresh_token ? await encryptToB64(token.refresh_token) : null,
    token_expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    scopes_json: token.scope ? String(token.scope).split(' ') : null,
    external_account_json: { hub_id: token.hub_id },
    last_checked_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString()
  };

  const { data: connection, error: upsertError } = await supabase.from('crm_connections').upsert(connectionPayload, { onConflict: 'workspace_id,crm' }).select('id').maybeSingle();
  if (upsertError) return new Response(upsertError.message, { status: 500, headers: corsHeaders });

  if (!oauthState.workspace_id) {
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existingPending } = await supabase
      .from('pending_installs')
      .select('id')
      .eq('crm', 'hubspot')
      .eq('external_account_key', externalAccountKey)
      .eq('status', 'pending')
      .maybeSingle();

    let installId = existingPending?.id;
    if (installId) {
      await supabase
        .from('pending_installs')
        .update({ connection_id: connection?.id ?? null, details_json: { scope: token.scope, hub_id: token.hub_id }, expires_at: expiresAt })
        .eq('id', installId);
    } else {
      const { data: inserted } = await supabase
        .from('pending_installs')
        .insert({
          crm: 'hubspot',
          external_account_key: externalAccountKey,
          connection_id: connection?.id ?? null,
          status: 'pending',
          details_json: { scope: token.scope, hub_id: token.hub_id, issued_at: new Date().toISOString() },
          expires_at: expiresAt
        })
        .select('id')
        .single();
      installId = inserted.id;
    }

    await supabase.from('oauth_states').update({ used_at: new Date().toISOString() }).eq('state', state);
    return Response.redirect(`${Deno.env.get('APP_BASE_URL') ?? 'http://localhost:3000'}/claim-install?crm=hubspot&install_id=${installId}`, 302);
  }

  await supabase.from('oauth_states').update({ used_at: new Date().toISOString() }).eq('state', state);

  const redirectTo = oauthState.redirect_to ?? '/integrations';
  return Response.redirect(`${Deno.env.get('APP_BASE_URL') ?? 'http://localhost:3000'}${redirectTo}?hubspot_success=1`, 302);
});
