import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { buildHubSpotAuthorizeUrl } from '../../../packages/shared/src/oauth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseServiceRoleKey, supabaseUrl } from '../_shared/env.ts';

const HUBSPOT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.tasks.read',
  'crm.objects.tasks.write',
  'crm.objects.notes.read',
  'crm.objects.notes.write',
  'oauth'
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { workspace_id, redirect_to } = await req.json();

  const state = crypto.randomUUID();
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  await supabase.from('oauth_states').insert({ workspace_id: workspace_id ?? null, crm: 'hubspot', state, redirect_to: redirect_to ?? '/integrations', expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });

  const authorizeUrl = buildHubSpotAuthorizeUrl({
    clientId: Deno.env.get('HUBSPOT_CLIENT_ID') ?? '',
    redirectUri: Deno.env.get('HUBSPOT_REDIRECT_URI') ?? '',
    state,
    scopes: HUBSPOT_SCOPES
  });

  return new Response(JSON.stringify({ authorizeUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
