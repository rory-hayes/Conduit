import { createClient } from '@supabase/supabase-js';

const getClient = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');

export interface CrmConnectionMeta {
  crm: 'hubspot' | 'salesforce';
  status: 'connected' | 'disconnected' | 'error';
  last_checked_at: string | null;
  last_error: string | null;
}

export const listCrmConnections = async (): Promise<CrmConnectionMeta[]> => {
  const supabase = getClient();
  const { data } = await supabase
    .from('crm_connections')
    .select('crm,status,last_checked_at,last_error')
    .in('crm', ['hubspot', 'salesforce']);

  return (data as CrmConnectionMeta[] | null) ?? [];
};

export const startOAuth = async (crm: 'hubspot' | 'salesforce', workspaceId: string): Promise<string> => {
  const endpoint = crm === 'hubspot' ? 'hubspot-oauth-start' : 'salesforce-oauth-start';
  const response = await fetch(`/functions/v1/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, redirect_to: '/integrations' })
  });
  const body = await response.json();
  return body.authorizeUrl;
};

export const disconnectCrm = async (crm: 'hubspot' | 'salesforce', workspaceId: string): Promise<void> => {
  await fetch('/functions/v1/crm-disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, crm })
  });
};
