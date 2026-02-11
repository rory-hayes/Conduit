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
    .eq('crm', 'salesforce')
    .maybeSingle();

  if (!oauthState || oauthState.used_at || new Date(oauthState.expires_at).getTime() < Date.now()) {
    return new Response('Invalid OAuth state', { status: 400, headers: corsHeaders });
  }

  const authBaseUrl = Deno.env.get('SALESFORCE_AUTH_BASE_URL') ?? 'https://login.salesforce.com';
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: Deno.env.get('SALESFORCE_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('SALESFORCE_CLIENT_SECRET') ?? '',
    redirect_uri: Deno.env.get('SALESFORCE_REDIRECT_URI') ?? ''
  });

  const tokenResponse = await fetch(new URL('/services/oauth2/token', authBaseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!tokenResponse.ok) {
    return new Response('Salesforce token exchange failed', { status: 400, headers: corsHeaders });
  }

  const token = await tokenResponse.json();
  let orgId: string | null = null;
  if (token.id) {
    const identityResponse = await fetch(token.id, { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (identityResponse.ok) {
      const identity = await identityResponse.json();
      orgId = identity.organization_id ?? null;
    }
  }
  const externalAccountKey = String(orgId ?? token.instance_url ?? 'unknown_org');

  const connectionPayload = {
    workspace_id: oauthState.workspace_id ?? null,
    crm: 'salesforce',
    status: oauthState.workspace_id ? 'connected' : 'pending_claim',
    access_token_ciphertext: await encryptToB64(token.access_token),
    refresh_token_ciphertext: token.refresh_token ? await encryptToB64(token.refresh_token) : null,
    token_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    scopes_json: ['refresh_token', 'api'],
    external_account_json: {
      instance_url: token.instance_url,
      id: token.id,
      organization_id: orgId
    },
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
      .eq('crm', 'salesforce')
      .eq('external_account_key', externalAccountKey)
      .eq('status', 'pending')
      .maybeSingle();

    let installId = existingPending?.id;
    if (installId) {
      await supabase
        .from('pending_installs')
        .update({ connection_id: connection?.id ?? null, details_json: { instance_url: token.instance_url, organization_id: orgId }, expires_at: expiresAt })
        .eq('id', installId);
    } else {
      const { data: inserted } = await supabase
        .from('pending_installs')
        .insert({
          crm: 'salesforce',
          external_account_key: externalAccountKey,
          connection_id: connection?.id ?? null,
          status: 'pending',
          details_json: { instance_url: token.instance_url, organization_id: orgId, issued_at: new Date().toISOString() },
          expires_at: expiresAt
        })
        .select('id')
        .single();
      installId = inserted.id;
    }

    await supabase.from('oauth_states').update({ used_at: new Date().toISOString() }).eq('state', state);
    return Response.redirect(`${Deno.env.get('APP_BASE_URL') ?? 'http://localhost:3000'}/claim-install?crm=salesforce&install_id=${installId}`, 302);
  }

  await supabase.from('oauth_states').update({ used_at: new Date().toISOString() }).eq('state', state);

  const redirectTo = oauthState.redirect_to ?? '/integrations';
  return Response.redirect(`${Deno.env.get('APP_BASE_URL') ?? 'http://localhost:3000'}${redirectTo}?salesforce_success=1`, 302);
});
